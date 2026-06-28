import fs from "fs/promises";
import path from "path";
import { Framework } from "@prisma/client";

const NODE_DOCKERFILE = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG BUILD_COMMAND
RUN sh -c "\${BUILD_COMMAND:-npm run build}"

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app .
EXPOSE 3000
CMD sh -c "\${START_COMMAND:-npm start}"
`;

const PYTHON_DOCKERFILE = `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD sh -c "\${START_COMMAND:-uvicorn main:app --host 0.0.0.0 --port 8000}"
`;

const GO_DOCKERFILE = `FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /server .

FROM alpine:latest
WORKDIR /app
COPY --from=builder /server .
EXPOSE 8080
CMD ["./server"]
`;

const STATIC_DOCKERFILE = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG BUILD_COMMAND
RUN sh -c "\${BUILD_COMMAND:-npm run build}"

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
`;

export async function detectFramework(workDir: string): Promise<Framework> {
  if (await exists(path.join(workDir, "Dockerfile"))) return "DOCKERFILE";
  if (await exists(path.join(workDir, "package.json"))) {
    try {
      const pkg = JSON.parse(
        await fs.readFile(path.join(workDir, "package.json"), "utf-8")
      ) as { scripts?: { build?: string }; dependencies?: Record<string, string> };
      if (pkg.scripts?.build) return "STATIC";
      return "NODE";
    } catch {
      return "NODE";
    }
  }
  if (await exists(path.join(workDir, "requirements.txt"))) return "PYTHON";
  if (await exists(path.join(workDir, "go.mod"))) return "GO";
  return "UNKNOWN";
}

export async function ensureDockerfile(
  workDir: string,
  framework: Framework
): Promise<void> {
  const dockerfilePath = path.join(workDir, "Dockerfile");
  if (await exists(dockerfilePath)) return;

  const templates: Partial<Record<Framework, string>> = {
    NODE: NODE_DOCKERFILE,
    PYTHON: PYTHON_DOCKERFILE,
    GO: GO_DOCKERFILE,
    STATIC: STATIC_DOCKERFILE,
  };

  const template = templates[framework];
  if (!template) {
    throw new Error(
      "No Dockerfile found and framework could not be auto-detected. Add a Dockerfile to your repo."
    );
  }
  await fs.writeFile(dockerfilePath, template, "utf-8");
}

async function exists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

export function defaultPort(framework: Framework): number {
  switch (framework) {
    case "PYTHON":
      return 8000;
    case "GO":
      return 8080;
    case "STATIC":
      return 80;
    default:
      return 3000;
  }
}

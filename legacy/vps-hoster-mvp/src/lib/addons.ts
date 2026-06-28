import { randomBytes } from "crypto";
import { AddonType, AddonStatus } from "@prisma/client";
import { prisma } from "./db";
import { config } from "./config";
import { ensureNetwork, getDocker } from "./docker";

export interface AddonConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  connectionUrl: string;
}

function postgresContainerName(slug: string) {
  return `vps-hoster-pg-${slug}`;
}

function redisContainerName(slug: string) {
  return `vps-hoster-redis-${slug}`;
}

function generatePassword(): string {
  return randomBytes(16).toString("hex");
}

export async function provisionAddon(
  projectId: string,
  type: AddonType
): Promise<{ id: string; config: AddonConfig }> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });

  const existing = await prisma.addon.findUnique({
    where: { projectId_type: { projectId, type } },
  });
  if (existing?.status === "RUNNING") {
    return {
      id: existing.id,
      config: JSON.parse(existing.config) as AddonConfig,
    };
  }

  const name = type === "POSTGRES" ? "PostgreSQL" : "Redis";
  const addon = await prisma.addon.upsert({
    where: { projectId_type: { projectId, type } },
    create: { projectId, type, name, status: "PROVISIONING" },
    update: { status: "PROVISIONING" },
  });

  try {
    await ensureNetwork();
    const docker = getDocker();

    if (type === "POSTGRES") {
      const cfg = await provisionPostgres(docker, project.slug);
      const container = docker.getContainer(postgresContainerName(project.slug));
      const inspect = await container.inspect();
      await prisma.addon.update({
        where: { id: addon.id },
        data: {
          status: "RUNNING",
          containerId: inspect.Id,
          config: JSON.stringify(cfg),
        },
      });
      return { id: addon.id, config: cfg };
    }

    const cfg = await provisionRedis(docker, project.slug);
    const container = docker.getContainer(redisContainerName(project.slug));
    const inspect = await container.inspect();
    await prisma.addon.update({
      where: { id: addon.id },
      data: {
        status: "RUNNING",
        containerId: inspect.Id,
        config: JSON.stringify(cfg),
      },
    });
    return { id: addon.id, config: cfg };
  } catch (err) {
    await prisma.addon.update({
      where: { id: addon.id },
      data: { status: "FAILED" },
    });
    throw err;
  }
}

async function provisionPostgres(
  docker: ReturnType<typeof getDocker>,
  slug: string
): Promise<AddonConfig> {
  const containerName = postgresContainerName(slug);
  const password = generatePassword();
  const username = "vps";
  const database = "app";
  const host = containerName;
  const port = 5432;

  await removeContainerIfExists(docker, containerName);

  const container = await docker.createContainer({
    name: containerName,
    Image: "postgres:16-alpine",
    Env: [
      `POSTGRES_USER=${username}`,
      `POSTGRES_PASSWORD=${password}`,
      `POSTGRES_DB=${database}`,
    ],
    ExposedPorts: { "5432/tcp": {} },
    HostConfig: {
      NetworkMode: config.network,
      RestartPolicy: { Name: "unless-stopped" },
      Binds: [`vps-hoster-pg-${slug}:/var/lib/postgresql/data`],
    },
    NetworkingConfig: {
      EndpointsConfig: { [config.network]: {} },
    },
  });

  await container.start();
  await waitForHealthy(containerName, 30);

  const connectionUrl = `postgresql://${username}:${password}@${host}:${port}/${database}`;
  return { host, port, username, password, database, connectionUrl };
}

async function provisionRedis(
  docker: ReturnType<typeof getDocker>,
  slug: string
): Promise<AddonConfig> {
  const containerName = redisContainerName(slug);
  const host = containerName;
  const port = 6379;

  await removeContainerIfExists(docker, containerName);

  const container = await docker.createContainer({
    name: containerName,
    Image: "redis:7-alpine",
    ExposedPorts: { "6379/tcp": {} },
    HostConfig: {
      NetworkMode: config.network,
      RestartPolicy: { Name: "unless-stopped" },
    },
    NetworkingConfig: {
      EndpointsConfig: { [config.network]: {} },
    },
  });

  await container.start();

  const connectionUrl = `redis://${host}:${port}`;
  return { host, port, connectionUrl };
}

async function removeContainerIfExists(
  docker: ReturnType<typeof getDocker>,
  name: string
) {
  try {
    const c = docker.getContainer(name);
    await c.stop({ t: 5 }).catch(() => undefined);
    await c.remove({ force: true });
  } catch {
    // not found
  }
}

async function waitForHealthy(containerName: string, maxSeconds: number) {
  const docker = getDocker();
  for (let i = 0; i < maxSeconds; i++) {
    try {
      const c = docker.getContainer(containerName);
      const info = await c.inspect();
      if (info.State.Running) {
        const exec = await c.exec({
          Cmd: ["pg_isready", "-U", "vps"],
          AttachStdout: true,
          AttachStderr: true,
        });
        const stream = await exec.start({ hijack: true, stdin: false });
        await new Promise<void>((resolve) => {
          stream.on("end", resolve);
          stream.resume();
        });
        const inspect = await exec.inspect();
        if (inspect.ExitCode === 0) return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export async function stopAddon(addonId: string): Promise<void> {
  const addon = await prisma.addon.findUniqueOrThrow({ where: { id: addonId } });
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: addon.projectId },
  });

  const name =
    addon.type === "POSTGRES"
      ? postgresContainerName(project.slug)
      : redisContainerName(project.slug);

  await removeContainerIfExists(getDocker(), name);
  await prisma.addon.update({
    where: { id: addonId },
    data: { status: "STOPPED", containerId: null },
  });
}

export async function deleteAddon(addonId: string): Promise<void> {
  const addon = await prisma.addon.findUniqueOrThrow({ where: { id: addonId } });
  await stopAddon(addonId).catch(() => undefined);
  await prisma.addon.delete({ where: { id: addon.id } });
}

export function addonEnvVars(
  addons: {
    type: AddonType;
    config: string;
    status: AddonStatus;
  }[]
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const addon of addons) {
    if (addon.status !== "RUNNING") continue;
    const cfg = JSON.parse(addon.config) as AddonConfig;
    if (addon.type === "POSTGRES") {
      env.DATABASE_URL = cfg.connectionUrl;
      env.POSTGRES_URL = cfg.connectionUrl;
    }
    if (addon.type === "REDIS") {
      env.REDIS_URL = cfg.connectionUrl;
    }
  }
  return env;
}

export async function ensureAddonsRunning(projectId: string): Promise<void> {
  const addons = await prisma.addon.findMany({
    where: { projectId, status: { in: ["PROVISIONING", "RUNNING"] } },
  });
  for (const addon of addons) {
    if (addon.status !== "RUNNING") {
      await provisionAddon(projectId, addon.type);
    }
  }
}

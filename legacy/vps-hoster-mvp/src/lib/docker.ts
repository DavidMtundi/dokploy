import fs from "fs";
import os from "os";
import path from "path";
import Docker from "dockerode";
import { config } from "./config";

let dockerInstance: Docker | null = null;

function resolveDockerSocket(): string {
  if (process.env.DOCKER_SOCKET) return process.env.DOCKER_SOCKET;
  const colima = path.join(os.homedir(), ".colima/default/docker.sock");
  if (fs.existsSync(colima)) return colima;
  return "/var/run/docker.sock";
}

export function getDocker(): Docker {
  if (!dockerInstance) {
    dockerInstance = new Docker({ socketPath: resolveDockerSocket() });
  }
  return dockerInstance;
}

export async function ensureNetwork(): Promise<void> {
  const docker = getDocker();
  const networks = await docker.listNetworks({
    filters: { name: [config.network] },
  });
  if (networks.length === 0) {
    await docker.createNetwork({ Name: config.network, Driver: "bridge" });
  }
}

export function parseEnvVars(json: string): Record<string, string> {
  try {
    const parsed = JSON.parse(json) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([k, v]) => typeof k === "string" && typeof v === "string"
      )
    );
  } catch {
    return {};
  }
}

export function envArray(env: Record<string, string>): string[] {
  return Object.entries(env).map(([k, v]) => `${k}=${v}`);
}

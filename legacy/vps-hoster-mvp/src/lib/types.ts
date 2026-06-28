export type ProjectStatus =
  | "IDLE"
  | "BUILDING"
  | "DEPLOYING"
  | "RUNNING"
  | "FAILED"
  | "STOPPED";

export type DeploymentStatus =
  | "QUEUED"
  | "CLONING"
  | "BUILDING"
  | "STARTING"
  | "SUCCESS"
  | "FAILED";

export type BuildMethod = "AUTO" | "DOCKERFILE" | "NIXPACKS";

export type AddonType = "POSTGRES" | "REDIS";

export type AddonStatus = "PROVISIONING" | "RUNNING" | "STOPPED" | "FAILED";

export interface Domain {
  id: string;
  hostname: string;
  isPrimary: boolean;
}

export interface Addon {
  id: string;
  type: AddonType;
  name: string;
  status: AddonStatus;
  config: string;
  createdAt: string;
}

export interface Deployment {
  id: string;
  status: DeploymentStatus;
  commitSha: string | null;
  commitMessage: string | null;
  logs: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  repoUrl: string | null;
  branch: string;
  rootDir: string;
  framework: string;
  buildMethod: BuildMethod;
  buildCommand: string | null;
  startCommand: string | null;
  port: number;
  envVars: string;
  status: ProjectStatus;
  webhookSecret: string;
  autoDeploy: boolean;
  createdAt: string;
  updatedAt: string;
  domains?: Domain[];
  addons?: Addon[];
  deployments?: Deployment[];
}

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  IDLE: "bg-zinc-500",
  BUILDING: "bg-amber-500",
  DEPLOYING: "bg-amber-500",
  RUNNING: "bg-emerald-500",
  FAILED: "bg-red-500",
  STOPPED: "bg-zinc-600",
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  IDLE: "Idle",
  BUILDING: "Building",
  DEPLOYING: "Deploying",
  RUNNING: "Running",
  FAILED: "Failed",
  STOPPED: "Stopped",
};

export const BUILD_METHOD_LABELS: Record<BuildMethod, string> = {
  AUTO: "Auto (Dockerfile or Nixpacks)",
  DOCKERFILE: "Dockerfile only",
  NIXPACKS: "Nixpacks buildpack",
};

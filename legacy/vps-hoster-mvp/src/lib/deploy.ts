import { DeploymentStatus, Project, BuildMethod, Addon } from "@prisma/client";
import { prisma } from "./db";
import { config } from "./config";
import {
  ensureNetwork,
  envArray,
  getDocker,
  parseEnvVars,
} from "./docker";
import { cloneOrPull } from "./git";
import { defaultPort, detectFramework, ensureDockerfile } from "./build";
import { buildTraefikLabels } from "./traefik-labels";
import { buildWithNixpacks, hasDockerfile } from "./nixpacks";
import { addonEnvVars, ensureAddonsRunning } from "./addons";

async function stopExistingContainer(slug: string) {
  const docker = getDocker();
  const containerName = `vps-hoster-${slug}`;
  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();
    if (info.State.Running) {
      await container.stop({ t: 10 });
    }
    await container.remove({ force: true });
  } catch {
    // Container doesn't exist — fine
  }
}

async function appendLog(deploymentId: string, line: string) {
  const entry = `[${new Date().toISOString()}] ${line}\n`;
  const current = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    select: { logs: true },
  });
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { logs: (current?.logs ?? "") + entry },
  });
}

async function setDeploymentStatus(
  deploymentId: string,
  status: DeploymentStatus,
  extra: Record<string, unknown> = {}
) {
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status, ...extra },
  });
}

export async function runDeployment(
  projectId: string,
  triggeredBy: string = "manual"
): Promise<string> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { domains: true, addons: true },
  });

  if (!project.repoUrl) {
    throw new Error("Project has no repository URL configured");
  }

  const deployment = await prisma.deployment.create({
    data: {
      projectId,
      status: "QUEUED",
      triggeredBy,
    },
  });

  void executeDeployment(project, deployment.id).catch(async (err) => {
    const message = err instanceof Error ? err.message : String(err);
    await appendLog(deployment.id, `Fatal error: ${message}`);
    await setDeploymentStatus(deployment.id, "FAILED", {
      finishedAt: new Date(),
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "FAILED" },
    });
  });

  return deployment.id;
}

type ProjectWithRelations = Project & {
  domains: { hostname: string; isPrimary: boolean }[];
  addons: Addon[];
};

async function executeDeployment(
  project: ProjectWithRelations,
  deploymentId: string
) {
  const log = (line: string) => appendLog(deploymentId, line);

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "BUILDING" },
  });

  await setDeploymentStatus(deploymentId, "CLONING");
  await log(`Cloning ${project.repoUrl} (branch: ${project.branch})...`);

  const { commitSha, commitMessage, workDir } = await cloneOrPull(
    project.repoUrl!,
    project.branch,
    project.slug,
    project.rootDir
  );

  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { commitSha, commitMessage },
  });
  await log(`Checked out ${commitSha.slice(0, 7)} — ${commitMessage.split("\n")[0]}`);

  await log("Ensuring add-ons are running...");
  await ensureAddonsRunning(project.id);
  const freshProject = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { domains: true, addons: true },
  });
  project = freshProject;

  let framework = project.framework;
  if (framework === "UNKNOWN") {
    framework = await detectFramework(workDir);
    await prisma.project.update({
      where: { id: project.id },
      data: { framework },
    });
    await log(`Detected framework: ${framework}`);
  }

  const imageTag = `vps-hoster/${project.slug}:${deploymentId.slice(-8)}`;
  const useNixpacks = await shouldUseNixpacks(workDir, project.buildMethod);

  await setDeploymentStatus(deploymentId, "BUILDING");

  if (useNixpacks) {
    await log("Using Nixpacks buildpack...");
    await buildWithNixpacks(workDir, imageTag, log);
  } else {
    await ensureDockerfile(workDir, framework);
    await log("Building Docker image...");
    const buildStream = await buildImage(workDir, imageTag, project);
    await new Promise<void>((resolve, reject) => {
      getDocker().modem.followProgress(
        buildStream,
        (err) => (err ? reject(err) : resolve()),
        (event) => {
          if (event.stream) void log(event.stream.trim());
        }
      );
    });
  }

  const port = project.port || defaultPort(framework);

  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { imageTag },
  });

  await setDeploymentStatus(deploymentId, "STARTING");
  await prisma.project.update({
    where: { id: project.id },
    data: { status: "DEPLOYING" },
  });
  await log("Starting container...");

  await ensureNetwork();
  await stopExistingContainer(project.slug);

  const env = {
    ...parseEnvVars(project.envVars),
    ...addonEnvVars(project.addons),
  };
  if (project.buildCommand) env.BUILD_COMMAND = project.buildCommand;
  if (project.startCommand) env.START_COMMAND = project.startCommand;

  const labels = buildTraefikLabels(project.slug, port, project.domains);
  const containerName = `vps-hoster-${project.slug}`;

  const container = await getDocker().createContainer({
    name: containerName,
    Image: imageTag,
    Env: envArray(env),
    Labels: labels,
    ExposedPorts: { [`${port}/tcp`]: {} },
    HostConfig: {
      NetworkMode: config.network,
      RestartPolicy: { Name: "unless-stopped" },
    },
    NetworkingConfig: {
      EndpointsConfig: {
        [config.network]: {},
        [config.traefikNetwork]: {},
      },
    },
  });

  await container.start();

  const inspect = await container.inspect();
  const containerId = inspect.Id;

  await prisma.deployment.update({
    where: { id: deploymentId },
    data: {
      containerId,
      status: "SUCCESS",
      finishedAt: new Date(),
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "RUNNING" },
  });

  const primary = project.domains.find((d) => d.isPrimary);
  await log(`Deployed successfully → ${primary?.hostname ?? "see domains"}`);
}

async function shouldUseNixpacks(
  workDir: string,
  buildMethod: BuildMethod
): Promise<boolean> {
  if (buildMethod === "NIXPACKS") return true;
  if (buildMethod === "DOCKERFILE") return false;
  return !(await hasDockerfile(workDir));
}

async function buildImage(
  workDir: string,
  tag: string,
  project: Project
): Promise<NodeJS.ReadableStream> {
  const tar = await import("tar-fs");
  const stream = tar.pack(workDir);
  const buildOpts: Record<string, unknown> = { t: tag, rm: true };
  const buildargs: Record<string, string> = {};
  if (project.buildCommand) buildargs.BUILD_COMMAND = project.buildCommand;
  if (project.startCommand) buildargs.START_COMMAND = project.startCommand;
  if (Object.keys(buildargs).length > 0) buildOpts.buildargs = buildargs;

  return getDocker().buildImage(stream, buildOpts);
}

export async function stopProject(projectId: string): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  const docker = getDocker();
  const containerName = `vps-hoster-${project.slug}`;
  try {
    const container = docker.getContainer(containerName);
    await container.stop({ t: 10 });
    await container.remove({ force: true });
  } catch {
    // ignore
  }
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "STOPPED" },
  });
}

export async function getContainerLogs(slug: string, tail = 200): Promise<string> {
  const docker = getDocker();
  try {
    const container = docker.getContainer(`vps-hoster-${slug}`);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
    return logs.toString("utf-8");
  } catch {
    return "No container logs available.";
  }
}

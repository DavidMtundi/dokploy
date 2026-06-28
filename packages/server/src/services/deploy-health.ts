import { getBuildAppDirectory } from "@dokploy/server/utils/filesystem/directory";
import {
	parseRailwayToml,
	type RailwayTomlConfig,
} from "@dokploy/server/utils/railway-toml";
import fs from "node:fs";
import path from "node:path";
import type { Application } from "./application";
import { execAsync, execAsyncRemote } from "../utils/process/execAsync";

const DOKPLOY_NETWORK = "dokploy-network";
const DEFAULT_HEALTH_PATH = "/";
const DEFAULT_TIMEOUT_SEC = 120;
const POLL_INTERVAL_MS = 3000;

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveHealthPath(
	application: Application,
	railwayConfig: RailwayTomlConfig | null,
): string {
	if (railwayConfig?.deploy?.healthcheckPath) {
		const p = railwayConfig.deploy.healthcheckPath;
		return p.startsWith("/") ? p : `/${p}`;
	}

	const test = application.healthCheckSwarm?.Test;
	if (test?.length) {
		const joined = test.join(" ");
		const match = joined.match(/https?:\/\/[^/]+(\/[^\s"']*)/);
		if (match?.[1]) {
			return match[1];
		}
	}

	return DEFAULT_HEALTH_PATH;
}

function resolveTimeoutSec(railwayConfig: RailwayTomlConfig | null): number {
	const timeout = railwayConfig?.deploy?.healthcheckTimeout;
	if (typeof timeout === "number" && timeout > 0) {
		return timeout;
	}
	return DEFAULT_TIMEOUT_SEC;
}

function resolveTargetPort(application: Application, detected?: number): number {
	return (
		detected ??
		application.ports?.[0]?.targetPort ??
		application.domains?.[0]?.port ??
		3000
	);
}

async function readRailwayTomlForHealth(
	application: Application,
): Promise<RailwayTomlConfig | null> {
	const buildDir = getBuildAppDirectory(application);
	const tomlPath = path.join(buildDir, "railway.toml");
	const serverId = application.buildServerId || application.serverId;

	let content: string | null = null;
	if (serverId) {
		const { stdout } = await execAsyncRemote(
			serverId,
			`test -f ${JSON.stringify(tomlPath)} && cat ${JSON.stringify(tomlPath)} || true`,
		);
		content = stdout.trim() || null;
	} else if (fs.existsSync(tomlPath)) {
		content = fs.readFileSync(tomlPath, "utf8");
	}

	return content ? parseRailwayToml(content) : null;
}

async function probeHttp(
	appName: string,
	port: number,
	healthPath: string,
	serverId?: string | null,
): Promise<boolean> {
	const url = `http://${appName}:${port}${healthPath}`;
	const cmd = `docker run --rm --network ${DOKPLOY_NETWORK} curlimages/curl:8.5.0 -sf -o /dev/null -w "%{http_code}" ${JSON.stringify(url)}`;

	try {
		const { stdout } = serverId
			? await execAsyncRemote(serverId, cmd)
			: await execAsync(cmd);
		const code = Number.parseInt(stdout.trim(), 10);
		return code >= 200 && code < 400;
	} catch {
		return false;
	}
}

/**
 * Poll the running service over the dokploy overlay network before marking deploy success.
 */
export async function waitForDeployHealth(
	application: Application,
	options?: { detectedPort?: number; railwayConfig?: RailwayTomlConfig | null },
): Promise<void> {
	if (application.buildType === "static" || application.publishDirectory) {
		return;
	}

	const railwayConfig =
		options?.railwayConfig ?? (await readRailwayTomlForHealth(application));
	const healthPath = resolveHealthPath(application, railwayConfig);
	const timeoutSec = resolveTimeoutSec(railwayConfig);
	const port = resolveTargetPort(application, options?.detectedPort);
	const serverId = application.buildServerId || application.serverId;

	const deadline = Date.now() + timeoutSec * 1000;
	let lastError = `No healthy response on ${healthPath} (port ${port})`;

	while (Date.now() < deadline) {
		const healthy = await probeHttp(
			application.appName,
			port,
			healthPath,
			serverId,
		);
		if (healthy) {
			return;
		}
		lastError = `Service not healthy at http://${application.appName}:${port}${healthPath}`;
		await sleep(POLL_INTERVAL_MS);
	}

	throw new Error(
		`Deploy health check failed after ${timeoutSec}s: ${lastError}`,
	);
}

import fs from "node:fs";
import path from "node:path";
import { parse } from "toml";
import { execAsync, execAsyncRemote } from "./process/execAsync";

const DEFAULT_PORT = 3000;

export type PortDetectContext = {
	appName: string;
	buildDir: string;
	serverId?: string | null;
};

function parsePort(value: unknown): number | undefined {
	if (typeof value === "number" && value > 0 && value <= 65535) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number.parseInt(value, 10);
		if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 65535) {
			return parsed;
		}
	}
	return undefined;
}

function firstPortFromExposedPorts(
	exposed: Record<string, unknown> | null | undefined,
): number | undefined {
	if (!exposed) {
		return undefined;
	}
	for (const key of Object.keys(exposed)) {
		const port = Number.parseInt(key.split("/")[0] ?? "", 10);
		if (!Number.isNaN(port) && port > 0) {
			return port;
		}
	}
	return undefined;
}

/** Walk common Railway / Railpack / Nixpacks metadata shapes for a port. */
export function extractPortFromMetadata(
	data: unknown,
): number | undefined {
	if (!data || typeof data !== "object") {
		return undefined;
	}

	const root = data as Record<string, unknown>;
	const direct =
		parsePort(root.port) ??
		parsePort(root.PORT) ??
		parsePort(root.containerPort) ??
		parsePort(root.defaultPort);

	if (direct) {
		return direct;
	}

	for (const key of ["deploy", "start", "metadata", "info", "config"]) {
		const nested = root[key];
		if (nested && typeof nested === "object") {
			const port = extractPortFromMetadata(nested);
			if (port) {
				return port;
			}
		}
	}

	return undefined;
}

export function extractPortFromDockerInspectOutput(
	stdout: string,
): number | undefined {
	const trimmed = stdout.trim();
	if (!trimmed || trimmed === "null") {
		return undefined;
	}

	try {
		const parsed = JSON.parse(trimmed) as Record<string, unknown>;
		return firstPortFromExposedPorts(parsed);
	} catch {
		return undefined;
	}
}

async function readFileFromBuildDir(
	ctx: PortDetectContext,
	relativePath: string,
): Promise<string | null> {
	const filePath = path.join(ctx.buildDir, relativePath);

	if (ctx.serverId) {
		const { stdout } = await execAsyncRemote(
			ctx.serverId,
			`test -f ${JSON.stringify(filePath)} && cat ${JSON.stringify(filePath)} || true`,
		);
		const content = stdout.trim();
		return content.length > 0 ? content : null;
	}

	if (!fs.existsSync(filePath)) {
		return null;
	}

	return fs.readFileSync(filePath, "utf8");
}

async function inspectImagePort(
	appName: string,
	serverId?: string | null,
): Promise<number | undefined> {
	const cmd = `docker image inspect ${JSON.stringify(appName)} --format '{{json .Config.ExposedPorts}}' 2>/dev/null || true`;

	const { stdout } = serverId
		? await execAsyncRemote(serverId, cmd)
		: await execAsync(cmd);

	return extractPortFromDockerInspectOutput(stdout);
}

/**
 * Detect the container listen port after a build completes.
 * Priority: docker image EXPOSE → railpack-info.json → nixpacks config → PORT in railway.toml
 */
export async function detectApplicationPort(
	ctx: PortDetectContext,
): Promise<number | undefined> {
	const fromImage = await inspectImagePort(ctx.appName, ctx.serverId);
	if (fromImage && fromImage !== DEFAULT_PORT) {
		return fromImage;
	}

	const metadataFiles = [
		"railpack-info.json",
		".nixpacks/config.json",
		".nixpacks/plan.json",
	];

	for (const file of metadataFiles) {
		const content = await readFileFromBuildDir(ctx, file);
		if (!content) {
			continue;
		}
		try {
			const port = extractPortFromMetadata(JSON.parse(content));
			if (port) {
				return port;
			}
		} catch {
			// not json
		}
	}

	const nixpacksToml = await readFileFromBuildDir(ctx, ".nixpacks/config.toml");
	if (nixpacksToml) {
		try {
			const parsed = parse(nixpacksToml) as Record<string, unknown>;
			const port =
				parsePort(parsed.PORT) ??
				parsePort((parsed.variables as Record<string, unknown>)?.PORT);
			if (port) {
				return port;
			}
		} catch {
			// ignore
		}
	}

	return fromImage ?? undefined;
}

import fs from "node:fs";
import path from "node:path";
import { db } from "@dokploy/server/db";
import { applications } from "@dokploy/server/db/schema";
import { getBuildAppDirectory } from "@dokploy/server/utils/filesystem/directory";
import {
	mapRailwayBuilder,
	parseRailwayToml,
	railwayHealthCheckSwarm,
	railwayRestartPolicySwarm,
	type RailwayTomlConfig,
} from "@dokploy/server/utils/railway-toml";
import { eq } from "drizzle-orm";
import type { Application } from "./application";
import { execAsyncRemote } from "../utils/process/execAsync";

async function readRailwayTomlFile(
	application: Application,
): Promise<string | null> {
	const buildDir = getBuildAppDirectory(application);
	const tomlPath = path.join(buildDir, "railway.toml");
	const serverId = application.buildServerId || application.serverId;

	if (serverId) {
		const { stdout } = await execAsyncRemote(
			serverId,
			`test -f ${JSON.stringify(tomlPath)} && cat ${JSON.stringify(tomlPath)} || true`,
		);
		const content = stdout.trim();
		return content.length > 0 ? content : null;
	}

	if (!fs.existsSync(tomlPath)) {
		return null;
	}

	return fs.readFileSync(tomlPath, "utf8");
}

/**
 * Reads railway.toml from the cloned repo and applies build/deploy hints to the application.
 */
export async function applyRailwayTomlFromBuildDir(
	application: Application,
): Promise<RailwayTomlConfig | null> {
	const content = await readRailwayTomlFile(application);
	if (!content) {
		return null;
	}

	const config = parseRailwayToml(content);
	if (!config) {
		return null;
	}

	const updates: Partial<typeof applications.$inferInsert> = {};

	if (config.build?.builder) {
		const mapped = mapRailwayBuilder(config.build.builder);
		if (mapped) {
			updates.buildType = mapped as typeof applications.$inferInsert.buildType;
		}
	}

	if (config.deploy?.startCommand) {
		updates.command = config.deploy.startCommand;
	}

	if (config.deploy?.numReplicas !== undefined) {
		updates.replicas = config.deploy.numReplicas;
	}

	if (config.build?.watchPatterns?.length) {
		updates.watchPaths = config.build.watchPatterns;
	}

	const restartPolicy = railwayRestartPolicySwarm(
		config.deploy?.restartPolicyType,
		config.deploy?.restartPolicyMaxRetries,
	);
	if (restartPolicy) {
		updates.restartPolicySwarm = restartPolicy;
	}

	const targetPort =
		application.ports?.[0]?.targetPort ??
		application.domains?.[0]?.port ??
		3000;

	if (config.deploy?.healthcheckPath) {
		updates.healthCheckSwarm = railwayHealthCheckSwarm(
			config.deploy.healthcheckPath,
			targetPort,
		);
	}

	if (Object.keys(updates).length === 0) {
		return config;
	}

	await db
		.update(applications)
		.set(updates)
		.where(eq(applications.applicationId, application.applicationId));

	return config;
}

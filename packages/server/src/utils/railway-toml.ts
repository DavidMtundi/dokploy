import { parse } from "toml";

export type RailwayBuildConfig = {
	builder?: string;
	buildCommand?: string;
	watchPatterns?: string[];
};

export type RailwayDeployConfig = {
	startCommand?: string;
	healthcheckPath?: string;
	healthcheckTimeout?: number;
	restartPolicyType?: string;
	restartPolicyMaxRetries?: number;
	numReplicas?: number;
};

export type RailwayTomlConfig = {
	build?: RailwayBuildConfig;
	deploy?: RailwayDeployConfig;
};

const BUILDER_MAP: Record<string, string> = {
	nixpacks: "nixpacks",
	dockerfile: "dockerfile",
	railpack: "railpack",
	heroku: "heroku_buildpacks",
	paketo: "paketo_buildpacks",
	static: "static",
};

export function parseRailwayToml(content: string): RailwayTomlConfig | null {
	const trimmed = content.trim();
	if (!trimmed) {
		return null;
	}

	try {
		const raw = parse(trimmed) as Record<string, unknown>;
		const build = raw.build as RailwayBuildConfig | undefined;
		const deploy = raw.deploy as RailwayDeployConfig | undefined;

		if (!build && !deploy) {
			return null;
		}

		return { build, deploy };
	} catch {
		return null;
	}
}

export function mapRailwayBuilder(builder?: string): string | undefined {
	if (!builder) {
		return undefined;
	}
	return BUILDER_MAP[builder.toLowerCase()] ?? undefined;
}

export function railwayHealthCheckSwarm(
	healthcheckPath: string,
	targetPort: number,
) {
	const path = healthcheckPath.startsWith("/")
		? healthcheckPath
		: `/${healthcheckPath}`;

	return {
		Test: [
			"CMD",
			"wget",
			"--no-verbose",
			"--tries=1",
			"--spider",
			`http://127.0.0.1:${targetPort}${path}`,
		],
		Interval: 30_000_000_000,
		Timeout: 10_000_000_000,
		StartPeriod: 60_000_000_000,
		Retries: 3,
	};
}

export function railwayRestartPolicySwarm(
	restartPolicyType?: string,
	restartPolicyMaxRetries?: number,
) {
	if (!restartPolicyType) {
		return undefined;
	}

	const conditionMap: Record<string, string> = {
		never: "none",
		on_failure: "on-failure",
		always: "any",
	};

	const condition =
		conditionMap[restartPolicyType.toLowerCase().replace(/-/g, "_")] ??
		restartPolicyType.toLowerCase();

	return {
		Condition: condition,
		...(restartPolicyMaxRetries !== undefined && {
			MaxAttempts: restartPolicyMaxRetries,
		}),
	};
}

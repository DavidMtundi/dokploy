import {
	extractPortFromDockerInspectOutput,
	extractPortFromMetadata,
} from "@dokploy/server/utils/build-port-detect";
import {
	mapRailwayBuilder,
	parseRailwayToml,
	railwayHealthCheckSwarm,
} from "@dokploy/server/utils/railway-toml";
import { describe, expect, it } from "vitest";

describe("parseRailwayToml", () => {
	it("parses build and deploy sections", () => {
		const config = parseRailwayToml(`
[build]
builder = "RAILPACK"
watchPatterns = ["src/**"]

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 5
numReplicas = 2
`);

		expect(config?.build?.builder).toBe("RAILPACK");
		expect(config?.build?.watchPatterns).toEqual(["src/**"]);
		expect(config?.deploy?.startCommand).toBe("npm start");
		expect(config?.deploy?.healthcheckPath).toBe("/health");
		expect(config?.deploy?.numReplicas).toBe(2);
	});

	it("returns null for empty or invalid content", () => {
		expect(parseRailwayToml("")).toBeNull();
		expect(parseRailwayToml("not = valid [[[toml")).toBeNull();
	});
});

describe("mapRailwayBuilder", () => {
	it("maps Railway builder names to Dokploy build types", () => {
		expect(mapRailwayBuilder("NIXPACKS")).toBe("nixpacks");
		expect(mapRailwayBuilder("railpack")).toBe("railpack");
		expect(mapRailwayBuilder("unknown")).toBeUndefined();
	});
});

describe("railwayHealthCheckSwarm", () => {
	it("builds a wget-based health check", () => {
		const hc = railwayHealthCheckSwarm("/ready", 8080);
		expect(hc.Test).toContain("wget");
		expect(hc.Test?.join(" ")).toContain("http://127.0.0.1:8080/ready");
	});
});

describe("extractPortFromDockerInspectOutput", () => {
	it("reads the first exposed port", () => {
		expect(
			extractPortFromDockerInspectOutput('{"5000/tcp":{},"8080/tcp":{}}'),
		).toBe(5000);
	});

	it("returns undefined for empty inspect", () => {
		expect(extractPortFromDockerInspectOutput("null")).toBeUndefined();
	});
});

describe("extractPortFromMetadata", () => {
	it("finds nested deploy port", () => {
		expect(
			extractPortFromMetadata({ deploy: { port: 5000 } }),
		).toBe(5000);
	});

	it("finds top-level PORT", () => {
		expect(extractPortFromMetadata({ PORT: "8080" })).toBe(8080);
	});
});

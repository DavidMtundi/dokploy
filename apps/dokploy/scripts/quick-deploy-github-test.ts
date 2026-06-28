/**
 * E2E quick deploy — public GitHub HTTPS (same pipeline as GitHub App repos).
 * Run: cd apps/dokploy && pnpm exec tsx -r dotenv/config scripts/quick-deploy-github-test.ts
 */
import {
	createApplication,
	createDomain,
	createProject,
	deployApplication,
	findApplicationById,
	updateApplication,
} from "@dokploy/server";
import { db } from "@dokploy/server/db";
import { deployments, member } from "@dokploy/server/db/schema";
import { desc, eq } from "drizzle-orm";

const TEST_REPO = "https://github.com/heroku/node-js-getting-started.git";
const TEST_BRANCH = "main";
const POLL_MS = 5000;
const TIMEOUT_MS = 600_000;

async function getOrganizationId(): Promise<string> {
	const row = await db.query.member.findFirst({
		where: eq(member.role, "owner"),
	});
	if (!row?.organizationId) {
		throw new Error(
			"No owner organization — register at http://localhost:3000/register first",
		);
	}
	return row.organizationId;
}

async function waitForDeploy(applicationId: string) {
	const deadline = Date.now() + TIMEOUT_MS;
	while (Date.now() < deadline) {
		const deployment = await db.query.deployments.findFirst({
			where: eq(deployments.applicationId, applicationId),
			orderBy: [desc(deployments.createdAt)],
		});
		const status = deployment?.status;
		process.stdout.write(`\r  deploy status: ${status ?? "pending"}   `);
		if (status === "done") {
			console.log("\n  deploy finished: done");
			return deployment;
		}
		if (status === "error") {
			throw new Error(
				`Deploy failed — check logs in panel for ${applicationId}`,
			);
		}
		await new Promise((r) => setTimeout(r, POLL_MS));
	}
	throw new Error("Deploy timed out");
}

async function main() {
	console.log("== VPS Hoster quick deploy test (public GitHub repo) ==\n");

	const orgId = await getOrganizationId();
	const slug = `demo-${Date.now().toString(36)}`;

	const { environment } = await createProject(
		{ name: `Quick Deploy ${slug}`, description: "Railway-style smoke test" },
		orgId,
	);

	const app = await createApplication({
		name: "Node Getting Started",
		appName: `quick-${slug}`,
		description: "Heroku sample app",
		environmentId: environment.environmentId,
	});

	await updateApplication(app.applicationId, {
		sourceType: "git",
		customGitUrl: TEST_REPO,
		customGitBranch: TEST_BRANCH,
		buildType: "nixpacks",
		autoDeploy: false,
	});

	await createDomain({
		host: `${app.appName}.localhost`,
		applicationId: app.applicationId,
		port: 3000,
		https: false,
		domainType: "application",
		path: "/",
	});

	console.log(`Created application: ${app.appName}`);
	console.log(`Repository: ${TEST_REPO} @ ${TEST_BRANCH}`);
	console.log("Starting deploy...\n");

	await deployApplication({
		applicationId: app.applicationId,
		titleLog: "Quick deploy smoke test",
		descriptionLog: TEST_REPO,
	});

	await waitForDeploy(app.applicationId);

	const refreshed = await findApplicationById(app.applicationId);
	console.log(`\nApplication status: ${refreshed.applicationStatus}`);
	console.log(`Open: http://${app.appName}.localhost (Traefik :80)`);
	console.log(
		`Panel: http://localhost:3000/dashboard/project/${environment.projectId}/environment/${environment.environmentId}/services/application/${app.applicationId}`,
	);
	console.log("\nPASS: quick deploy test");
}

main().catch((err) => {
	console.error("\nFAIL:", err instanceof Error ? err.message : err);
	process.exit(1);
});

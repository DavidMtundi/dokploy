import { db } from "@dokploy/server/db";
import { domains, ports } from "@dokploy/server/db/schema";
import { detectApplicationPort } from "@dokploy/server/utils/build-port-detect";
import { getBuildAppDirectory } from "@dokploy/server/utils/filesystem/directory";
import { manageDomain } from "@dokploy/server/utils/traefik/domain";
import { eq } from "drizzle-orm";
import { findApplicationById, type Application } from "./application";
import { updatePortById } from "./port";

const DEFAULT_PORT = 3000;

/**
 * Sync domain and swarm port records when build metadata exposes a non-default port.
 */
export async function syncDetectedPortFromBuild(
	application: Application,
): Promise<number | undefined> {
	const serverId = application.buildServerId || application.serverId;
	const detected = await detectApplicationPort({
		appName: application.appName,
		buildDir: getBuildAppDirectory(application),
		serverId,
	});
	if (!detected || detected === DEFAULT_PORT) {
		return detected;
	}

	const currentDomainPort =
		application.domains?.[0]?.port ?? application.ports?.[0]?.targetPort;
	if (currentDomainPort && currentDomainPort !== DEFAULT_PORT) {
		return detected;
	}

	if (application.domains?.length) {
		for (const domain of application.domains) {
			if (domain.port === DEFAULT_PORT || domain.port === null) {
				await db
					.update(domains)
					.set({ port: detected })
					.where(eq(domains.domainId, domain.domainId));
			}
		}
	}

	if (application.ports?.length) {
		for (const port of application.ports) {
			if (port.targetPort === DEFAULT_PORT) {
				await updatePortById(port.portId, { targetPort: detected });
			}
		}
	}

	const refreshed = await findApplicationById(application.applicationId);
	for (const domain of refreshed.domains ?? []) {
		await manageDomain(refreshed, domain);
	}

	return detected;
}

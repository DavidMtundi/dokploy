import {
	getWebServerSettings,
	IS_CLOUD,
	updateWebServerSettings,
} from "@dokploy/server";
import {
	PRODUCT_META_TITLE,
	PRODUCT_NAME,
	PRODUCT_TAGLINE,
} from "@dokploy/server/constants/branding";
import { TRPCError } from "@trpc/server";
import { apiUpdateWhitelabeling } from "@/server/db/schema";
import {
	createTRPCRouter,
	enterpriseProcedure,
	protectedProcedure,
	publicProcedure,
} from "../../trpc";

export const whitelabelingRouter = createTRPCRouter({
	get: protectedProcedure.query(async () => {
		if (IS_CLOUD) {
			return null;
		}
		const settings = await getWebServerSettings();
		const config = settings?.whitelabelingConfig;
		return {
			appName: config?.appName ?? PRODUCT_NAME,
			appDescription: config?.appDescription ?? PRODUCT_TAGLINE,
			logoUrl: config?.logoUrl ?? null,
			faviconUrl: config?.faviconUrl ?? null,
			customCss: config?.customCss ?? null,
			loginLogoUrl: config?.loginLogoUrl ?? null,
			supportUrl: config?.supportUrl ?? null,
			docsUrl: config?.docsUrl ?? null,
			errorPageTitle: config?.errorPageTitle ?? null,
			errorPageDescription: config?.errorPageDescription ?? null,
			metaTitle: config?.metaTitle ?? PRODUCT_META_TITLE,
			footerText: config?.footerText ?? null,
		};
	}),

	update: enterpriseProcedure
		.input(apiUpdateWhitelabeling)
		.mutation(async ({ input, ctx }) => {
			if (IS_CLOUD) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Whitelabeling is not available in Cloud",
				});
			}

			if (ctx.user.role !== "owner") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only the owner can update whitelabeling settings",
				});
			}

			await updateWebServerSettings({
				whitelabelingConfig: input.whitelabelingConfig,
			});

			return { success: true };
		}),

	reset: enterpriseProcedure.mutation(async ({ ctx }) => {
		if (IS_CLOUD) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Whitelabeling is not available in Cloud",
			});
		}

		if (ctx.user.role !== "owner") {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Only the owner can reset whitelabeling settings",
			});
		}

		await updateWebServerSettings({
			whitelabelingConfig: {
				appName: null,
				appDescription: null,
				logoUrl: null,
				faviconUrl: null,
				customCss: null,
				loginLogoUrl: null,
				supportUrl: null,
				docsUrl: null,
				errorPageTitle: null,
				errorPageDescription: null,
				metaTitle: null,
				footerText: null,
			},
		});

		return { success: true };
	}),

	// Public endpoint only for unauthenticated pages (login, register, error)
	// Returns only the fields needed for public pages
	getPublic: publicProcedure.query(async () => {
		if (IS_CLOUD) {
			return null;
		}
		const settings = await getWebServerSettings();
		const config = settings?.whitelabelingConfig;

		return {
			appName: config?.appName ?? PRODUCT_NAME,
			appDescription: config?.appDescription ?? PRODUCT_TAGLINE,
			logoUrl: config?.logoUrl ?? null,
			loginLogoUrl: config?.loginLogoUrl ?? null,
			faviconUrl: config?.faviconUrl ?? null,
			customCss: config?.customCss ?? null,
			metaTitle: config?.metaTitle ?? PRODUCT_META_TITLE,
			errorPageTitle: config?.errorPageTitle ?? null,
			errorPageDescription: config?.errorPageDescription ?? null,
			footerText: config?.footerText ?? null,
		};
	}),
});

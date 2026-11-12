import { setupI18n } from "@lingui/core";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { getGlobalStartContext } from "@tanstack/react-start";
import { routerWithI18n } from "./libs/i18n";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const context = getGlobalStartContext();
	const i18n = context?.i18n ?? setupI18n();

	const createRouter = createTanStackRouter({
		routeTree,
		context: { i18n },
		scrollRestoration: true,
		defaultPreload: "intent",

		// rewrite: {
		// 	input: ({ url }) => deLocalizeUrl(url),
		// 	output: ({ url }) => localizeUrl(url),
		// },
	});

	const router = routerWithI18n(createRouter, i18n);

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}

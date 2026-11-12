import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { i18nServerEntry } from "./libs/i18n";

export default createServerEntry({
	async fetch(request) {
		// Only the redirect (/en/... → /...) is needed here: i18nMiddleware in
		// start.ts already sets the locale cookie on the response.
		const { redirect } = i18nServerEntry(request);
		if (redirect) {
			return redirect;
		}

		return handler.fetch(request);
	},
});

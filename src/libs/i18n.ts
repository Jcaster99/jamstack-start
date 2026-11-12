import type { I18n } from "@lingui/core";
import {
	createLinguiStart,
	type LocaleDefinition,
} from "@sourceking/tanstack-lingui";
import { defaultLocale, type Locale, locales } from "./locales";

export { defaultLocale, isLocale, type Locale, locales } from "./locales";

// _serverFn: server function RPCs carry no locale prefix and must not reset the cookie.
export const ignoredPaths = ["api", "rpc", "webhook", "_serverFn"];
export const cookieName = "locale";

async function loadMessages(locale: string) {
	const { messages } = await import(`../locales/${locale}.json?lingui`);
	return messages;
}

export const i18n = createLinguiStart({
	locales: [...locales] satisfies LocaleDefinition[],
	defaultLocale: defaultLocale,
	cookieName: cookieName,
	cookieMaxAge: 31536000,
	ignoredPaths: ignoredPaths,
	loadMessages,
	// Locale-prefixed URLs already re-run loaders on navigate; skip the extra invalidate.
	invalidateOnSwitch: false,
});

/**
 * Activates `locale` if the URL says something else than the active i18n
 * state (e.g. after browser back/forward across a language switch).
 */
export const ensureLocale = async (i18n: I18n, locale: Locale) => {
	if (i18n.locale !== locale) {
		i18n.loadAndActivate({ locale, messages: await loadMessages(locale) });
	}
};

export const {
	i18nServerEntry,
	i18nMiddleware,
	useLocale,
	LocalizedLink,
	localizePath,
	isValidLocale,
	routerWithI18n,
	createCookieHeader,
	stripLocalePrefix,
} = i18n;

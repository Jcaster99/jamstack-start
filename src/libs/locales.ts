// Framework-free locale constants, safe to import from content-collections config.
// Codes must be two lowercase letters: the URL prefix matcher only accepts /[a-z]{2}/.
// Keep in sync with lingui.config.ts and public/admin/config.yml (i18n.locales).
export const locales = [
	{ code: "en", name: "English", nativeName: "English" },
	{ code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文" },
	{ code: "ja", name: "Japanese", nativeName: "日本語" },
	{ code: "th", name: "Thai", nativeName: "ไทย" },
	{ code: "es", name: "Spanish", nativeName: "Español" },
] as const;

export type Locale = (typeof locales)[number]["code"];

export const defaultLocale: Locale = "en";

export const isLocale = (value: string): value is Locale =>
	locales.some((locale) => locale.code === value);

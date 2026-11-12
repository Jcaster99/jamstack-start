import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-json";

export default defineConfig({
	sourceLocale: "en",
	locales: ["en", "zh", "ja", "th", "es"],
	catalogs: [
		{
			path: "<rootDir>/src/locales/{locale}",
			include: ["<rootDir>/src/**"],
			exclude: ["**/node_modules/**"],
		},
	],
	format: formatter({ style: "minimal" }),
});

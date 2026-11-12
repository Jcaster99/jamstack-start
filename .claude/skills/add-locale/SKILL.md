---
name: add-locale
description: Add, remove or change a site language/locale (e.g. add French "fr", drop Thai "th", change the default) across the locale list, Lingui config, translation catalogs, Sveltia CMS i18n config and translated content folders. Use when asked to support a new language or remove one.
---

# Add or remove a locale

Locale codes must be **exactly two lowercase letters** (`fr`, `de`, `ko`). The URL prefix matcher in `@sourceking/tanstack-lingui` only accepts `/[a-z]{2}/`, so `zh-TW` or `pt-BR` will not route. Pick a two-letter code. If two variants of one language are needed, that needs a library change first: stop and ask.

The default locale (`en`) has no URL prefix and its catalog is the Lingui source.

## Add a locale (example: `fr`)

1. **`src/libs/locales.ts`**: add an entry. `nativeName` is shown in the language switcher.
   ```ts
   { code: "fr", name: "French", nativeName: "Français" },
   ```
2. **`lingui.config.ts`**: add `"fr"` to `locales`.
3. **Catalog**: run `bun run i18n:extract`. This creates `src/locales/fr.json` with empty values. Translate every entry (see the `i18n-lingui` skill).
4. **CMS**: in `public/admin/config.yml`, add `fr` to `i18n.locales`.
5. **Content**: for each translated collection (currently `posts`), add `content/posts/fr/<slug>.md` for the existing slugs. Copy the `en` file, translate `title`, `summary` and the body, and keep `date`, `author`, `cover` and `draft` identical. Missing translations fall back to `en` at runtime, but the CMS expects every locale.
<!-- template-repo:start -->
6. If this repo is the template source, add the new sample files and folder to `SAMPLE_FILES` / `SAMPLE_DIRS` in `packages/create-template/index.js`.
<!-- template-repo:end -->
7. Update the locale list in `README.md` (Localization section) and in `AGENTS.md` ("Locales:").

## Remove a locale (example: `th`)

1. Remove it from `src/libs/locales.ts`, `lingui.config.ts` and `i18n.locales` in `public/admin/config.yml`.
2. Delete `src/locales/th.json` and `content/posts/th/` (and the same folder in any other translated collection).
3. Remove it from `README.md` and `AGENTS.md`.
<!-- template-repo:start -->
   In the template repo, also remove it from `SAMPLE_FILES` / `SAMPLE_DIRS` in `packages/create-template/index.js`.
<!-- template-repo:end -->
4. `grep -rn '"th"\|/th/' src content public` to catch leftovers.

A post left in a folder for a removed locale makes the build fail on purpose (`parseLocalePath` rejects unknown locales).

## Verify

```bash
bun run i18n:check        # every catalog complete
bun run validate:cms
bun run typecheck && bun run check && bun run build
```

Then run `bun dev` and check `/fr`, `/fr/posts` and the language switcher. Switching languages and then pressing browser back/forward should keep UI, content and `<html lang>` in sync with the URL.

Note: `Intl` formats dates per locale (`formatDate` in `src/libs/intl.ts`). For example, `th` uses the Buddhist calendar year by default. To force Gregorian, pass a locale such as `th-TH-u-ca-gregory`.

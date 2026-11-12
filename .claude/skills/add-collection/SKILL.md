---
name: add-collection
description: Add a new CMS-managed content collection (e.g. projects, events, pages) end to end - zod schema in src/content, registration in content-collections.ts, matching Sveltia CMS collection in public/admin/config.yml, server functions in src/server and routes. Use when asked to add a new content type or make something editable in the CMS.
---

# Add a content collection

A collection has four parts that must agree: **data folder**, **zod schema**, **CMS config**, **server functions**. Use `posts` (translated, Markdown) or `authors` (single language, YAML) as the reference. Library details and pitfalls are in the `content-collections` skill.

First decide:
- **Translated?** Translated collections use `content/<name>/<locale>/<slug>.md` (CMS `i18n: true`). Untranslated ones use `content/<name>/<slug>.yaml|md`.
- **Body?** Use Markdown with frontmatter if there is long text (`parser: "frontmatter"`). Use YAML for data only (`parser: "yaml"`).

## 1. Schema: `src/content/<name>.ts`

```ts
import { defineCollection } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import rehypeSanitize from "rehype-sanitize";
import { z } from "zod";
import { isoDate, optionalString, parseLocalePath } from "./helpers";

export const projects = defineCollection({
	name: "projects",
	directory: "content/projects",
	include: "**/*.md",
	parser: "frontmatter",
	schema: z.object({
		title: z.string(),
		summary: optionalString(),
		date: isoDate(),
		content: z.string(),
	}),
	transform: async (doc, context) => {
		const parsed = parseLocalePath(doc._meta.path); // translated collections only
		if (!parsed) {
			throw new Error(`"${doc._meta.filePath}" must be content/projects/<locale>/<slug>.md`);
		}
		const html = await compileMarkdown(context, doc, { rehypePlugins: [rehypeSanitize] });
		const { content: _content, ...rest } = doc;
		return { ...rest, ...parsed, html };
	},
});
```

Rules:
- This file runs at build time in Node, outside Vite. Import only framework-free modules (`./helpers`, `../libs/locales`), never `#/libs/i18n` or React.
- Optional CMS fields arrive as `""`: use `optionalString()`, `optionalUrl()` and `optionalEmail()`. For dates use `isoDate()`.
- For an untranslated collection, use `slug: doc._meta.path` instead of `parseLocalePath`.
- To reference another collection, store its slug and resolve it in `transform` with `context.documents(other).find((d) => d._meta.path === doc.ref)`. Throw if it is missing. `documents()` returns pre-transform data, so match on `_meta.path`.
- Always keep `rehypeSanitize` on Markdown.

## 2. Register in `content-collections.ts`

```ts
import { projects } from "./src/content/projects";
export default defineConfig({ content: [authors, posts, projects] });
```

Run `bunx content-collections build`. `allProjects` is then importable from `content-collections`.

## 3. CMS: `public/admin/config.yml`

Add a collection with the **same folder and fields** (widget ↔ zod mapping: `.claude/skills/sveltia-cms/fields.md`). Translated example (mirror of `posts`):

```yaml
  - name: "projects"
    label: "Projects"
    folder: "content/projects"
    slug: "{{slug}}"
    create: true
    extension: md
    format: frontmatter
    i18n: true
    fields:
      - { label: "Title", name: "title", widget: "string", i18n: true }
      - { label: "Summary", name: "summary", widget: "text", required: false, i18n: true }
      - { label: "Date", name: "date", widget: "datetime", output_utc: true, i18n: duplicate }
      - { label: "Body", name: "body", widget: "markdown", i18n: true }
```

- `body` (markdown widget) becomes the file body, which the schema reads as `content`.
- Match the validation on both sides: `type: url` / `type: email` on string widgets that the schema checks with `optionalUrl()` / `optionalEmail()`. Use `output_utc: true` on datetimes.
- Relations: `widget: relation`, `collection: authors`, `value_field: "{{slug}}"`.
- Run `bun run validate:cms`.

## 4. Server functions: `src/server/<name>.ts`

Never import `content-collections` in routes or components. Copy the pattern from `src/server/posts.ts`:

```ts
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { allProjects } from "content-collections";
import { z } from "zod";
import { isLocale, type Locale } from "#/libs/locales";

const localeSchema = z.custom<Locale>((v) => typeof v === "string" && isLocale(v));

export const getProject = createServerFn({ method: "GET" })
	.validator(z.object({ locale: localeSchema, slug: z.string() }))
	.handler(({ data }) => {
		const project = allProjects.find((p) => p.slug === data.slug && p.locale === data.locale);
		if (!project) throw notFound();
		const { _meta, ...rest } = project;
		return rest;
	});
```

Return only what the page needs. For translated collections, reuse the fallback-to-default-locale logic from `pickTranslation` in `src/server/posts.ts`.

## 5. Routes, sample content, verify

1. Add routes with the `add-page` skill (loader → server function, `lang={item.locale}` on the content element).
2. Add at least one sample file per locale under `content/<name>/`.
<!-- template-repo:start -->
3. If this repo is the template source and the sample content should be removable, add it to `SAMPLE_FILES` / `SAMPLE_DIRS` in `packages/create-template/index.js`.
<!-- template-repo:end -->
4. Run `bun run typecheck && bun run check && bun run validate:cms && bun run i18n:check && bun run build`.

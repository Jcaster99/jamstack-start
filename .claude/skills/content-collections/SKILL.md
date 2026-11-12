---
name: content-collections
description: >
  Reference for Content Collections (@content-collections/core 0.15, the
  sdorra library, not Astro content collections) as used in this repo: how
  defineCollection/defineSingleton, parsers, zod schemas, transforms (context.
  documents/cache/skip), Markdown compilation and the generated
  "content-collections" module work, plus the repo's conventions and pitfalls.
  Use when reading or changing src/content/*, content-collections.ts or files
  under content/, or when a content build error appears.
---

# Content Collections

Content Collections reads files from `content/`, validates them with a schema, runs a `transform`, and writes typed JavaScript into `.content-collections/generated/` (gitignored). The app imports that output as the module `content-collections`.

- Version: `@content-collections/core` 0.15 with `@content-collections/vite` and `@content-collections/markdown`. This is **not** Astro's content collections, so Astro docs and APIs (`getCollection`, `defineCollection` from `astro:content`) do not apply.
- Config: `content-collections.ts` at the repo root registers the collections defined in `src/content/<name>.ts`.
- Generation runs in `bun dev` / `bun run build` (Vite plugin, with watch mode in dev) and standalone through `bunx content-collections build`. `bun run typecheck` runs it first.
- To add a whole new content type end to end (schema + CMS + server function + routes), use the `add-collection` skill. This skill is the library reference.

## Defining a collection

```ts
import { defineCollection } from "@content-collections/core";
import { z } from "zod";

export const authors = defineCollection({
	name: "authors",                    // generated export: allAuthors, type: Author
	directory: "content/authors",       // relative to the repo root
	include: "**/*.{yaml,yml}",         // glob or array of globs
	// exclude: "drafts/**",
	parser: "yaml",                     // see Parsers
	schema: z.object({ name: z.string() }),
	transform: (doc) => ({ ...doc, slug: doc._meta.path }),
	// onSuccess: (documents) => { ... }  // after the collection is built
});
```

| Option | Notes |
|---|---|
| `name` | Export name is `all` + the pluralized, capitalized name (`posts` → `allPosts`); the type is the singular PascalCase name (`Post`). |
| `directory`, `include`, `exclude` | Which files belong to the collection. |
| `parser` | `"frontmatter"` (default: YAML frontmatter + body as `content`), `"frontmatter-only"`, `"yaml"`, `"json"`, or a custom `{ hasContent, parse }`. |
| `schema` | Any Standard Schema; this repo uses **zod 4** (`z.object(...)`). Validates the parsed data before `transform`. |
| `transform` | `(doc, context) => newDoc` (may be async). Its return value is what the app receives. It must be serializable: no functions, class instances or Dates (store ISO strings). |
| `typeName` | Overrides the generated type name. |

With `parser: "frontmatter"`, **declare `content: z.string()` in the schema**. Implicitly adding `content` is deprecated and prints `[CC DEPRECATED]`.

Every document has `_meta`: `{ filePath, fileName, directory, path, extension }`. `path` is the path relative to `directory` **without the extension** (`en/hello-world`). This repo uses it as the slug source.

### Singletons

For a single file (site settings, a home page):

```ts
import { defineSingleton } from "@content-collections/core";

export const settings = defineSingleton({
	name: "settings",
	filePath: "content/settings.yaml",
	parser: "yaml",
	schema: z.object({ siteTitle: z.string() }),
	// optional: true → the export may be undefined if the file is missing
});
```

The generated export is the camelCased singular type name: `name: "settings"` → type `Setting`, export `setting`. Set `typeName` if that reads badly. Register singletons in `content` like collections.

## The transform context

```ts
transform: async (doc, context) => {
	context.documents(authors);           // all documents of another collection
	context.cache(input, compute);        // memoize expensive work across builds
	context.skip("reason");               // drop this document (return the signal)
	context.collection.name / .directory; // current collection
}
```

- **`context.documents(other)` returns pre-transform documents** (schema output + `_meta`), not what `other`'s transform returns. Match references on `_meta.path`, not on fields a transform adds (e.g. `slug`). See `src/content/posts.ts`.
- `return context.skip("reason")` excludes a document and only logs. For content that is wrong, prefer `throw new Error("...")`: the build then fails loudly (in `bun dev` it is logged and the document is dropped).
- `context.cache(input, fn)` caches by input; `compileMarkdown` already uses it.

## Markdown

```ts
import { compileMarkdown } from "@content-collections/markdown";
import rehypeSanitize from "rehype-sanitize";

const html = await compileMarkdown(context, doc, {
	rehypePlugins: [rehypeSanitize],     // required in this repo
	// remarkPlugins: [remarkGfm],
	// allowDangerousHtml: false (default)
});
```

- `compileMarkdown` takes `{ _meta, content }` and returns an HTML string. By default raw HTML in the Markdown is dropped, but `javascript:` link URLs survive, which is why `rehype-sanitize` is mandatory: the HTML is rendered with `dangerouslySetInnerHTML`.
- Return `html` and drop the raw `content` from the transform result, so the bundle only carries what is rendered.
- MDX needs `@content-collections/mdx` (not installed). Prefer Markdown unless components inside content are required.

## Using the generated data

```ts
import { allPosts, type Post } from "content-collections";
```

- In this repo, import `content-collections` **only in `src/server/*`** (inside `createServerFn` handlers). Importing it in a route or component bundles every document into client JavaScript.
- The alias comes from the Vite plugin. `tsconfig.json` maps the same path for `tsc`, so the types exist only after a generation run: run `bunx content-collections build` (or `bun run typecheck`) when `Cannot find module 'content-collections'` appears.
- Never edit `.content-collections/`, and never commit it.

## Repo conventions

- Schemas live in `src/content/<name>.ts`. Shared zod helpers are in `src/content/helpers.ts`:
  - `optionalString()`, `optionalUrl()`, `optionalEmail()`: Sveltia CMS saves cleared optional fields as `""`, and these turn `""` into `undefined` (with validation).
  - `isoDate()`: accepts YAML dates and strings, treats date-times without an offset as UTC, and outputs an ISO string. Format with `formatDate()` from `#/libs/intl`.
  - `parseLocalePath(_meta.path)`: splits `<locale>/<slug>` for translated collections, and returns `undefined` for unknown locales or nested paths (throw in that case).
- `src/content/*` is bundled by Content Collections with esbuild and runs in Node at build time, **outside Vite**. Import only framework-free code (`./helpers`, `../libs/locales`). Never import `#/libs/i18n`, React, `import.meta.env` or `?lingui` modules. Use relative imports.
- Translated collections follow Sveltia's `i18n.structure: multiple_folders`: `content/<name>/<locale>/<slug>.<ext>`. The same slug across locale folders is one translated item.
- Every collection has a twin in `public/admin/config.yml` (same folder, extension and fields, matching validation). Change both together, then run `bun run validate:cms`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Validation failed on content/...: - field: ...` | The file does not match the zod schema. Fix the content, or relax the schema *and* the CMS field together. |
| `[CC DEPRECATED]: The implicit addition of a content property` | Add `content: z.string()` to a frontmatter schema. |
| `Cannot find module 'content-collections'` (tsc) | Not generated yet: `bunx content-collections build`. |
| `Property 'slug' does not exist` on `context.documents(...)` items | Pre-transform data: use `_meta.path`. |
| A new document does not show in `bun dev` | Check the dev server log: a thrown transform error drops the document in dev instead of failing. |
| Dates shift by hours between machines | Value without an offset parsed in local time: use `isoDate()`, and `output_utc: true` on the CMS datetime field. |
| Build error after removing a locale | Files left in `content/<name>/<removed-locale>/`: delete them (see the `add-locale` skill). |

## Verify

```bash
bunx content-collections build    # fast: schema + transform only
bun run typecheck && bun run check && bun run build
bun run validate:cms              # if the CMS config changed
```

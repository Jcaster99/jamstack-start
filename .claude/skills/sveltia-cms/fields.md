# Sveltia field ↔ zod mapping

Sveltia 0.213 field types: `boolean`, `code`, `color`, `compute`, `datetime`, `file`, `hidden`, `image`, `keyvalue`, `list`, `map`, `markdown`, `number`, `object`, `relation`, `richtext`, `select`, `string`, `text`, `uuid`.

Every visible field also accepts `label`, `hint`, `comment`, `required` (default `true`), `readonly`, `preview` and `pattern: [regex, message]`. Translated collections add `i18n: true | duplicate | false` per field.

Helpers come from `src/content/helpers.ts`.

| CMS field | Stored as | zod |
|---|---|---|
| `{ widget: string }` (required) | `"text"` | `z.string()` |
| `{ widget: string, required: false }` | `"text"` or `""` | `optionalString()` |
| `{ widget: string, type: url, required: false }` | `"https://…"` or `""` | `optionalUrl()` |
| `{ widget: string, type: email, required: false }` | `"a@b.c"` or `""` | `optionalEmail()` |
| `{ widget: text }` | multi-line string | `z.string()` / `optionalString()` |
| `{ widget: markdown, name: body }` in `format: frontmatter` | file body | `content: z.string()` + `compileMarkdown(..., { rehypePlugins: [rehypeSanitize] })` |
| `{ widget: markdown }` with another name | frontmatter string | `z.string()`; compile it yourself if rendered |
| `{ widget: datetime, output_utc: true }` | `2026-10-22T07:30:00Z` | `isoDate()` |
| `{ widget: datetime, type: date }` | `2026-10-22` | `isoDate()` (date-only is read as UTC midnight) |
| `{ widget: boolean, default: false }` | `true` / `false` | `z.boolean().default(false)` |
| `{ widget: number, value_type: int }` | `42` | `z.number().int()` |
| `{ widget: number, value_type: float }` | `4.2` | `z.number()` |
| `{ widget: select, options: [a, b] }` | `"a"` | `z.enum(["a", "b"])` |
| `{ widget: select, multiple: true, options: [...] }` | `["a", "b"]` | `z.array(z.enum([...]))` |
| `{ widget: image, required: false }` | `/uploads/x.png` or `""` | `optionalString()` |
| `{ widget: image, multiple: true }` | `["/uploads/a.png", …]` | `z.array(z.string())` |
| `{ widget: file }` | `/uploads/x.pdf` | `z.string()` / `optionalString()` |
| `{ widget: relation, collection: authors, value_field: "{{slug}}" }` | `"jane-doe"` | `z.string()`, resolved in the transform via `context.documents(authors)` + `_meta.path` |
| `{ widget: relation, multiple: true, ... }` | `["a", "b"]` | `z.array(z.string())` |
| `{ widget: list, field: { widget: string, name: tag } }` | `["a", "b"]` | `z.array(z.string()).default([])` |
| `{ widget: list, fields: [...] }` | `[{ … }, …]` | `z.array(z.object({ … })).default([])` |
| `{ widget: object, fields: [...] }` | `{ … }` | `z.object({ … })` |
| `{ widget: color }` | `"#ff0000"` | `z.string().regex(/^#[0-9a-f]{6}$/i)` |
| `{ widget: hidden, default: … }` | the default | the matching type |
| `{ widget: uuid }` | `"0f8f…"` | `z.uuid()` |

## Validation in both places

Validate on both sides: the CMS shows errors to editors, and zod protects the build.

```yaml
- label: "Website"
  name: "website"
  widget: "string"
  type: "url"
  required: false
  hint: "Full URL, e.g. https://example.com"
- label: "Slug-safe code"
  name: "code"
  widget: "string"
  pattern: ["^[a-z0-9-]+$", "Lowercase letters, digits and dashes only"]
```

```ts
website: optionalUrl(),
code: z.string().regex(/^[a-z0-9-]+$/),
```

## Singletons (one-off pages or settings)

Sveltia's top-level `singletons:` edits single files. Pair each one with `defineSingleton` in Content Collections:

```yaml
singletons:
  - name: "settings"
    label: "Site settings"
    file: "content/settings.yaml"
    fields:
      - { label: "Site title", name: "siteTitle", widget: "string" }
```

```ts
export const settings = defineSingleton({
	name: "settings",
	filePath: "content/settings.yaml",
	parser: "yaml",
	schema: z.object({ siteTitle: z.string() }),
}); // generated export: `setting`
```

A relation to a singleton uses `collection: _singletons` plus `file: <name>`.

## Useful collection options

`folder`, `extension`, `format`, `slug`, `create`, `delete`, `identifier_field` (when there is no `title` field), `summary` (list template, e.g. `"{{title}} — {{date | date('YYYY-MM-DD')}}"`), `sortable_fields`, `view_filters`, `view_groups`, `filter`, `media_folder` / `public_folder` (per collection), `editor: { preview: false }`, `i18n: true`.

Full reference: https://sveltiacms.app/en/docs. Types for the pinned version: `https://unpkg.com/@sveltia/cms@<version>/types/public.d.ts`.

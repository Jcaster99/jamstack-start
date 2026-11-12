---
name: sveltia-cms
description: >
  Set up, configure, extend and troubleshoot Sveltia CMS (/admin) in this repo:
  first-time GitHub OAuth setup, editing locally without login, config.yml
  collections/fields/i18n/media, keeping config.yml in sync with the zod
  schemas, custom editor components, upgrading the pinned version (SRI), and
  fixing login/commit problems. Use when working on public/admin/*, the OAuth
  proxy in src/routes/api/auth, or when editors cannot log in or save content.
---

# Sveltia CMS

Sveltia CMS is a Git-based CMS: a single-page app at `/admin` that edits the files in `content/` and commits them to GitHub. There is no database. The site reads the committed files at build time through Content Collections (see the `content-collections` skill).

## How it is wired in this repo

| Piece | File | Notes |
|---|---|---|
| CMS app | `public/admin/index.html` | Loads Sveltia from unpkg, **pinned to a version with an SRI hash**. `CMS_MANUAL_INIT` + `CMS.init({ config })` merges runtime config over `config.yml`. Registers the custom editor components. |
| Config | `public/admin/config.yml` | Backend, media, i18n, collections and fields. Validated by `bun run validate:cms` against `schema.json` (the JSON schema of the pinned version). |
| OAuth proxy | `src/routes/api/auth/index.ts`, `callback.ts`, `src/libs/auth.ts` | GitHub/GitLab OAuth on the **same origin** as `/admin`: the `state` cookie is checked, and the token is posted only to the site origin. |
| Runtime `base_url` | `index.html` → `backend.base_url = window.location.origin` | So login always hits this deployment's `/api/auth`, whatever the domain. |
| Content | `content/<collection>/...` | Read by `src/content/*.ts` (zod). **Every CMS collection has a zod twin** that must match. |
| Media | `media_folder: public/uploads`, `public_folder: /uploads` | Uploaded files are committed to `public/uploads/` and served as `/uploads/<file>`. |
| Workflow | `publish_mode: editorial_workflow` | Drafts and reviews become branches/PRs in GitHub (`cms/...`); "Publish" merges them. |
| i18n | `i18n.structure: multiple_folders`, `locales: [en, zh, ja, th, es]` | Translated collections write `content/<name>/<locale>/<slug>.md`. Keep in sync with `src/libs/locales.ts` (see the `add-locale` skill). |

## First-time setup (real GitHub login)

1. Set `backend.repo` in `public/admin/config.yml` to the GitHub `owner/repo` that holds this site, and `branch` to the production branch. Run `bun run validate:cms`.
2. Create a **GitHub OAuth App** (GitHub → Settings → Developer settings → OAuth Apps):
   - Homepage URL: `https://<site-origin>`
   - Authorization callback URL: `https://<site-origin>/api/auth/callback?provider=github`
   - One OAuth App per origin: local (`http://localhost:3000`), workers.dev, custom domain.
3. Provide the secrets:
   - Locally: `.dev.vars` (copy `.dev.vars.example`) with `OAUTH_GITHUB_CLIENT_ID` and `OAUTH_GITHUB_CLIENT_SECRET`.
   - Production: platform secrets (Cloudflare: `bunx wrangler secret put OAUTH_GITHUB_CLIENT_ID` and the same for `OAUTH_GITHUB_CLIENT_SECRET`; for other hosts see the `deploy` skill).
4. Open `/admin/` (with the trailing slash) → "Sign in with GitHub". Editors need write access to the repo, or `open_authoring` for fork-based PRs.

On a static host (GitHub Pages), `/api/auth` cannot run. Use an external proxy or "Sign in with token" (see `.claude/skills/deploy/github-pages.md`).

## Editing locally without login (recommended for development)

Sveltia can edit the working copy directly. It needs no OAuth, secrets or proxy.

1. Run `bun dev`.
2. Open `http://localhost:3000/admin/index.html` in a **Chromium browser** (Chrome, Edge, or Brave with `brave://flags/#file-system-access-api` enabled). Firefox and Safari are not supported.
3. Click **"Work with Local Repository"** and select the repo root.
4. Edits are written to `content/` and `public/uploads/`. The dev server picks them up (Content Collections watches files). Commit with git yourself: by default the CMS only writes files. Auto-commit can be enabled under Settings → Developer, but it skips git hooks.
5. Reload the CMS after changing `config.yml` or pulling.

This is the fastest way to test a config change: edit `config.yml`, reload `/admin/index.html`, and create an entry.

## Changing the content model

A field or collection change always touches **three places**. Change them together:

1. `public/admin/config.yml`: the collection or field.
2. `src/content/<collection>.ts`: the zod schema (and transform). Use the widget ↔ zod mapping in [fields.md](fields.md).
3. Existing files in `content/`: migrate them if a field became required or changed type. Otherwise the content build fails with `Validation failed on content/...`.

Then run:

```bash
bun run validate:cms && bunx content-collections build && bun run typecheck && bun run build
```

For a brand-new collection (server function and routes too), use the `add-collection` skill.

Rules that keep CMS output and schema compatible:
- Optional fields are saved as `""` when cleared, so use `optionalString()`, `optionalUrl()` and `optionalEmail()` on the zod side.
- String fields validated as URL or email in zod need `type: url` or `type: email` in the CMS, so editors get the error in the UI instead of a broken build.
- Datetimes use `output_utc: true` (stored with `Z`) paired with `isoDate()`.
- A `markdown` field named `body` in a `format: frontmatter` collection becomes the file body, which zod reads as `content`.
- Relations store the target's file slug (`value_field: "{{slug}}"`), resolved in the transform via `_meta.path`.
- Translated collections need `i18n: true` on the collection, and each field sets `i18n: true` (translated) or `i18n: duplicate` (same value copied to all locales). Fields left without `i18n` are only editable in the default locale. Non-default locale files then miss them, and zod fails if they are required.
- Slugs: `slug: "{{slug}}"` uses the identifier field (`title`, else `name`), with `clean_accents`, lowercase and `-` (global `slug:` options). The file name becomes the URL, so changing a slug later breaks links.

## Custom editor components

`public/admin/index.html` registers components for the Markdown editor with `CMS.registerEditorComponent({ id, label, fields, pattern, fromBlock, toBlock, toPreview })`. A component only controls **what text is written into the Markdown**. The site renders that Markdown with `compileMarkdown` + `rehype-sanitize`, so:

- Output standard Markdown that the pipeline already renders (the `code` component writes fenced code blocks, which is fine).
- Anything else needs a matching remark/rehype plugin in `src/content/*.ts`, plus an allowlist in the sanitize schema. Otherwise it shows up as raw text or is stripped.
- Known gap: the `youtube` component writes a Hugo shortcode (`{{< youtube id="…" >}}`) that nothing renders. Remove it, or implement a remark plugin that turns it into an embed. Embeds also need a sanitize allowlist for `iframe` on `youtube-nocookie.com`.

## Upgrading Sveltia

The script is pinned with Subresource Integrity, so a version bump has to update the hash too:

```bash
V=0.214.0   # new version
curl -sf "https://unpkg.com/@sveltia/cms@$V/dist/sveltia-cms.js" -o /tmp/sveltia.js
echo "sha384-$(openssl dgst -sha384 -binary /tmp/sveltia.js | openssl base64 -A)"
curl -sf "https://unpkg.com/@sveltia/cms@$V/schema/sveltia-cms.json" -o schema.json
```

1. In `public/admin/index.html`, update the version in `src` and set `integrity` to the printed hash.
2. In `public/admin/config.yml`, update the version in the `# yaml-language-server: $schema=` header.
3. Run `bun run validate:cms`, then open `/admin/`, log in and save a test entry. Read the Sveltia release notes for breaking config changes.

A wrong hash makes the browser refuse to run the script, and `/admin` stays blank (the console shows an integrity error).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/admin` is a blank page | SRI mismatch after editing the script tag (console: "Failed to find a valid digest"). Recompute the hash. |
| `/admin` returns 404 | Use `/admin/` (trailing slash) or `/admin/index.html`. |
| Login popup opens `api.netlify.com` | `base_url` missing: the `CMS.init({ config: { backend: { base_url } } })` block was removed from `index.html`. |
| Popup shows "OAuth is not configured" (500) | `OAUTH_GITHUB_CLIENT_ID` / `_SECRET` not set for this environment. |
| Popup shows "Invalid OAuth state" (401) | The flow took longer than 10 minutes, cookies are blocked, or it was opened on another origin. Retry from `/admin/` on the same origin. |
| Popup stays open, nothing happens | The opener origin does not match the callback origin (e.g. `localhost` vs `127.0.0.1`, or `www` vs apex). Use exactly the origin registered in the OAuth App. |
| GitHub says "redirect_uri is not associated" | The OAuth App callback URL does not match `https://<origin>/api/auth/callback?provider=github`. |
| "Not Found" / 404 when loading entries | `backend.repo` or `branch` is wrong, or the user lacks access to the repo. |
| Saved in CMS, but the site does not change | Editorial workflow: the entry is still a draft/PR. Publish it. Then the site must rebuild and redeploy (CI on push to `main`). |
| Site build fails after a CMS save | The content does not match zod (see the error file path). Align the CMS field validation with the schema (fields.md). |
| A new locale's entries miss fields | The field lacks `i18n: true` / `duplicate`, so it was only written to the default locale. |

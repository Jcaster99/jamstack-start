# TanStack Start i18n CMS Template

A modern, full-stack template combining the power of **TanStack Start**, **LinguiJS** for internationalization, and **Sveltia CMS** for Git-based content management. It provides a robust, type-safe foundation for building multilingual blogs, portfolios, and marketing sites with ease.

## 🚀 Features

- **Full-Stack Framework**: Built on [TanStack Start](https://tanstack.com/start/latest) (React, SSR, File-based routing via TanStack Router).
- **Internationalization (i18n)**: Integrated with [LinguiJS](https://lingui.dev/) for seamless, type-safe multi-language support.
- **Git-based CMS**: Ready-to-use [Sveltia CMS](https://sveltia.github.io/sveltia-cms/) at `/admin` (a lightweight alternative to Decap/Netlify CMS).
- **Type-Safe Content**: Markdown and YAML content parsing via [Content Collections](https://www.content-collections.dev/).
- **Styling**: Utility-first styling with [Tailwind CSS v4](https://tailwindcss.com/).
- **Code Quality**: Fast linting and formatting via [Biome](https://biomejs.dev/).
- **Git Hooks**: Pre-commit and commit-msg hooks powered by [Lefthook](https://github.com/evilmartians/lefthook) & [Commitlint](https://commitlint.js.org/).

---

## 📦 Tech Stack

- **Runtime & Package Manager**: [Bun](https://bun.sh/)
- **Frontend**: React 19, TanStack Router
- **Build Tool**: Vite & Rolldown
- **i18n**: LinguiJS
- **CMS**: Sveltia CMS
- **Content**: Content Collections

---

## 🤖 Working with coding agents

`AGENTS.md` describes the architecture, commands and rules for coding agents (Claude Code reads it through `CLAUDE.md`). Task guides and house rules live in `.claude/skills/`: `add-page`, `add-collection`, `add-locale`, `i18n-lingui`, `content-collections`, `zustand-store`, `sveltia-cms` and `deploy`.

---

## 🛠️ Getting Started

### 1. Installation

<!-- template-repo:start (stripped from generated projects) -->
Ensure you have [Bun](https://bun.sh/) installed, then scaffold a new project (see `packages/create-template/README.md` for registry setup):

```bash
bun create @ayden/template@latest my-app
cd my-app
```

Or, inside an existing checkout:
<!-- template-repo:end -->

```bash
bun install          # also installs the git hooks (lefthook)
```

### 2. Development Server

Start the Vite development server on `http://localhost:3000`:

```bash
bun dev
```

### 3. Build for Production

Compile the application for production:

```bash
bun run build
bun run preview   # serve the production build locally (workerd)
bun run deploy    # build + deploy to Cloudflare Workers
```

---

## 🌐 Localization (i18n)

This template uses LinguiJS to manage translations. The configured locales are English (`en`, default, no URL prefix), Chinese (`zh`), Japanese (`ja`), Thai (`th`) and Spanish (`es`).

### Adding Translations
1. Wrap visible text with `i18n._("Hello {name}", { name })` from `useLingui()` (`@lingui/react`). The English literal is the message ID. Module-level labels use `msg({ id: "Home" })`.
2. Extract the new strings to catalog files (`.json`):
   ```bash
   bun run i18n:extract
   ```
3. Translate the messages in `src/locales/{zh,ja,th,es}.json` (`en.json` is the source), then run `bun run i18n:check`.
   Catalogs are compiled on the fly by `@lingui/vite-plugin` (`import "...json?lingui"`), so there is no separate compile step.

Do not use `<Trans>` or the `t` macro: see `.claude/skills/i18n-lingui/SKILL.md` for the full rules.

---

## 📝 Content Management (Sveltia CMS)

The CMS is configured to run entirely in the browser using GitHub as the backend. 

1. **Access the CMS**: Navigate to `http://localhost:3000/admin/`.
2. **Configuration**: The CMS structure is defined in `public/admin/config.yml`. Update the `backend.repo` field to match your own GitHub repository if you fork this template. Run `bun run validate:cms` to check it against the Sveltia schema.
3. **Edit locally without login**: run `bun dev`, open `http://localhost:3000/admin/index.html` in Chrome/Edge and click "Work with Local Repository". Changes are written to `content/`; commit them with git.
4. **OAuth**: Sign-in goes through the built-in proxy at `/api/auth` (same origin as `/admin`). Create a GitHub OAuth App with the callback URL `<your-site-origin>/api/auth/callback?provider=github` (the same origin that serves `/admin`), then copy `.dev.vars.example` to `.dev.vars` and fill in the values. In production, set them with `wrangler secret put OAUTH_GITHUB_CLIENT_ID` and `OAUTH_GITHUB_CLIENT_SECRET`.
5. **More**: field ↔ schema mapping, custom editor components, upgrading the pinned Sveltia version and login troubleshooting are in `.claude/skills/sveltia-cms/`.

---

## 📚 Content Collections

Content edited in the CMS is validated and turned into typed data by `@content-collections/core`.

```
content-collections.ts        # registers the collections
src/content/
  authors.ts                  # schema + transform for content/authors
  posts.ts                    # schema + transform for content/posts (i18n, Markdown → HTML)
  helpers.ts                  # shared zod helpers, locale path parsing
src/server/posts.ts           # server functions that query the collections
content/
  authors/<slug>.yaml
  posts/<locale>/<slug>.md    # same <slug> in each locale folder = one translated post
public/uploads/               # media uploaded from the CMS
```

- **Adding a collection**: create `src/content/<name>.ts`, register it in `content-collections.ts`, and add the matching collection (same `folder`, same fields) to `public/admin/config.yml`.
- **Reading content**: query collections inside a `createServerFn` (see `src/server/posts.ts`) and call it from a route `loader`, so content is not bundled into client JavaScript.
- **Posts**: a missing translation falls back to the default locale. Posts with `draft: true` are only listed in development.

---

## ⚓ Git Hooks & Commits

This project enforces strict code quality and commit message standards.

- **Pre-commit**: Lefthook runs Biome to lint and format code before allowing a commit.
- **Commit Messages**: We strictly follow [Conventional Commits](https://www.conventionalcommits.org/). Commit messages must be formatted properly (e.g., `feat: add new button`, `fix: header alignment`). If you violate this, the commit will be rejected by Commitlint.

---

## 🚀 Deployment

| Target | Setup | Notes |
|---|---|---|
| Cloudflare Workers (default) | `bun run deploy` | Configured out of the box; secrets via `wrangler secret put` |
| Vercel | Swap the Vite plugin for Nitro | SSR, server functions and CMS login keep working |
| Netlify | Swap the Vite plugin for `@netlify/vite-plugin-tanstack-start` | SSR, server functions and CMS login keep working |
| GitHub Pages | `STATIC=1` prerendered build | Static only: rebuild on content changes; CMS login needs an external OAuth proxy |

Step-by-step guides: `.claude/skills/deploy/` (`cloudflare.md`, `vercel.md`, `netlify.md`, `github-pages.md`).

---

## 📄 License

MIT

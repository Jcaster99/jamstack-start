---
name: deploy
description: >
  Publish this TanStack Start site to Cloudflare Workers (default), Vercel,
  Netlify or GitHub Pages: choosing a target, the exact config changes per
  platform, environment variables/secrets for the CMS OAuth proxy, CI
  workflows and post-deploy checks. Use when asked to deploy, host, publish,
  go live, set up CI/CD, or move the app to another platform.
---

# Deploy

The app is SSR with server functions, and an OAuth proxy (`/api/auth`) for Sveltia CMS. That decides what each platform can do:

| Target | How | SSR + server fns | `/api/auth` (CMS login) | Code changes | Guide |
|---|---|---|---|---|---|
| **Cloudflare Workers** (default) | `@cloudflare/vite-plugin` + wrangler | ✅ edge | ✅ same origin | none | [cloudflare.md](cloudflare.md) |
| **Vercel** | Nitro (`nitro/vite`) | ✅ Node function | ✅ same origin | swap the Vite plugin | [vercel.md](vercel.md) |
| **Netlify** | `@netlify/vite-plugin-tanstack-start` | ✅ Node function | ✅ same origin | swap the Vite plugin + `netlify.toml` | [netlify.md](netlify.md) |
| **GitHub Pages** | static prerender (`STATIC=1`) | ⚠️ build time only | ❌ needs an external proxy | build toggle + static middleware | [github-pages.md](github-pages.md) |

Read the guide for the chosen target, then follow it exactly. Each recipe was verified with real builds and local servers, but not yet against a live account.

## Choosing

- No preference → **Cloudflare Workers**: already configured; deploy with `bun run deploy`.
- The team already uses Vercel or Netlify → switch the Vite plugin. These are alternatives to Cloudflare, not additions: Cloudflare is removed (`wrangler.jsonc`, `@cloudflare/vite-plugin`).
- Free static hosting with no server → **GitHub Pages**, accepting the limits in its guide (content changes need a rebuild, CMS login needs a separate proxy). It is a toggle, so the Cloudflare build stays intact.

## Always

1. Run `bun run typecheck && bun run check && bun run i18n:check && bun run build` before deploying.
2. CMS secrets are never committed. They live in the platform's secret or env store, and locally in `.dev.vars` (Cloudflare) or `.env` (Vercel, Netlify):
   - `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` (optionally `OAUTH_GITLAB_*`)
3. Set the GitHub OAuth App callback to `https://<deployed-origin>/api/auth/callback?provider=github`. Preview deployments have different origins, so CMS login works only on the origin registered in the OAuth App.
4. Set `backend.repo` in `public/admin/config.yml` to the real `owner/repo`.
5. After deploying, check `/`, `/zh/posts`, `/posts/hello-world`, `/admin/`, and (not on Pages) `/en/posts` → 301 `/posts` and `/api/auth?provider=github` → 302 to github.com.
6. When switching away from Cloudflare, update the Cloudflare-specific parts of `AGENTS.md` (the Runtime section, `.dev.vars`, workerd) and `README.md`, so later agents do not follow stale instructions.

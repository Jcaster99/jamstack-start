# Deploy to Netlify

TanStack Start runs on Netlify through `@netlify/vite-plugin-tanstack-start`. This replaces the Cloudflare build: you switch targets, you do not add one. Everything keeps working: SSR (as a Netlify Function, Node), server functions, the CSRF middleware, the custom entry `src/server.tsx` (`/en/...` → `/` 301), the OAuth proxy `/api/auth`, and static `/admin` and `/uploads`. `src/server.tsx` and `src/start.ts` need no changes: TanStack picks up `src/server.tsx` as the server entry by convention.

Verified locally with `netlify serve --offline`. Not yet confirmed on a live Netlify site.

## 1. Switch the build target

```bash
bun remove @cloudflare/vite-plugin wrangler
bun add -d @netlify/vite-plugin-tanstack-start
git rm wrangler.jsonc
git mv .dev.vars.example .env.example   # .gitignore already allows .env.example
```

`vite.config.ts`:

```diff
-import { cloudflare } from "@cloudflare/vite-plugin";
+import netlify from "@netlify/vite-plugin-tanstack-start";
 ...
 		devtools(),
-		cloudflare({ viteEnvironment: { name: "ssr" } }),
 		tailwindcss(),
 		tanstackStart(),
+		netlify(),
 		viteReact(),
```

`package.json`:
- Replace `"deploy": "bun run build && wrangler deploy"` with `"deploy": "netlify deploy --build --prod"`, or remove it if you deploy from Git.
- Remove `"workerd"` from `trustedDependencies`.
- Keep `"build": "bun run i18n:extract && vite build"` unchanged.

New `netlify.toml`:

```toml
[build]
  command = "bun run build"
  publish = "dist/client"

[build.environment]
  NODE_VERSION = "22"   # the plugin requires node ^22.12.0 || >=24

[dev]
  command = "vite dev"
  targetPort = 3000
```

`.gitignore`: add `.netlify` (it holds the local emulation data).

<!-- template-repo:start -->
Template repo only: in `packages/create-template/index.js`, remove the `wrangler.jsonc` edit in `customize()`, and change the `cp .dev.vars.example .dev.vars` hint to `cp .env.example .env`.
<!-- template-repo:end -->

## 2. Environment variables

| Where | How |
|---|---|
| Local `bun dev` / `netlify serve` | `.env` (copy `.env.example`). `.dev.vars` is **no longer read**. |
| Netlify | Project configuration → Environment variables (scope: Functions or All): `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` (optionally `OAUTH_GITLAB_*`). They reach `process.env`. |

GitHub OAuth App callback: `https://<site>.netlify.app/api/auth/callback?provider=github` (or the custom domain). Deploy previews have other origins, so CMS login only works on the origin that matches the callback.

## 3. Netlify site settings

Import the repository in Netlify. Build settings come from `netlify.toml`: build command `bun run build`, publish directory `dist/client`, and the default functions directory. The plugin writes `.netlify/v1/functions/server.mjs` with `preferStatic: true`, so static files are served first and everything else goes to TanStack.

CLI alternative: `bunx netlify-cli login`, `bunx netlify-cli init`, then `bun run deploy`.

If the Netlify build log shows npm instead of bun, set `BUN_VERSION` in `[build.environment]`. Bun detection relies on `bun.lock`.

## 4. Verify before pushing

```bash
bun run build
bunx netlify-cli serve --offline     # no login needed; port 8888; injects .env
# /, /zh/posts, /posts/hello-world, /admin/, /uploads/jane-doe.svg → 200
# /en/posts → 301 /posts
# /api/auth?provider=github → 500 without .env, 302 with it
```

Use `netlify serve` rather than `vite preview` to check `/admin/`. Under `vite dev` and `vite preview`, `/admin/` redirects to `/admin`, which is a 404. Open `/admin/index.html` there instead. On Netlify both URLs work.

## 5. Update docs after switching

Cloudflare-specific text in `AGENTS.md` (the "Runtime (Cloudflare Workers)" section, `.dev.vars`, workerd), `README.md` and `.claude/skills/deploy/cloudflare.md` no longer applies. Update or remove it.

Optional: SSR runs in one region by default. The plugin has an `edgeSSR` option (untested here).

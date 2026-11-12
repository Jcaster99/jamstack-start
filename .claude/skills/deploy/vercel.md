# Deploy to Vercel (via Nitro)

TanStack Start runs on Vercel through **Nitro**. This replaces the Cloudflare build: you switch targets, you do not add one. Everything keeps working: SSR, server functions, the CSRF middleware, the custom entry `src/server.tsx` (`/en/...` → `/` 301), the OAuth proxy `/api/auth` and the static `/admin`. `src/server.tsx` and `src/start.ts` need no changes.

Verified locally: a Node build and the Vercel-preset output both pass the route, redirect, OAuth and CSRF checks. Not yet confirmed on a live Vercel project.

## 1. Switch the build target

```bash
bun add nitro                          # v3 is a release candidate: consider pinning the exact version
bun remove @cloudflare/vite-plugin wrangler
git rm wrangler.jsonc
git mv .dev.vars.example .env.example  # .gitignore already allows .env.example
```

`vite.config.ts`:

```diff
-import { cloudflare } from "@cloudflare/vite-plugin";
+import { nitro } from "nitro/vite";
 ...
 		devtools(),
-		cloudflare({ viteEnvironment: { name: "ssr" } }),
 		tailwindcss(),
 		tanstackStart(),
+		nitro(),
 		viteReact(),
```

Use plain `nitro()` with no preset. On Vercel the `VERCEL` env var makes Nitro pick the `vercel` preset automatically. Locally it builds a Node server into `.output/`. Hardcoding `preset: "vercel"` breaks running the build locally.

`package.json`:
- Replace `"deploy": "bun run build && wrangler deploy"` with `"deploy": "vercel deploy --prod"`, or remove it if you deploy from Git.
- Remove `"workerd"` from `trustedDependencies`.
- Optionally add `"start": "node .output/server/index.mjs"`.
- Optionally pin the runtime with `"engines": { "node": "24.x" }`.

`.gitignore`: add `.vercel`. `.output` and `.nitro` are already ignored.

<!-- template-repo:start -->
`packages/create-template/index.js` (template repo only): remove the `wrangler.jsonc` edit in `customize()`.
<!-- template-repo:end -->

## 2. Environment variables

| Where | How |
|---|---|
| Local `bun dev` | `.env` / `.env.local` (copy `.env.example`). `.dev.vars` is **no longer read**; only wrangler read it. |
| Local production run | `node .output/server/index.mjs` does **not** read `.env`. Export the variables in the shell. |
| Vercel | Project → Settings → Environment Variables (Production + Preview): `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET` (optionally `OAUTH_GITLAB_*`). They reach `process.env` at runtime. |

GitHub OAuth App callback: `https://<vercel-domain>/api/auth/callback?provider=github`. Preview deployments have other origins, so CMS login only works on the origin that matches the callback.

## 3. Vercel project settings

Import the repository in Vercel. No `vercel.json` is needed: Nitro writes the Build Output API format (`.vercel/output/`) and Vercel deploys it directly.

| Setting | Value |
|---|---|
| Framework preset | Auto-detected (TanStack Start / Nitro), or "Other" |
| Install command | auto (bun is detected from `bun.lock`) |
| Build command | `bun run build` |
| Output directory | leave empty |

CLI alternative: `bunx vercel` (link + preview), then `bunx vercel --prod`.

## 4. Verify before pushing

```bash
bun run build && PORT=4310 node .output/server/index.mjs
# /, /zh/posts, /posts/hello-world, /admin/ → 200; /en/posts → 301 /posts
# /api/auth?provider=github → 500 without env, 302 with OAUTH_GITHUB_* exported
VERCEL=1 bun run build    # produces .vercel/output/ like the real Vercel build
```

## 5. Update docs after switching

Cloudflare-specific text in `AGENTS.md` (the "Runtime (Cloudflare Workers)" section, the "Worker entry" comment, "workerd"), `README.md` and `.claude/skills/deploy/cloudflare.md` no longer applies. Update or remove it so agents do not follow stale instructions. Keeping the "no Node-only APIs" rule is still a good idea for portability.

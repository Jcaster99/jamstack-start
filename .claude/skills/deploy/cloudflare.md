# Deploy to Cloudflare Workers (default target)

The repo is already configured for Workers. Nothing in the code needs to change.

How it fits together:
- `@cloudflare/vite-plugin` (in `vite.config.ts`) builds the SSR app for the Workers runtime.
- `wrangler.jsonc` sets `main: "./src/server.tsx"` (the custom entry that does the `/en/...` → `/` redirects), `nodejs_compat` and the compatibility date.
- `bun run build` writes `dist/server/` (the Worker plus a generated `wrangler.json`) and `dist/client/` (static assets, including `public/admin` and `public/uploads`). Static assets are served before the Worker runs.
- `wrangler deploy` reads the generated config through `.wrangler/deploy/config.json`. Always build first; `bun run deploy` does both.

## 1. One-time setup

```bash
bunx wrangler login            # or set CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID) in CI
bunx wrangler whoami
```

Set the Worker name in `wrangler.jsonc` (`"name"`). It becomes `<name>.<account>.workers.dev`.

## 2. Secrets (CMS OAuth)

```bash
bunx wrangler secret put OAUTH_GITHUB_CLIENT_ID
bunx wrangler secret put OAUTH_GITHUB_CLIENT_SECRET
# optional GitLab: OAUTH_GITLAB_CLIENT_ID / OAUTH_GITLAB_CLIENT_SECRET
```

- Secrets reach the code as `process.env.*` (`nodejs_compat` with a compatibility date ≥ 2025-04-01).
- Local dev reads `.dev.vars` (copy `.dev.vars.example`). Never commit it.
- The GitHub OAuth App callback URL must be `https://<your-domain>/api/auth/callback?provider=github`. For both a workers.dev URL and a custom domain, create one OAuth App per origin.

## 3. Deploy

```bash
bun run deploy                 # = bun run build && wrangler deploy
bunx wrangler deploy --dry-run # after a build: shows what would be uploaded, deploys nothing
```

Check `https://<name>.<account>.workers.dev/`, `/zh/posts`, `/en/posts` (expect a 301 to `/posts`), `/admin/`.

## 4. Deploy from Git (Workers Builds)

In the Cloudflare dashboard, go to Workers & Pages → the Worker → Settings → Builds → connect the repository, then set:

| Setting | Value |
|---|---|
| Build command | `bun run build` |
| Deploy command | `bunx wrangler deploy` |
| Root directory | `/` |

Builds detect bun from `bun.lock`. Secrets set with `wrangler secret put` persist across deploys.

Alternatively, use GitHub Actions:

```yaml
# .github/workflows/deploy-cloudflare.yml
name: Deploy to Cloudflare Workers
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bunx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Create the API token with the "Edit Cloudflare Workers" template.

## 5. Custom domain

Add it under Worker → Settings → Domains & Routes → Custom domain (the zone must be on Cloudflare). Or set it in `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "example.com", "custom_domain": true }]
```

Then update the GitHub OAuth App callback URL to the new origin.

## Notes

- `bun run preview` runs the production build locally in workerd. It reads `dist/server/.dev.vars`, which is copied at build time, so rebuild after editing `.dev.vars`.
- To add bindings (KV, D1, R2), declare them in `wrangler.jsonc` and read them with `import { env } from "cloudflare:workers"`. Run `bunx wrangler types` for typings.
- "Cloudflare Pages" (static) is not needed. Workers serves both the static assets and SSR.

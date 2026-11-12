# Deploy to GitHub Pages (fully static)

GitHub Pages only serves files, so the app is **prerendered to static HTML** at build time. Server functions become static JSON through `@tanstack/start-static-server-functions` (experimental). This is added as a **build toggle** (`STATIC=1`): with the toggle off, the Cloudflare build behaves exactly as before.

Verified locally: a GitHub-Pages-like static server plus headless Chrome, at the domain root and under `/my-repo/`. Client navigation and language switching fetch only static JSON, with zero `/_serverFn` calls. The Cloudflare build was re-checked with the toggle off.

## What you give up on Pages

| Feature | On Pages |
|---|---|
| SSR per request, server functions | Prerendered at build time. New or edited content needs a rebuild (the workflow rebuilds on every push to `main`). |
| `/en/...` → `/` redirect (`src/server.tsx`) | Does not run. `/en/posts` gets `404.html`, which renders the page under the `/en` URL. Don't link to `/en/...`. |
| Unknown post slugs (`/zh/posts/missing`) | Error view instead of the 404 page (the JSON request returns 404 HTML). Every page must exist at build time. |
| CMS OAuth proxy `/api/auth` | Does not run: use an external proxy (section 4) or "Sign in with token". |
| Request middleware (CSRF, locale cookie) | Does not run. Not needed for a static site. |
| Pages not linked from anywhere | Not generated (crawler). Add them to `pages`. |

If you need any of these, deploy to Cloudflare, Vercel or Netlify instead.

**Prefer a user/org page (`<user>.github.io`) or a custom domain**, where the site is served at `/`. A project page (`<user>.github.io/<repo>/`) works with the extra fixes in section 2, but every new root-absolute path (`/something`) is another place it can break.

## 1. Static build toggle (required)

```bash
bun add @tanstack/start-static-server-functions@1.167.43 --exact
```

Pin the version so it shares `@tanstack/start-client-core` with the installed `@tanstack/react-start` (`bun pm ls | grep start-client-core` must show a single version). Re-check when upgrading `@tanstack/*`.

`package.json` scripts:

```json
"build:static": "STATIC=1 bun run build"
```

`vite.config.ts`:

```ts
import { defaultLocale, locales } from "./src/libs/locales.ts";

// STATIC=1 builds a fully static site into dist/client instead of a Cloudflare
// Worker. BASE_PATH is the public path, e.g. "/my-repo/" for a project page.
const isStatic = process.env.STATIC === "1";
const base = process.env.BASE_PATH || "/";

const config = defineConfig({
	base,
	define: {
		"import.meta.env.STATIC": JSON.stringify(isStatic),
	},
	plugins: [
		contentCollections(),
		lingui({ macroTransform: true }),
		devtools(),
		// The Workers runtime cannot write the static server-function JSON: drop it.
		!isStatic && cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(
			isStatic
				? {
						// One seed page per locale (the language switcher is a <select>,
						// which the crawler cannot follow); crawlLinks then finds
						// /<locale>/posts and every published post via LocalizedLinks.
						pages: locales.map(({ code }) => ({
							path: code === defaultLocale ? "/" : `/${code}`,
						})),
						prerender: { enabled: true, crawlLinks: true, autoSubfolderIndex: true },
						// GitHub Pages serves 404.html for unknown paths: make it the app
						// shell. maskPath must not be "/" (collides) or "/404" (fails).
						spa: {
							enabled: true,
							maskPath: "/?shell",
							prerender: { outputPath: "/404" },
						},
					}
				: {},
		),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
	],
});
```

New `src/vite-env.d.ts`:

```ts
interface ImportMetaEnv {
	readonly STATIC: boolean;
}
```

New `src/server/static.ts`:

```ts
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";

// Spread LAST in every server function's middleware list.
export const staticMiddleware = import.meta.env.STATIC
	? [staticFunctionMiddleware]
	: [];

const base = import.meta.env.BASE_URL;

// Prefix root-absolute content paths (/uploads/...) with the base path.
export const withBase = <T extends string | undefined>(path: T): T =>
	(path?.startsWith("/") && !path.startsWith("//")
		? base + path.slice(1)
		: path) as T;

export const htmlWithBase = (html: string) =>
	base === "/" ? html : html.replace(/(src|href)="\/(?!\/)/g, `$1="${base}`);
```

In **every** server function in `src/server/`, add the middleware before `.validator`:

```ts
export const listPosts = createServerFn({ method: "GET" })
	.middleware(staticMiddleware)
	.validator(z.object({ locale: localeSchema }))
	.handler(/* ... */);
```

Build and check:

```bash
BASE_PATH=/ bun run build:static
# → "Prerendered 16 pages": /, /posts, /posts/hello-world × 5 locales, plus 404.html
# output: dist/client (HTML + __tsr/staticServerFnCache/*.json); ignore dist/server
```

## 2. Project page under `/<repo>/` (only if not served at `/`)

TanStack Start takes the router basepath from Vite `base` automatically. Three places still need fixes:

1. **Content paths**: wrap `cover` / `avatar` with `withBase(...)` and post `html` with `htmlWithBase(...)` in the server functions (`src/server/posts.ts`, `src/server/authors.ts`). With `BASE_URL` set to `/`, these do nothing.
2. **Static JSON fetch**: the static-functions package fetches `/__tsr/...` from the domain root and ignores `base` (upstream bug). Add this to `src/client.tsx` before `hydrateRoot`:
   ```ts
   const base = import.meta.env.BASE_URL.replace(/\/$/, "");
   if (import.meta.env.STATIC && base) {
   	const fetch = window.fetch.bind(window);
   	window.fetch = (input, init) =>
   		fetch(
   			typeof input === "string" && input.startsWith("/__tsr/") ? base + input : input,
   			init,
   		);
   }
   ```
3. **Language switcher**: `switchLocale` reads `window.location.pathname`, which includes the base. In `src/layouts/AppLayout.tsx`, pass the router pathname:
   ```tsx
   import { useLocation } from "@tanstack/react-router";
   const pathname = useLocation({ select: (location) => location.pathname });
   // ...
   onChange={(event) => switchLocale(event.target.value as Locale, pathname)}
   ```
4. **Root-absolute assets**: in `src/routes/__root.tsx`, set the icon `href` to `` `${import.meta.env.BASE_URL}app-icon.png` ``. In `public/admin/index.html` and `logo.src` in `public/admin/config.yml`, also prefix `/app-icon.png`.

Test: `STATIC=1 BASE_PATH=/my-repo/ bun run build`, then serve `dist/client` under `/my-repo/`.

## 3. GitHub Actions workflow

`.github/workflows/pages.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - id: pages
        uses: actions/configure-pages@v5
      # base_path is "/<repo>" for a project page, "" for a user/org page or custom domain.
      - run: bun run build:static
        env:
          BASE_PATH: ${{ steps.pages.outputs.base_path }}/
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist/client
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

In the repo, go to Settings → Pages → Source and choose **GitHub Actions**. `.nojekyll` is not needed: artifact deployments skip Jekyll, so `__tsr/` is served as-is.

## 4. CMS on a static host

`/admin` is served as static files, but the OAuth proxy cannot run on Pages. Choose one:

- **External OAuth proxy**: deploy [sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) as a separate Cloudflare Worker with `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `ALLOWED_DOMAINS=<user>.github.io` (or your domain). Set the GitHub OAuth App callback to `https://<worker>/callback`. Then point the CMS at it in `public/admin/index.html`:
  ```js
  // Static hosting: OAuth runs on a separate sveltia-cms-auth Worker.
  // Leave empty when /api/auth runs on the same origin (Cloudflare/Vercel/Netlify).
  const AUTH_PROXY = ""; // e.g. "https://sveltia-cms-auth.<account>.workers.dev"
  CMS.init({
  	config: {
  		backend: AUTH_PROXY
  			? { base_url: AUTH_PROXY, auth_endpoint: "auth" }
  			: { base_url: window.location.origin },
  	},
  });
  ```
- **No proxy**: use Sveltia's "Sign in with token" with a GitHub personal access token (repo scope).

End-to-end OAuth login through the external proxy has not been tested here.

## Caveats

- Static server functions are **experimental**. The `/__tsr` fetch fix works around an upstream bug. Re-test both after upgrading `@tanstack/*`.
- Unknown URLs show a recoverable React hydration warning (#418) when the 404 shell hydrates. The page still renders correctly.
- `bun dev` is unaffected by the toggle.

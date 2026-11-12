# @ayden/create-template

Scaffolds a new project from this repository (TanStack Start + Lingui + Sveltia CMS on Cloudflare Workers).

```bash
bun create @ayden/template@latest my-app
# Bun resolves this to the package @ayden/create-template
```

Keep `@latest`: `bunx` caches the package, and without it a machine that scaffolded before may keep running an older version after you publish.

Options (all prompts can be answered with flags):

```
bun create @ayden/template@latest my-app --repo owner/repo --no-sample --no-git --no-install --yes
```

## How it works

- The template is **the repository root itself**. `scripts/build-template.js` copies every file **git tracks** into `template/`, except this package and `.cta.json`. It refuses to run on a dirty working tree (commit first), so untracked files such as local `.env.*` can never be published.
- Blocks between `template-repo:start` / `template-repo:end` markers (in any `.md` file and `.gitignore`) and repo-only config (`template:*` scripts, `packages/` entries in `biome.json` / `tsconfig.json`) are stripped from the template.
- `template/` is generated on `npm pack` / `npm publish` (the `prepack` script) and is gitignored.
- `.gitignore` is shipped as `_gitignore` (npm never publishes `.gitignore`) and renamed back by `index.js`.
- `index.js` copies the template, sets the project name in `package.json` and `wrangler.jsonc`, sets `backend.repo` in `public/admin/config.yml`, optionally removes the sample content, then runs `git init`, `bun install` and an initial commit.

Sample content removed by `--no-sample` is listed in `SAMPLE_FILES` in `index.js`. Update that list when you change the sample content.

## Publishing to a private registry

The package is scoped (`@ayden`), so only the scope needs to point at your registry. Replace `<REGISTRY_URL>` with your registry (e.g. Verdaccio, GitHub Packages, OneDev, a private npm org).

1. Configure the scope and a token (`~/.npmrc`, not committed):

   ```ini
   @ayden:registry=<REGISTRY_URL>
   //<REGISTRY_HOST_AND_PATH>/:_authToken=<TOKEN>
   ```

   Or use the **global** `~/.bunfig.toml`:

   ```toml
   [install.scopes]
   "@ayden" = { url = "<REGISTRY_URL>", token = "$AYDEN_NPM_TOKEN" }
   ```

2. Bump the version and publish from this folder:

   ```bash
   cd packages/create-template
   npm version patch
   npm publish            # runs prepack → builds template/ from the repo
   ```

   Commit the template repo first: `prepack` fails on uncommitted or untracked changes.

3. Every machine that runs `bun create @ayden/template` needs the same scope + token configuration from step 1, **in the home directory** (`~/.npmrc` or `~/.bunfig.toml`). `bunx` installs into a temp folder, so a project-level `.npmrc` / `bunfig.toml` is ignored.

## Testing locally

```bash
bun run template:build                 # from the repo root (allows a dirty tree)
node packages/create-template/index.js /tmp/my-app --yes --no-install

# Test the packed tarball the way consumers get it (bunx cannot run a .tgz directly):
bun run template:pack                  # needs a clean tree; produces ayden-create-template-x.y.z.tgz
mkdir /tmp/runner && cd /tmp/runner && echo '{}' > package.json
bun add /path/to/ayden-create-template-0.1.0.tgz
./node_modules/.bin/create-template /tmp/my-app2
```

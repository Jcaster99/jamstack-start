// Copies the files git tracks in the template repo into ../template, minus the
// parts that only make sense in the template repo. Runs on `npm pack` / `publish`.
//
// Usage: node scripts/build-template.js [--allow-dirty]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const allowDirty = process.argv.includes("--allow-dirty");

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const templateDir = path.join(packageDir, "template");
const git = (...args) =>
	execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	cwd: packageDir,
	encoding: "utf8",
}).trim();

// Only tracked files: untracked files (notes, local .env variants, editor
// settings) must never end up in a published template.
const dirty = git("status", "--porcelain").trim();
if (dirty && !allowDirty) {
	console.error(
		`✖ The template repo has uncommitted or untracked changes:\n${dirty}\n` +
			"Commit them first, or pass --allow-dirty for a local test build.",
	);
	process.exit(1);
}

// Paths (relative to the repo root) that belong to the template repo itself.
const packagePath = path
	.relative(repoRoot, packageDir)
	.split(path.sep)
	.join("/");
const EXCLUDE = [packagePath, ".cta.json"];

// npm never publishes files named .gitignore; index.js renames it back.
const RENAMES = { ".gitignore": "_gitignore" };

const isExcluded = (file) =>
	EXCLUDE.some((entry) => file === entry || file.startsWith(`${entry}/`));

// Removes blocks between marker comment lines (`<!-- template-repo:start -->`
// or `# template-repo:start` ... `template-repo:end`), markers included. Only
// lines that begin with a comment count, so prose mentioning the markers is safe.
const stripMarked = (text) =>
	text.replace(
		/^[ \t]*(?:<!--|#)[ \t]*template-repo:start.*\n[\s\S]*?^[ \t]*(?:<!--|#)[ \t]*template-repo:end.*\n?/gm,
		"",
	);

const TRANSFORMS = {
	".gitignore": stripMarked,
	"package.json": (text) => {
		const pkg = JSON.parse(text);
		for (const name of Object.keys(pkg.scripts ?? {})) {
			if (name.startsWith("template:")) delete pkg.scripts[name];
		}
		return `${JSON.stringify(pkg, null, 2)}\n`;
	},
	"biome.json": (text) => {
		const config = JSON.parse(text);
		config.files.includes = config.files.includes.filter(
			(entry) => !entry.includes(packagePath),
		);
		return `${JSON.stringify(config, null, "\t")}\n`;
	},
	"tsconfig.json": (text) => text.replace(/,\s*"packages"/, ""),
};

// A dirty local test build also picks up new, not-yet-committed files.
const files = git(
	"ls-files",
	"-z",
	...(allowDirty ? ["--cached", "--others", "--exclude-standard"] : []),
)
	.split("\0")
	.filter(Boolean)
	.filter((file) => !isExcluded(file))
	// Tracked files deleted from the working tree (only with --allow-dirty).
	.filter((file) => fs.existsSync(path.join(repoRoot, file)));

fs.rmSync(templateDir, { recursive: true, force: true });
for (const file of files) {
	const source = path.join(repoRoot, file);
	const destination = path.join(templateDir, RENAMES[file] ?? file);
	fs.mkdirSync(path.dirname(destination), { recursive: true });
	const transform =
		TRANSFORMS[file] ?? (file.endsWith(".md") ? stripMarked : undefined);
	if (transform) {
		fs.writeFileSync(destination, transform(fs.readFileSync(source, "utf8")));
	} else {
		fs.copyFileSync(source, destination);
	}
}

if (dirty) {
	console.warn("⚠ Built from a dirty working tree (--allow-dirty).");
}
console.log(
	`✔ Copied ${files.length} files into ${path.relative(repoRoot, templateDir)}`,
);

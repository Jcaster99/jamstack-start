#!/usr/bin/env node
// Scaffolds a new project from ./template (built from the template repo by
// scripts/build-template.js). Zero dependencies so `bun create` starts instantly.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const TEMPLATE_DIR = fileURLToPath(new URL("./template", import.meta.url));

// npm never publishes files named .gitignore, so the template stores it as _gitignore.
const RENAMES = { _gitignore: ".gitignore" };

const SAMPLE_FILES = [
	"content/authors/jane-doe.yaml",
	"content/posts/en/hello-world.md",
	"content/posts/zh/hello-world.md",
	"content/posts/ja/hello-world.md",
	"content/posts/th/hello-world.md",
	"content/posts/es/hello-world.md",
	"public/uploads/jane-doe.svg",
];
const SAMPLE_DIRS = [
	"content/authors",
	"content/posts/en",
	"content/posts/zh",
	"content/posts/ja",
	"content/posts/th",
	"content/posts/es",
	"public/uploads",
];

const REPO_PLACEHOLDER = "OWNER/REPO";

const HELP = `Usage: bun create @ayden/template [dir] [options]

Options:
  --repo <owner/repo>  GitHub repository used by the CMS (public/admin/config.yml)
  --no-sample          Remove the sample author and posts
  --no-git             Skip git init and the initial commit
  --no-install         Skip bun install
  -y, --yes            Accept defaults, never prompt
  -h, --help           Show this help
`;

const color = (code) => (text) =>
	process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;
const bold = color(1);
const dim = color(2);
const green = color(32);
const yellow = color(33);
const red = color(31);

const fail = (message) => {
	console.error(red(`✖ ${message}`));
	process.exit(1);
};

const parseArgs = (argv) => {
	const options = { sample: true, git: true, install: true, yes: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "-h" || arg === "--help") options.help = true;
		else if (arg === "-y" || arg === "--yes") options.yes = true;
		else if (arg === "--no-sample") options.sample = false;
		else if (arg === "--no-git") options.git = false;
		else if (arg === "--no-install") options.install = false;
		else if (arg === "--repo") {
			const value = argv[++i];
			if (!value || value.startsWith("-"))
				fail("--repo requires a value (owner/repo)");
			options.repo = value;
		} else if (arg.startsWith("--repo=")) options.repo = arg.slice(7);
		else if (arg.startsWith("-")) fail(`Unknown option: ${arg}`);
		else if (!options.dir) options.dir = arg;
		else fail(`Unexpected argument: ${arg}`);
	}
	return options;
};

// Valid as both an npm package name and a Cloudflare Worker name.
const trimDashes = (value) => value.replace(/^-+|-+$/g, "");
const toSlug = (value) =>
	trimDashes(
		trimDashes(
			value
				.normalize("NFKD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/[đĐ]/g, "d")
				.toLowerCase()
				.replace(/[^a-z0-9-]+/g, "-"),
		).slice(0, 63),
	) || "my-app";

const isRepo = (value) => /^[\w.-]+\/[\w.-]+$/.test(value);

// Returns an error message when `dir` cannot be used as the target.
const checkTarget = (dir) => {
	if (!fs.existsSync(dir)) return undefined;
	if (!fs.statSync(dir).isDirectory())
		return `"${dir}" exists and is not a directory.`;
	if (fs.readdirSync(dir).length > 0)
		return `Directory "${dir}" already exists and is not empty.`;
	return undefined;
};

const isInsideGitRepo = (dir) =>
	spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
		cwd: dir,
		stdio: "ignore",
	}).status === 0;

const shellQuote = (value) => (/^[\w./-]+$/.test(value) ? value : `"${value}"`);

const commandExists = (command) =>
	spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;

const run = (command, args, cwd, stdio = "inherit") =>
	spawnSync(command, args, { cwd, stdio }).status === 0;

const promptAll = async (options) => {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const ask = async (question, fallback) => {
		const hint = fallback ? dim(` (${fallback})`) : "";
		const answer = (
			await rl.question(`${bold("?")} ${question}${hint} `)
		).trim();
		return answer || fallback;
	};
	const confirm = async (question, fallback) => {
		const answer = await ask(question, fallback ? "Y/n" : "y/N");
		if (answer === "Y/n" || answer === "y/N") return fallback;
		return /^y(es)?$/i.test(answer);
	};

	try {
		if (options.dir === undefined) {
			let dir = await ask("Project directory:", "my-app");
			let problem = checkTarget(path.resolve(dir));
			while (problem) {
				console.log(yellow(`  ${problem}`));
				dir = await ask("Project directory:", "my-app");
				problem = checkTarget(path.resolve(dir));
			}
			options.dir = dir;
		}
		if (options.repo === undefined) {
			let repo = await ask(
				"GitHub repo for the CMS (owner/repo, blank to skip):",
				"",
			);
			while (repo && !isRepo(repo)) {
				console.log(yellow("  Expected the form owner/repo."));
				repo = await ask("GitHub repo for the CMS:", "");
			}
			options.repo = repo;
		}
		if (options.sample) {
			options.sample = await confirm("Keep the sample author and posts?", true);
		}
		if (options.git || options.install) {
			const setup = await confirm(
				"Initialize git and install dependencies?",
				true,
			);
			options.git &&= setup;
			options.install &&= setup;
		}
	} finally {
		rl.close();
	}
};

const copyTemplate = (target) => {
	fs.cpSync(TEMPLATE_DIR, target, { recursive: true });
	for (const [from, to] of Object.entries(RENAMES)) {
		const source = path.join(target, from);
		if (fs.existsSync(source)) fs.renameSync(source, path.join(target, to));
	}
};

const editFile = (target, file, edit) => {
	const filePath = path.join(target, file);
	if (!fs.existsSync(filePath)) return;
	fs.writeFileSync(filePath, edit(fs.readFileSync(filePath, "utf8")));
};

const customize = (target, { name, repo, sample }) => {
	editFile(target, "package.json", (text) => {
		const pkg = JSON.parse(text);
		pkg.name = name;
		pkg.version = "0.0.0";
		return `${JSON.stringify(pkg, null, 2)}\n`;
	});

	editFile(target, "wrangler.jsonc", (text) =>
		text.replace(/("name"\s*:\s*)"[^"]*"/, `$1"${name}"`),
	);

	editFile(target, "public/admin/config.yml", (text) =>
		text.replace(
			/^(\s*repo:\s*).*$/m,
			repo
				? `$1${repo}`
				: `$1${REPO_PLACEHOLDER} # TODO: set your GitHub repository (owner/repo)`,
		),
	);

	if (!sample) {
		for (const file of SAMPLE_FILES) {
			fs.rmSync(path.join(target, file), { force: true });
		}
		for (const dir of SAMPLE_DIRS) {
			fs.mkdirSync(path.join(target, dir), { recursive: true });
			fs.writeFileSync(path.join(target, dir, ".gitkeep"), "");
		}
	}
};

const main = async () => {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		console.log(HELP);
		return;
	}
	if (!fs.existsSync(TEMPLATE_DIR)) {
		fail(
			"Template files are missing from this package (was it built with `prepack`?).",
		);
	}

	if (!options.yes && process.stdin.isTTY) {
		await promptAll(options);
	}
	options.dir ??= "my-app";
	options.repo ??= "";
	if (options.repo && !isRepo(options.repo)) {
		fail(`Invalid --repo "${options.repo}", expected owner/repo.`);
	}

	const target = path.resolve(options.dir);
	const problem = checkTarget(target);
	if (problem) fail(problem);
	const name = toSlug(path.basename(target));

	console.log(`\nCreating ${bold(name)} in ${dim(target)}`);
	copyTemplate(target);
	customize(target, { name, repo: options.repo, sample: options.sample });

	const hasBun = commandExists("bun");
	const hasGit = commandExists("git");

	// git first, so lefthook (installed during `bun install`) can register its hooks.
	// Inside an existing repo (e.g. a monorepo), don't create a nested one.
	if (options.git && hasGit && isInsideGitRepo(path.dirname(target))) {
		console.log(dim("Inside an existing git repository, skipping git init"));
		options.git = false;
	}
	if (options.git && hasGit) {
		if (!run("git", ["init", "-q", "-b", "main"], target, "ignore")) {
			run("git", ["init", "-q"], target, "ignore");
		}
	} else if (options.git) {
		console.log(yellow("! git not found, skipping git init"));
	}

	if (options.install && hasBun) {
		console.log(dim("\nInstalling dependencies with bun..."));
		if (!run("bun", ["install"], target)) {
			console.log(yellow("! bun install failed, run it manually"));
		}
	} else if (options.install) {
		console.log(yellow("! bun not found (https://bun.sh), skipping install"));
	}

	if (options.git && hasGit) {
		run("git", ["add", "-A"], target, "ignore");
		const committed = run(
			"git",
			["commit", "-q", "--no-verify", "-m", "chore: initial commit"],
			target,
			"ignore",
		);
		if (!committed) {
			console.log(
				yellow(
					"! Could not create the initial commit (is git user.name/email set?)",
				),
			);
		}
	}

	const cdPath = path.relative(process.cwd(), target) || ".";
	console.log(`\n${green("✔")} Done. Next steps:\n`);
	console.log(`  cd ${shellQuote(cdPath)}`);
	if (!options.install || !hasBun) console.log("  bun install");
	console.log("  cp .dev.vars.example .dev.vars   # OAuth secrets for the CMS");
	if (!options.repo) {
		console.log(
			`  # set backend.repo in public/admin/config.yml (currently ${REPO_PLACEHOLDER})`,
		);
	}
	console.log("  bun dev\n");
};

main().catch((error) =>
	fail(error instanceof Error ? error.message : String(error)),
);

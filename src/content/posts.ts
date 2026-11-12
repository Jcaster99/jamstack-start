import { defineCollection } from "@content-collections/core";
import { compileMarkdown } from "@content-collections/markdown";
import rehypeSanitize from "rehype-sanitize";
import { z } from "zod";
import { authors } from "./authors";
import { isoDate, optionalString, parseLocalePath } from "./helpers";

// Sveltia `i18n.structure: multiple_folders` writes content/posts/<locale>/<slug>.md.
// The same slug in each locale folder is one post in several languages.
export const posts = defineCollection({
	name: "posts",
	directory: "content/posts",
	include: "**/*.md",
	parser: "frontmatter",
	schema: z.object({
		title: z.string(),
		summary: optionalString(),
		date: isoDate(),
		author: z.string(),
		cover: optionalString(),
		draft: z.boolean().default(false),
		content: z.string(),
	}),
	transform: async (doc, context) => {
		const parsed = parseLocalePath(doc._meta.path);
		if (!parsed) {
			throw new Error(
				`Post "${doc._meta.filePath}" must live in content/posts/<locale>/<slug>.md with a locale from src/libs/locales.ts`,
			);
		}

		// documents() returns pre-transform data, so match on _meta.path (the slug).
		const author = context
			.documents(authors)
			.find((item) => item._meta.path === doc.author);
		if (!author) {
			throw new Error(
				`Post "${doc._meta.filePath}" references unknown author "${doc.author}"`,
			);
		}

		// Sanitize: CMS editors (or PRs) must not be able to inject javascript: links etc.
		const html = await compileMarkdown(context, doc, {
			rehypePlugins: [rehypeSanitize],
		});
		const { content: _content, author: _authorSlug, ...rest } = doc;
		return {
			...rest,
			...parsed,
			html,
			author: {
				slug: author._meta.path,
				name: author.name,
				avatar: author.avatar,
			},
		};
	},
});

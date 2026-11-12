import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { allPosts } from "content-collections";
import { z } from "zod";
import { defaultLocale, isLocale, type Locale } from "#/libs/locales";

// Content stays on the server: pages receive only what they render, so the
// collections do not grow the client bundle.

const localeSchema = z.custom<Locale>(
	(value) => typeof value === "string" && isLocale(value),
);

type Post = (typeof allPosts)[number];

const visiblePosts = () =>
	allPosts.filter((post) => import.meta.env.DEV || !post.draft);

// Prefer the requested locale, fall back to the default-locale version.
const pickTranslation = (posts: Post[], slug: string, locale: Locale) =>
	posts.find((post) => post.slug === slug && post.locale === locale) ??
	posts.find((post) => post.slug === slug && post.locale === defaultLocale);

export const listPosts = createServerFn({ method: "GET" })
	.validator(z.object({ locale: localeSchema }))
	.handler(({ data }) => {
		const posts = visiblePosts();
		const slugs = [...new Set(posts.map((post) => post.slug))];

		return slugs
			.map((slug) => pickTranslation(posts, slug, data.locale))
			.filter((post): post is Post => post !== undefined)
			.sort((a, b) => b.date.localeCompare(a.date))
			.map(({ slug, locale, title, summary, date, cover, draft, author }) => ({
				slug,
				locale,
				title,
				summary,
				date,
				cover,
				draft,
				author,
			}));
	});

export const getPost = createServerFn({ method: "GET" })
	.validator(z.object({ locale: localeSchema, slug: z.string() }))
	.handler(({ data }) => {
		const post = pickTranslation(visiblePosts(), data.slug, data.locale);
		if (!post) {
			throw notFound();
		}

		const { _meta, ...rest } = post;
		return rest;
	});

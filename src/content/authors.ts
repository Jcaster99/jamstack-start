import { defineCollection } from "@content-collections/core";
import { z } from "zod";
import { optionalEmail, optionalString, optionalUrl } from "./helpers";

export const authors = defineCollection({
	name: "authors",
	directory: "content/authors",
	include: "**/*.{yaml,yml}",
	parser: "yaml",
	schema: z.object({
		name: z.string(),
		avatar: optionalString(),
		bio: optionalString(),
		email: optionalEmail(),
		website: optionalUrl(),
		twitter: optionalUrl(),
		github: optionalUrl(),
	}),
	transform: (doc) => ({ ...doc, slug: doc._meta.path }),
});

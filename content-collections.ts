import { defineConfig } from "@content-collections/core";
import { authors } from "./src/content/authors";
import { posts } from "./src/content/posts";

export default defineConfig({
	content: [authors, posts],
});

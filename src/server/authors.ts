import { createServerFn } from "@tanstack/react-start";
import { allAuthors } from "content-collections";

export const listAuthors = createServerFn({ method: "GET" }).handler(() =>
	allAuthors.map(({ _meta, ...author }) => author),
);

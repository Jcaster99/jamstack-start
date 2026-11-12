import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { i18nMiddleware } from "./libs/i18n";

const csrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
	requestMiddleware: [csrfMiddleware, i18nMiddleware],
}));

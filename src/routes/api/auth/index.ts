import { createFileRoute } from "@tanstack/react-router";
import {
	config,
	createStateCookie,
	getRedirectUri,
	isProvider,
	randomString,
	scopes,
} from "#/libs/auth";

export const Route = createFileRoute("/api/auth/")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const { searchParams } = new URL(request.url);
				const provider = searchParams.get("provider");

				if (!isProvider(provider)) {
					return new Response("Provider not found!", {
						status: 404,
					});
				}

				let authConfig: ReturnType<typeof config>;
				try {
					authConfig = config(provider);
				} catch (error) {
					console.error(error);
					return new Response("OAuth is not configured", {
						status: 500,
					});
				}

				const state = randomString();
				const data = {
					client_id: authConfig.client.id,
					redirect_uri: getRedirectUri(request, provider),
					response_type: "code",
					scope: scopes[provider],
					state,
				};

				const authorizationUri = new URL(
					`${authConfig.auth.tokenHost}${
						authConfig.auth.authorizePath
					}?${new URLSearchParams(data).toString()}`,
				);

				// Response.redirect() has immutable headers, so build the 302 manually.
				return new Response(null, {
					status: 302,
					headers: {
						Location: authorizationUri.toString(),
						"Set-Cookie": createStateCookie(request, state),
						"Cache-Control": "no-store",
					},
				});
			},
		},
	},
});

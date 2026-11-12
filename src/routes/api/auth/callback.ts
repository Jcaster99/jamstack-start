import { createFileRoute } from "@tanstack/react-router";
import {
	clearStateCookie,
	config,
	getCookie,
	getRedirectUri,
	getSiteOrigin,
	isProvider,
	type Provider,
	STATE_COOKIE,
	safeEqual,
} from "#/libs/auth";

type AuthResult =
	| { status: "success"; content: { token: string; provider: Provider } }
	| { status: "error"; content: { error: string; provider: Provider } };

// Serialize a value so it can be embedded safely inside an inline <script>.
const toScriptLiteral = (value: unknown) =>
	JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026")
		.replaceAll(String.fromCharCode(0x2028), "\\u2028")
		.replaceAll(String.fromCharCode(0x2029), "\\u2029");

// Implements the Decap/Sveltia popup handshake: announce "authorizing:<provider>"
// to the opener, then send the result only to the expected CMS origin.
const renderBody = (siteOrigin: string, result: AuthResult) => {
	const provider = result.content.provider;
	// Sveltia matches the payload with `.+`, which stops at U+2028/U+2029.
	const payload = JSON.stringify(result.content)
		.replaceAll(String.fromCharCode(0x2028), "\\u2028")
		.replaceAll(String.fromCharCode(0x2029), "\\u2029");
	const message = `authorization:${provider}:${result.status}:${payload}`;

	return `<!doctype html>
<html>
  <body>
    <script>
      (() => {
        const origin = ${toScriptLiteral(siteOrigin)};
        const handshake = ${toScriptLiteral(`authorizing:${provider}`)};
        const message = ${toScriptLiteral(message)};
        if (!window.opener) {
          document.body.textContent = "This window can be closed.";
          return;
        }
        const receiveMessage = (event) => {
          if (
            event.origin !== origin ||
            event.source !== window.opener ||
            event.data !== handshake
          ) {
            return;
          }
          window.removeEventListener("message", receiveMessage, false);
          window.opener.postMessage(message, origin);
        };
        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage(handshake, origin);
      })();
    </script>
  </body>
</html>`;
};

const respond = (request: Request, result: AuthResult, status = 200) =>
	new Response(renderBody(getSiteOrigin(request), result), {
		status,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"Set-Cookie": clearStateCookie(request),
		},
	});

const fail = (
	request: Request,
	provider: Provider,
	error: string,
	status = 401,
) =>
	respond(request, { status: "error", content: { error, provider } }, status);

export const Route = createFileRoute("/api/auth/callback")({
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

				// Check state first so a forged callback can neither inject an error
				// message nor clear the cookie of a login in progress.
				const state = searchParams.get("state");
				const expectedState = getCookie(request, STATE_COOKIE);
				if (!state || !expectedState || !safeEqual(state, expectedState)) {
					return new Response("Invalid OAuth state", { status: 401 });
				}

				if (searchParams.get("error")) {
					return fail(request, provider, "Authorization was denied");
				}

				const code = searchParams.get("code");
				if (!code) {
					return fail(request, provider, "Missing authorization code");
				}

				try {
					const authConfig = config(provider);
					const tokenUri = new URL(
						`${authConfig.auth.tokenHost}${authConfig.auth.tokenPath}`,
					);

					const data = {
						code,
						client_id: authConfig.client.id,
						client_secret: authConfig.client.secret,
						grant_type: "authorization_code",
						redirect_uri: getRedirectUri(request, provider),
					};

					const body = await fetch(tokenUri.toString(), {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Accept: "application/json",
						},
						body: JSON.stringify(data),
					});

					const responseData = (await body.json()) as {
						access_token?: string;
						error?: string;
						error_description?: string;
					};

					if (!body.ok || !responseData.access_token) {
						console.error("OAuth token exchange failed", responseData.error);
						return fail(
							request,
							provider,
							responseData.error_description ??
								responseData.error ??
								"Token exchange failed",
						);
					}

					return respond(request, {
						status: "success",
						content: { token: responseData.access_token, provider },
					});
				} catch (error) {
					console.error(error);
					return fail(request, provider, "Authentication failed", 500);
				}
			},
		},
	},
});

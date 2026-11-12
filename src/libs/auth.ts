export type Provider = "github" | "gitlab";

type TypeScopes = {
	[key in Provider]: string;
};

type TypeAuth = {
	tokenHost: string;
	tokenPath: string;
	authorizePath: string;
};

type TypeClient = {
	id: string;
	secret: string;
};

export const STATE_COOKIE = "oauth_state";
const STATE_MAX_AGE = 600;

export const scopes: TypeScopes = {
	github: "repo,user",
	gitlab: "api",
};

const auth: Record<Provider, TypeAuth> = {
	github: {
		tokenHost: "https://github.com",
		tokenPath: "/login/oauth/access_token",
		authorizePath: "/login/oauth/authorize",
	},
	gitlab: {
		tokenHost: "https://gitlab.com",
		tokenPath: "/oauth/token",
		authorizePath: "/oauth/authorize",
	},
};

export const isProvider = (value: string | null): value is Provider =>
	value === "github" || value === "gitlab";

// Read lazily so a missing secret fails the request instead of silently using "".
const getClient = (provider: Provider): TypeClient => {
	const prefix = `OAUTH_${provider.toUpperCase()}`;
	const id = process.env[`${prefix}_CLIENT_ID`];
	const secret = process.env[`${prefix}_CLIENT_SECRET`];
	if (!id || !secret) {
		throw new Error(`Missing ${prefix}_CLIENT_ID or ${prefix}_CLIENT_SECRET`);
	}
	return { id, secret };
};

export const config = (provider: Provider) => ({
	client: getClient(provider),
	auth: auth[provider],
});

// The CMS (/admin) and this OAuth proxy are served from the same origin, so the
// request origin is the only origin Sveltia accepts messages from.
export const getSiteOrigin = (request: Request) => new URL(request.url).origin;

export const getRedirectUri = (request: Request, provider: Provider) =>
	`${getSiteOrigin(request)}/api/auth/callback?provider=${provider}`;

export const randomString = () => crypto.randomUUID().replaceAll("-", "");

const isSecure = (request: Request) =>
	new URL(request.url).protocol === "https:";

export const createStateCookie = (request: Request, state: string) =>
	[
		`${STATE_COOKIE}=${state}`,
		"Path=/api/auth",
		`Max-Age=${STATE_MAX_AGE}`,
		"HttpOnly",
		"SameSite=Lax",
		isSecure(request) && "Secure",
	]
		.filter(Boolean)
		.join("; ");

export const clearStateCookie = (request: Request) =>
	[
		`${STATE_COOKIE}=`,
		"Path=/api/auth",
		"Max-Age=0",
		"HttpOnly",
		"SameSite=Lax",
		isSecure(request) && "Secure",
	]
		.filter(Boolean)
		.join("; ");

export const getCookie = (request: Request, name: string) => {
	const header = request.headers.get("Cookie") ?? "";
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) {
			return rest.join("=");
		}
	}
	return undefined;
};

// Constant-time comparison to avoid leaking the expected state via timing.
export const safeEqual = (a: string, b: string) => {
	if (a.length !== b.length) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
};

// Locale-aware formatting on top of Intl, with cached formatters. Use these
// instead of Lingui's deprecated i18n.number / i18n.date.

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

const cached = <T extends Intl.NumberFormat | Intl.DateTimeFormat>(
	kind: string,
	locale: string,
	options: object,
	create: () => T,
): T => {
	const key = `${kind}|${locale}|${JSON.stringify(options)}`;
	let formatter = cache.get(key) as T | undefined;
	if (!formatter) {
		formatter = create();
		cache.set(key, formatter);
	}
	return formatter;
};

export const formatNumber = (
	locale: string,
	value: number,
	options: Intl.NumberFormatOptions = {},
) =>
	cached(
		"number",
		locale,
		options,
		() => new Intl.NumberFormat(locale, options),
	).format(value);

export const formatCurrency = (
	locale: string,
	value: number,
	options: Intl.NumberFormatOptions = {},
) =>
	formatNumber(locale, value, {
		style: "currency",
		currency: "USD",
		...options,
	});

/** Takes a ratio: 0.024 → "2.4%". */
export const formatPercent = (
	locale: string,
	ratio: number,
	options: Intl.NumberFormatOptions = {},
) => formatNumber(locale, ratio, { style: "percent", ...options });

/**
 * Defaults to the UTC time zone so the server (Workers, UTC) and the browser
 * render the same string; pass `timeZone` to override.
 */
export const formatDate = (
	locale: string,
	value: Date | string | number,
	options: Intl.DateTimeFormatOptions = { dateStyle: "long" },
) => {
	const resolved = { timeZone: "UTC", ...options };
	return cached(
		"date",
		locale,
		resolved,
		() => new Intl.DateTimeFormat(locale, resolved),
	).format(new Date(value));
};

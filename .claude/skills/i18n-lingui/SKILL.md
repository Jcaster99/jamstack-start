---
name: i18n-lingui
description: >
  House rules for translating this app's UI with Lingui on TanStack Start.
  Use whenever writing or changing any user-visible text: React components,
  label maps, error messages, route titles, aria-labels, numbers/currency/dates,
  locale-aware links, or when updating the src/locales catalogs.
---

# i18n with Lingui

The setup already exists. Do not re-create it:

- `src/libs/locales.ts` holds the locale list (`code`, `name`, `nativeName`), `Locale`, `defaultLocale` (`"en"`) and `isLocale`. It is framework-free.
- `src/libs/i18n.ts` holds the `createLinguiStart` config and exports `useLocale`, `LocalizedLink`, `localizePath`, `isValidLocale`, `routerWithI18n`, `ensureLocale`, and re-exports from `locales.ts`.
- `routerWithI18n` wraps the router in `I18nProvider`, so `useLingui()` works in every route component, including `notFoundComponent`.
- Routes live under `src/routes/{-$locale}/`. English has no prefix (`/`); `zh`, `ja`, `th` and `es` are prefixed (`/zh/...`). `{-$locale}/route.tsx` rejects unknown locales with `notFound()` and keeps i18n in sync with the URL.
- Catalogs are `src/locales/en.json` (source) and `zh.json`, `ja.json`, `th.json`, `es.json`. They use the minimal JSON format, and **the message ID is the English source text**.
- UI text only. Translated **content** (posts and so on) lives in `content/<collection>/<locale>/` (see the `content-collections` skill).

## Rule 1: every visible string goes through `i18n._()`

In components, always:

```tsx
import { useLingui } from "@lingui/react";

function NotFound() {
	const { i18n } = useLingui();
	return <h1>{i18n._("404 - Page not found")}</h1>;
}
```

This covers text nodes, `placeholder`, `title`, `alt`, `aria-label`, `sr-only` spans, tooltip content and dialog titles.

Do not use the `t` macro or `<Trans>`, and do not call `msg` inside a component body. The convention is `useLingui()` from `@lingui/react` plus `i18n._(...)`. The argument is either a string literal (Rule 2) or a module-level `msg` descriptor (Rule 3).

## Rule 2: the argument is a string literal

The extractor only sees literals. The first argument must be the full English sentence written inline.

```tsx
// Correct
i18n._("Authors ({count})", { count: authors.length });
i18n._("Edit {file} to get started.", { file: "src/routes/{-$locale}/index.tsx" });

// Wrong: not extractable
i18n._(`Authors (${count})`);
i18n._(label);
i18n._("Authors (" + count + ")");
```

- Interpolate with `{name}` placeholders and a values object.
- Keep whole sentences in one message. Never concatenate translated fragments, because word order differs between languages (Japanese and Thai especially).
- Punctuation and ellipses (`…`) belong inside the message.

## Rule 3: labels declared outside components use `msg`

Labels known at module level (nav items, status maps, option lists) are declared once, outside the component, as `msg` descriptors and rendered with `i18n._(descriptor)`. `src/layouts/AppLayout.tsx` is the reference:

```tsx
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

const navItems = [
	{ to: "/", label: msg({ id: "Home" }) },
	{ to: "/posts", label: msg({ id: "Posts" }) },
] satisfies { to: string; label: MessageDescriptor }[];

// render, with a stable, untranslated key:
{navItems.map((item) => (
	<LocalizedLink key={item.to} to={item.to}>{i18n._(item.label)}</LocalizedLink>
))}
```

For maps keyed by a domain union, use `satisfies Record<Union, MessageDescriptor>`. A new value without a label then fails typecheck:

```ts
export const statusLabels = {
	draft: msg({ id: "Draft" }),
	published: msg({ id: "Published" }),
} satisfies Record<PostStatus, MessageDescriptor>;
```

- A list used by one component stays at the top of that component's file. Shared label maps go in a `labels.ts` next to the feature.
- `msg({ id: "..." })` takes a literal, same as Rule 2. Never build IDs dynamically.
- The `msg` macro is compiled by `lingui({ macroTransform: true })` in `vite.config.ts`. Keep that option.

## Rule 4: numbers, money, percent, dates

Lingui's `i18n.number` and `i18n.date` are deprecated. Use `src/libs/intl.ts`, which wraps `Intl` with the active locale and caches formatters:

```tsx
import { formatCurrency, formatDate, formatNumber, formatPercent } from "#/libs/intl";

const { i18n } = useLingui();
formatDate(i18n.locale, post.date);                                   // October 22, 2026 · 2026年10月22日
formatDate(i18n.locale, ts, { dateStyle: "medium", timeStyle: "short" });
formatNumber(i18n.locale, count);
formatCurrency(i18n.locale, price);                                   // USD by default; pass { currency }
formatPercent(i18n.locale, 0.024, { maximumFractionDigits: 1 });      // ratio in, "2.4%" out
```

- `formatDate` defaults to `timeZone: "UTC"` so server (Workers) and browser render the same text and hydration does not mismatch. Override `timeZone` only in client-only UI.
- `th` uses the Buddhist calendar year by default (`2569`). Pass a locale like `th-TH-u-ca-gregory` if Gregorian years are required.
- Never hand-build strings like `` `$${n.toFixed(2)}` ``. `Intl` output can contain non-breaking spaces (U+00A0), so do not compare formatted strings against plain spaces in tests.

## Rule 5: what is not translated

- CMS content (post titles, bodies, author names and bios): it is translated per locale in `content/`, not through catalogs.
- Brand and product names (`TanStack Start`, `GitHub`), identifiers, file paths and URLs. Pass them as placeholder values (`{file}`) rather than leaving them inside the sentence when they might change.
- `nativeName` in the language switcher: it is already written in the target language.

## Rule 6: route titles and non-component code

Route `head` runs outside React, so use the router context:

```ts
head: ({ match }) => ({
	meta: [{ title: match.context.i18n._("Posts") }],
}),
```

Server functions and other non-React code receive the locale (or an `I18n` instance) as a parameter. Never import a global i18n instance, and never use `t` from `@lingui/core/macro`: during SSR it is not bound to the request locale and throws.

## Rule 7: locale-aware navigation

- Internal links use `LocalizedLink` from `#/libs/i18n` (same props as `Link`, `to` without the locale prefix): `<LocalizedLink to="/posts">`. Its `to` is typed as `string`, so check that the route exists.
- Switch language with `useLocale().switchLocale(code)` and list options from `locales`.
- Loaders read the locale from `context.locale` (URL-derived), never from the cookie.

## Workflow after changing text

From the repo root:

1. Run `bun run i18n:extract`. It adds new IDs to every catalog and removes unused ones (`--clean`). Its table shows the "Missing" count per locale.
2. Fill every new key in `zh.json`, `ja.json`, `th.json` and `es.json`. An empty value means untranslated, and the UI then falls back to English. Keep placeholders exactly as they are (`{count}`), and keep nav and button labels short.
3. Run `bun run i18n:check`. It exits 1 if any translation is missing.
4. Check in the browser at `/zh/...`, `/ja/...`, `/th/...` and `/es/...`: the text, the date formats, and the layout with longer (es) or wider (ja, zh) strings.

Do not edit IDs in the catalogs by hand. Change the English literal in code and re-extract. Changing an English string creates a new ID, so its translations must be redone in every catalog.

To add or remove a language, use the `add-locale` skill. It also covers the CMS and content folders, and the two-letter code rule.

## Checklist

- [ ] No hardcoded visible string, placeholder, alt or aria-label in the diff.
- [ ] Every `i18n._()` argument is a complete English literal or a module-level `msg` descriptor; label maps use `satisfies`.
- [ ] Placeholders instead of concatenation; one sentence per message.
- [ ] Numbers, money, percent and dates go through `#/libs/intl`.
- [ ] Links use `LocalizedLink`.
- [ ] `bun run i18n:check` passes (no empty values in any catalog).

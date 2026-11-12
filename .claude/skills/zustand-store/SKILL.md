---
name: zustand-store
description: >
  House pattern for Zustand client stores (src/store). Use whenever adding or
  changing client-side global state: open dialogs/menus/sheets, UI preferences,
  unsent form drafts, local upload queues. Covers the createXStore factory,
  grouped actions, useShallow selector hooks, SSR safety on Cloudflare Workers,
  persist, and what must never live in a store (content, server data, auth).
---

# Zustand stores

Zustand is **not installed yet**. Add it when the first store is needed: `bun add zustand`.

Stores live in `src/store/`, one file per store, named after the domain: `ui-preferences.ts`, `contact-draft.ts`, `mobile-nav.ts`. Import them directly (no barrel) through the alias, without file extensions: `import { useMobileNavActions } from "#/store/mobile-nav"`.

## What belongs in a store

Only client-owned UI state. Before creating a store, check this table:

| State | Where it lives |
| --- | --- |
| CMS content (posts, authors, ...) and anything from the server | Route `loader` → server function in `src/server/`. Read with `Route.useLoaderData()`; never copied into a store. |
| Anything that should survive a shared link, reload or back button: locale, current page, filters, search, pagination | Router params / search params (locale is the `{-$locale}` segment) |
| State used by one component or one subtree | `useState` / props / context |
| CMS login, GitHub tokens | Owned by Sveltia CMS in `/admin`; the app never stores them |
| Open overlay or mobile menu, panel visibility, unsent form drafts, local upload progress, UI preferences | **Zustand** |

A store never authorizes anything. It must not hold secrets, tokens or anything the server treats as authority.

## The pattern: state and actions are separate

Every store splits **state** (plain data) from **actions** (functions that change it). Actions live under one `actions` key, so a component that only dispatches subscribes to a stable reference and never re-renders when the data changes.

Each store file has the same parts, in this order:

1. **State interface** `IX`: `readonly` data fields only, no functions.
2. **Initial state** `initXState: IX`.
3. **Actions interface** `IXActions`: `{ readonly actions: { ... } }`.
4. **Store type** `IXStore = IX & IXActions`.
5. **Factory** `createXStore(initState = initXState)` using vanilla `createStore` from `zustand`, so tests and per-request trees can create fresh instances.
6. **Instance**: a module singleton or a per-request provider (see SSR safety).
7. **Hooks**: `useX(selector)` for state via `useShallow`, and `useXActions()` for actions.

### Skeleton

Replace `X`/`x` with the store's domain name. The example is a contact-form draft store (`src/store/contact-draft.ts`) that keeps unsent text per form.

```ts
import { createStore, useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

// 1. State: data only.
export interface IContactDraft {
	readonly drafts: Readonly<Record<string, string>>;
}

// 2. Initial state.
export const initContactDraftState: IContactDraft = {
	drafts: {},
};

// 3. Actions: every mutator, grouped under `actions`.
export interface IContactDraftActions {
	readonly actions: {
		setDraft: (formId: string, text: string) => void;
		clearDraft: (formId: string) => void;
		reset: () => void;
	};
}

// 4. Store type.
export type IContactDraftStore = IContactDraft & IContactDraftActions;

// 5. Factory.
export const createContactDraftStore = (
	initState: IContactDraft = initContactDraftState,
) =>
	createStore<IContactDraftStore>()((set) => ({
		...initState,
		actions: {
			setDraft: (formId, text) =>
				set((state) => ({ drafts: { ...state.drafts, [formId]: text } })),
			clearDraft: (formId) =>
				set((state) => {
					const { [formId]: _removed, ...drafts } = state.drafts;
					return { drafts };
				}),
			reset: () => set(initState),
		},
	}));

export type ContactDraftStore = ReturnType<typeof createContactDraftStore>;

// 6. Instance: written only by client interactions, so a singleton is safe.
export const contactDraftStore = createContactDraftStore();

// 7. Hooks.
export const useContactDraft = <T>(selector: (state: IContactDraft) => T) =>
	useStore(contactDraftStore, useShallow(selector));

export const useContactDraftActions = () =>
	useStore(
		contactDraftStore,
		useShallow((state) => state.actions),
	);
```

Usage:

```tsx
// Reads one slice; re-renders only when this draft changes.
const draft = useContactDraft((s) => s.drafts[formId] ?? "");

// Dispatch only; never re-renders because of state changes.
const { setDraft, clearDraft } = useContactDraftActions();
setDraft(formId, event.target.value);
```

Rules for the pattern:

- `useX` selectors take `IX` (state), not the full store, so components cannot reach actions through the state hook.
- Select the smallest slice a component needs. Return primitives or small objects (`useShallow` compares them shallowly).
- Actions are the only way to change state. Components never call `xStore.setState` directly.
- `reset` restores `initState`. Add it to every store (tests, sign-out).
- Derived values are computed in the selector or component, not stored.

## SSR safety (TanStack Start on Cloudflare Workers)

Modules are evaluated once per Worker isolate, and **an isolate serves many requests from different users**. Module state on the server is shared across all of them.

- A **module singleton** (like `contactDraftStore`) is allowed only when the store is written exclusively by client interactions (event handlers, client-only effects) and starts from a constant initial state. Never write to it during render, in a `loader` or `beforeLoad`, or in a server function.
- **Per-request or per-user data** (any store seeded from loader data) must not be a singleton. Create it per tree with a context provider:

```tsx
import { createContext, use, useState } from "react";

const ReaderPrefsContext = createContext<ReaderPrefsStore | null>(null);

export function ReaderPrefsProvider({
	initial,
	children,
}: {
	initial?: IReaderPrefs;
	children: React.ReactNode;
}) {
	const [store] = useState(() => createReaderPrefsStore(initial));
	return <ReaderPrefsContext value={store}>{children}</ReaderPrefsContext>;
}

export const useReaderPrefs = <T,>(selector: (s: IReaderPrefs) => T) => {
	const store = use(ReaderPrefsContext);
	if (!store) throw new Error("useReaderPrefs needs ReaderPrefsProvider");
	return useStore(store, useShallow(selector));
};
```

- Never read `window`, `localStorage` or `document` while creating a store or during render. Do it in event handlers or `useEffect`.

## Persisted stores

For preferences or drafts that should survive a reload, add `persist` with `skipHydration`, so the server HTML and the first client render match. Then rehydrate after mount:

```ts
import { createJSONStorage, persist } from "zustand/middleware";

export const createUiPreferencesStore = (initState = initUiPreferencesState) =>
	createStore<IUiPreferencesStore>()(
		persist(
			(set) => ({
				...initState,
				actions: {
					toggleCompactLayout: () =>
						set((s) => ({ compactLayout: !s.compactLayout })),
				},
			}),
			{
				name: "app.ui-preferences", // prefix with the project name
				version: 1,
				storage: createJSONStorage(() => localStorage),
				skipHydration: true,
				partialize: ({ actions: _actions, ...state }) => state,
			},
		),
	);

// Once, in a client-only effect (e.g. RootDocument in src/routes/__root.tsx):
useEffect(() => {
	void uiPreferencesStore.persist.rehydrate();
}, []);
```

- Always `partialize` out `actions`.
- Bump `version` and add `migrate` when the persisted shape changes.
- Never persist server data or anything sensitive.
- Do not persist the locale: the URL is the source of truth (the `locale` cookie is managed by `#/libs/i18n`).

## UI text in stores

Stores hold data, not translated strings. Store a key or enum (`status: "saved"`) and translate at render time with a `msg` label map (see the `i18n-lingui` skill). Then switching language updates the text.

## Checklist

- [ ] The state is client-only UI state (see the table). It is not content, server data or auth.
- [ ] `zustand` is in `package.json` dependencies.
- [ ] The file is `src/store/<name>.ts`, imported via `#/store/<name>` without an extension.
- [ ] State (`IX`) and actions (`IXActions`) are separate interfaces, and `initXState`, `createXStore`, `useX` and `useXActions` are all present.
- [ ] Mutators are grouped under `actions`; components dispatch through `useXActions()` and never call `setState` directly.
- [ ] Selectors go through `useShallow` and select the smallest slice needed.
- [ ] Singleton only if written by client interactions only; otherwise a context provider.
- [ ] Persisted stores use `skipHydration`, `partialize` and `version`.
- [ ] No translated strings stored; keys are translated at render time.

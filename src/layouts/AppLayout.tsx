import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import type { PropsWithChildren } from "react";
import { type Locale, LocalizedLink, locales, useLocale } from "#/libs/i18n";

const navItems = [
	{ to: "/", label: msg({ id: "Home" }) },
	{ to: "/posts", label: msg({ id: "Posts" }) },
] satisfies { to: string; label: MessageDescriptor }[];

export function AppLayout({ children }: PropsWithChildren) {
	const { i18n } = useLingui();
	const { currentLocale, switchLocale } = useLocale();

	return (
		<div className="flex min-h-screen flex-col bg-white text-slate-900">
			<header className="border-b border-slate-200">
				<div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
					<nav className="flex items-center gap-4 text-sm font-medium">
						{navItems.map((item) => (
							<LocalizedLink
								key={item.to}
								to={item.to}
								className="hover:text-slate-600"
							>
								{i18n._(item.label)}
							</LocalizedLink>
						))}
					</nav>

					<label className="flex items-center gap-2 text-sm">
						<span>{i18n._("Switch language")}</span>
						<select
							className="rounded-md border border-slate-300 bg-white px-3 py-2"
							value={currentLocale}
							onChange={(event) => switchLocale(event.target.value as Locale)}
						>
							{locales.map((locale) => (
								<option key={locale.code} value={locale.code}>
									{locale.nativeName}
								</option>
							))}
						</select>
					</label>
				</div>
			</header>

			<main className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-8">
				{children}
			</main>
		</div>
	);
}

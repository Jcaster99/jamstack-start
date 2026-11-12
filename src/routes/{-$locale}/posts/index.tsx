import { useLingui } from "@lingui/react";
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "#/layouts/AppLayout";
import { LocalizedLink } from "#/libs/i18n";
import { formatDate } from "#/libs/intl";
import { listPosts } from "#/server/posts";

export const Route = createFileRoute("/{-$locale}/posts/")({
	loader: ({ context }) => listPosts({ data: { locale: context.locale } }),
	head: ({ match }) => ({
		meta: [{ title: match.context.i18n._("Posts") }],
	}),
	component: PostsPage,
});

function PostsPage() {
	const posts = Route.useLoaderData();
	const { i18n } = useLingui();

	return (
		<AppLayout>
			<div className="w-full">
				<h1 className="mb-8 text-4xl font-bold">{i18n._("Posts")}</h1>

				{posts.length === 0 ? (
					<p className="text-slate-600">{i18n._("No posts yet.")}</p>
				) : (
					<ul className="flex flex-col gap-6">
						{posts.map((post) => (
							<li
								key={post.slug}
								lang={post.locale}
								className="border-b border-slate-200 pb-6"
							>
								<LocalizedLink
									to={`/posts/${post.slug}`}
									className="text-2xl font-semibold hover:text-slate-600"
								>
									{post.title}
								</LocalizedLink>
								<p className="mt-1 text-sm text-slate-500">
									{formatDate(i18n.locale, post.date)} · {post.author.name}
									{post.draft && (
										<span className="ml-2 rounded bg-amber-100 px-1.5 text-amber-800">
											{i18n._("Draft")}
										</span>
									)}
								</p>
								{post.summary && (
									<p className="mt-2 text-slate-700">{post.summary}</p>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</AppLayout>
	);
}

import type { Paginated, StorefrontBlogPost } from '@repo/contracts';
import Link from 'next/link';
import { PageLinks } from '@/components/product-grid';
import { sf } from '@/lib/api';

export const metadata = { title: 'Blog' };

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  const { tag, page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const posts = await sf<Paginated<StorefrontBlogPost>>('/blog', {
    query: { tag: tag?.slice(0, 40), page },
  });
  const href = (p: number) =>
    `/blog?${new URLSearchParams({ ...(tag ? { tag } : {}), page: String(p) })}`;

  return (
    <>
      <header className="border-b border-zinc-200 pb-8">
        <p className="eyebrow text-zinc-500">Journal</p>
        <h1 className="page-title t-title mt-2">{tag ? `Blog · ${tag}` : 'Blog'}</h1>
        {tag ? (
          <Link
            href="/blog"
            className="mt-3 inline-block text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900"
          >
            All posts
          </Link>
        ) : null}
      </header>
      {posts.items.length === 0 ? (
        <p className="mt-10 text-zinc-600">No posts yet. Check back soon.</p>
      ) : (
        <ul className="mt-10 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {posts.items.map((post) => (
            <li key={post.handle}>
              <article className="group relative flex h-full flex-col border-t border-zinc-900 pt-5">
                <p className="eyebrow text-zinc-500">
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  {post.author ? ` · ${post.author}` : ''}
                </p>
                <h2 className="t-title mt-3 text-2xl break-words">
                  <Link
                    href={`/blog/${post.handle}`}
                    className="decoration-1 underline-offset-4 after:absolute after:inset-0 group-hover:underline"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt ? (
                  <p className="mt-3 line-clamp-4 leading-relaxed text-zinc-600">{post.excerpt}</p>
                ) : null}
                <span aria-hidden="true" className="mt-auto pt-5 text-sm font-medium text-zinc-900">
                  Read the story{' '}
                  <span className="inline-block transition group-hover:translate-x-1">→</span>
                </span>
              </article>
            </li>
          ))}
        </ul>
      )}
      <PageLinks page={posts.page} pageSize={posts.pageSize} total={posts.total} hrefFor={href} />
    </>
  );
}

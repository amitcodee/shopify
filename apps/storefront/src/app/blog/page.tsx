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
      <h1 className="text-3xl font-bold tracking-tight">{tag ? `Blog · ${tag}` : 'Blog'}</h1>
      {tag ? (
        <Link href="/blog" className="mt-2 inline-block text-sm text-zinc-600 underline">
          All posts
        </Link>
      ) : null}
      {posts.items.length === 0 ? (
        <p className="mt-8 text-zinc-600">No posts yet.</p>
      ) : (
        <ul className="mt-8 grid gap-8 sm:grid-cols-2">
          {posts.items.map((post) => (
            <li key={post.handle}>
              <article>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  {post.author ? ` · ${post.author}` : ''}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  <Link href={`/blog/${post.handle}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt ? <p className="mt-2 text-zinc-600">{post.excerpt}</p> : null}
              </article>
            </li>
          ))}
        </ul>
      )}
      <PageLinks page={posts.page} pageSize={posts.pageSize} total={posts.total} hrefFor={href} />
    </>
  );
}

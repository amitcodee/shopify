import type { StorefrontBlogPost } from '@repo/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlainText } from '@/components/content';
import { isNotFound, sf } from '@/lib/api';

async function getPost(handle: string): Promise<StorefrontBlogPost | null> {
  try {
    return await sf<StorefrontBlogPost>(`/blog/${encodeURIComponent(handle)}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const post = await getPost((await params).handle);
  return post ? { title: post.title, description: post.excerpt || undefined } : {};
}

export default async function BlogPostPage({ params }: { params: Promise<{ handle: string }> }) {
  const post = await getPost((await params).handle);
  if (!post) notFound();
  return (
    <article>
      <Link href="/blog" className="text-sm text-zinc-600 hover:underline">
        ← Blog
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{post.title}</h1>
      <p className="mb-6 mt-2 text-sm text-zinc-500">
        <time dateTime={post.publishedAt}>
          {new Date(post.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        {post.author ? ` · ${post.author}` : ''}
      </p>
      <PlainText body={post.body} />
      {post.tags.length > 0 ? (
        <p className="mt-8 flex flex-wrap gap-2 text-sm">
          {post.tags.map((t) => (
            <Link
              key={t}
              href={`/blog?tag=${encodeURIComponent(t)}`}
              className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 hover:bg-zinc-200"
            >
              {t}
            </Link>
          ))}
        </p>
      ) : null}
    </article>
  );
}

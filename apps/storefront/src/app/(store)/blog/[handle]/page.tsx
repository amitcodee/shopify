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
    <article className="mx-auto max-w-2xl">
      <Link href="/blog" className="text-sm text-zinc-600 hover:text-zinc-900 hover:underline">
        ← Blog
      </Link>
      <h1 className="page-title t-title mt-6">{post.title}</h1>
      <p className="eyebrow mt-4 mb-10 border-b border-zinc-200 pb-8 text-zinc-500">
        <time dateTime={post.publishedAt}>
          {new Date(post.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        {post.author ? ` · ${post.author}` : ''}
      </p>
      <div className="text-[1.0625rem] leading-[1.8]">
        <PlainText body={post.body} />
      </div>
      {post.tags.length > 0 ? (
        <p className="mt-12 flex flex-wrap gap-2 border-t border-zinc-200 pt-8 text-sm">
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

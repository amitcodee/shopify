import type { StorefrontBlogPost } from '@repo/contracts';
import Link from 'next/link';
import { SectionHeader } from './section-header';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/** The three newest blog posts as cards. The title link covers the whole card. */
export function BlogPosts({ posts }: { posts: StorefrontBlogPost[] }) {
  return (
    <section aria-labelledby="journal-heading" className="store-section">
      <SectionHeader id="journal-heading" title="From the blog" eyebrow="Journal" href="/blog" />
      <ul className="grid gap-4 md:grid-cols-3 lg:gap-6">
        {posts.map((post) => (
          <li key={post.handle}>
            <article className="group relative flex h-full flex-col rounded-xl border border-zinc-200 bg-surface p-6 transition hover:border-zinc-400">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              </p>
              <h3 className="mt-3 font-heading text-lg font-semibold leading-snug break-words sm:text-xl">
                <Link
                  href={`/blog/${post.handle}`}
                  className="after:absolute after:inset-0 after:rounded-xl group-hover:underline"
                >
                  {post.title}
                </Link>
              </h3>
              {post.excerpt ? (
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-600">
                  {post.excerpt}
                </p>
              ) : null}
              <span aria-hidden="true" className="mt-auto pt-5 text-sm font-medium text-zinc-900">
                Read more{' '}
                <span className="inline-block transition group-hover:translate-x-1">→</span>
              </span>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

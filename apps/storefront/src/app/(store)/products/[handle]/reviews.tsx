import type { MyReview, ProductReviews, ReviewSort } from '@repo/contracts';
import Link from 'next/link';
import { Stars } from '@/components/product/stars';
import { sf } from '@/lib/api';
import { getCustomerToken } from '@/lib/shop';
import { HelpfulButton, ReviewSortSelect } from './review-controls';
import { ReviewForm } from './review-form';

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Published reviews with the star breakdown, sorting and star filter, and the form for buyers. */
export async function ProductReviewsSection({
  handle,
  page,
  sort,
  stars,
}: {
  handle: string;
  page: number;
  sort: string | undefined;
  stars: string | undefined;
}) {
  const path = `/products/${encodeURIComponent(handle)}/reviews`;
  const customerToken = await getCustomerToken();
  const [reviews, mine] = await Promise.all([
    sf<ProductReviews>(path, {
      query: { page, ...(sort ? { sort } : {}), ...(stars ? { stars } : {}) },
    }),
    sf<MyReview>(`${path}/mine`, { customerToken }),
  ]);
  const { rating, distribution } = reviews;
  const total = rating?.count ?? 0;
  const voted = new Set(mine.helpfulReviewIds);
  const href = (p: { page?: number; sort?: string; stars?: number | null }) => {
    const params = new URLSearchParams();
    const nextSort = p.sort ?? reviews.sort;
    const nextStars = p.stars === undefined ? reviews.stars : p.stars;
    if (p.page && p.page > 1) params.set('reviews', String(p.page));
    if (nextSort !== 'newest') params.set('review_sort', nextSort);
    if (nextStars) params.set('review_stars', String(nextStars));
    const query = params.toString();
    return `/products/${handle}${query ? `?${query}` : ''}#reviews`;
  };
  const pageHref = (n: number) => href({ page: n });
  const sortHref = href({ sort: '__SORT__' });

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="mt-20 scroll-mt-24 border-t border-zinc-200 pt-14 sm:mt-28"
    >
      <div className="section-header">
        <div>
          <h2 id="reviews-heading" className="section-title t-title text-zinc-900">
            Customer reviews
          </h2>
          <span aria-hidden="true" className="section-rule" />
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
        <div className="space-y-6">
          {rating ? (
            <div>
              <p className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-zinc-900 tabular-nums">
                  {rating.average.toFixed(1)}
                </span>
                <span className="text-sm text-zinc-500">out of 5</span>
              </p>
              <div className="mt-2">
                <Stars value={rating.average} className="size-5" />
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                Based on {total} review{total === 1 ? '' : 's'} from verified buyers
              </p>
              <dl className="mt-5 space-y-1.5">
                {distribution.map((count, i) => {
                  const stars = 5 - i;
                  const share = total ? Math.round((count / total) * 100) : 0;
                  const active = reviews.stars === stars;
                  const bar = (
                    <span className="flex flex-1 items-center gap-3">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <span
                          className="block h-full rounded-full bg-amber-500"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                      <span className="w-9 text-right text-zinc-500 tabular-nums">{count}</span>
                    </span>
                  );
                  return (
                    <div key={stars} className="flex items-center gap-3 text-sm">
                      <dt className="w-12 shrink-0 text-zinc-600">{stars} star</dt>
                      <dd className="flex flex-1">
                        {count > 0 ? (
                          <Link
                            href={href({ page: 1, stars: active ? null : stars })}
                            scroll={false}
                            aria-current={active ? 'true' : undefined}
                            aria-label={`${active ? 'Show all reviews' : `Show only ${stars}-star reviews`} (${count})`}
                            className={`-mx-1.5 flex flex-1 items-center rounded-md px-1.5 py-0.5 hover:bg-zinc-50 ${active ? 'bg-zinc-100 ring-1 ring-zinc-300' : ''}`}
                          >
                            {bar}
                          </Link>
                        ) : (
                          bar
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No reviews yet.</p>
          )}
          {mine.canReview ? (
            <ReviewForm handle={handle} mine={mine} />
          ) : (
            <div className="rounded-xl border border-zinc-200 p-5 text-sm text-zinc-600">
              <p>{mine.reason}</p>
              {mine.reason?.startsWith('Sign in') ? (
                <Link
                  href={`/account/login?next=${encodeURIComponent(`/products/${handle}#reviews`)}`}
                  className="btn btn-outline mt-4 inline-flex min-h-11 items-center px-5"
                >
                  Sign in
                </Link>
              ) : null}
            </div>
          )}
        </div>

        <div>
          {total > 1 ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-600">
                {reviews.stars ? (
                  <>
                    {reviews.total} {reviews.stars}-star review{reviews.total === 1 ? '' : 's'} ·{' '}
                    <Link
                      href={href({ page: 1, stars: null })}
                      scroll={false}
                      className="font-medium text-zinc-900 underline"
                    >
                      Show all
                    </Link>
                  </>
                ) : (
                  `${total} reviews`
                )}
              </p>
              <ReviewSortSelect value={reviews.sort as ReviewSort} hrefFor={sortHref} />
            </div>
          ) : null}
          {reviews.items.length > 0 ? (
            <ol className="divide-y divide-zinc-200 border-y border-zinc-200">
              {reviews.items.map((r) => (
                <li key={r.id} className="py-6">
                  <article>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={r.rating} />
                      {r.title ? <h3 className="font-semibold text-zinc-900">{r.title}</h3> : null}
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      <span className="font-medium text-zinc-700">{r.authorName}</span>
                      <span className="mx-1.5">·</span>
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-3.5">
                          <path
                            fill="currentColor"
                            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0z"
                          />
                        </svg>
                        Verified buyer
                      </span>
                      <span className="mx-1.5">·</span>
                      <time dateTime={r.date}>{dateFormat.format(new Date(r.date))}</time>
                    </p>
                    <p className="mt-3 text-[0.9375rem] leading-7 whitespace-pre-line text-zinc-700">
                      {r.body}
                    </p>
                    {r.reply ? (
                      <div className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm">
                        <p className="font-medium text-zinc-900">Reply from the store</p>
                        <p className="mt-1 whitespace-pre-line text-zinc-700">{r.reply}</p>
                      </div>
                    ) : null}
                    <HelpfulButton
                      handle={handle}
                      reviewId={r.id}
                      count={r.helpfulCount}
                      marked={voted.has(r.id)}
                      signedIn={Boolean(customerToken)}
                      own={mine.review?.id === r.id}
                    />
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl bg-surface px-5 py-8 text-center text-sm text-zinc-600">
              Be the first to review this product after you buy it.
            </p>
          )}
          {reviews.pageCount > 1 ? (
            <nav
              aria-label="Review pages"
              className="mt-6 flex items-center justify-between text-sm"
            >
              {reviews.page > 1 ? (
                <Link href={pageHref(reviews.page - 1)} className="font-medium underline">
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-zinc-500">
                Page {reviews.page} of {reviews.pageCount}
              </span>
              {reviews.page < reviews.pageCount ? (
                <Link href={pageHref(reviews.page + 1)} className="font-medium underline">
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </section>
  );
}

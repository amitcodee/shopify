import {
  type AdminReview,
  type Paginated,
  parseStoreApps,
  type ReviewStatus,
  type StoreApps,
} from '@repo/contracts';
import Link from 'next/link';
import { ActionForm, SubmitButton, TextAreaField } from '@/components/form';
import { Icon } from '@/components/icons';
import {
  Alert,
  Badge,
  ButtonLink,
  EmptyState,
  formatDateTime,
  PageHeader,
  Pagination,
  ViewTabs,
} from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { storefrontUrlFor } from '@/lib/storefront';
import { ConfirmButton } from '../confirm-button';
import {
  deleteReviewAction,
  publishReviewAction,
  rejectReviewAction,
  removeReviewPhotoAction,
  replyReviewAction,
} from './actions';

const VIEWS: { key: ReviewStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING', label: 'To approve' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
];

const STATUS: Record<ReviewStatus, { label: string; tone: 'yellow' | 'green' | 'gray' }> = {
  PENDING: { label: 'To approve', tone: 'yellow' },
  PUBLISHED: { label: 'Published', tone: 'green' },
  REJECTED: { label: 'Rejected', tone: 'gray' },
};

function StarRow({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          aria-hidden
          className={`h-4 w-4 ${n <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`}
        />
      ))}
    </span>
  );
}

function ReviewCard({
  storeId,
  review: r,
  canEdit,
  storefrontUrl,
}: {
  storeId: string;
  review: AdminReview;
  canEdit: boolean;
  storefrontUrl: string;
}) {
  const status = STATUS[r.status];
  return (
    <li className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StarRow rating={r.rating} />
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          {r.title ? <h3 className="mt-2 font-semibold text-slate-900">{r.title}</h3> : null}
        </div>
        <p className="text-right text-xs leading-5 text-slate-500">
          {formatDateTime(r.createdAt)}
          {r.updatedAt !== r.createdAt ? <span className="block">edited</span> : null}
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 whitespace-pre-line text-slate-700">{r.body}</p>
      {r.photos.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-3" aria-label="Photos from the customer">
          {r.photos.map((p, i) => (
            <li key={p.id} className="space-y-1.5">
              <a href={p.url} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- API media, sized here */}
                <img
                  src={p.thumbUrl}
                  alt={`Photo ${i + 1} on this review`}
                  width={96}
                  height={96}
                  className="size-24 rounded-lg object-cover ring-1 ring-slate-200"
                />
              </a>
              {canEdit ? (
                <ActionForm action={removeReviewPhotoAction.bind(null, storeId, r.id, p.id)}>
                  <SubmitButton size="sm" variant="secondary">
                    Remove
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <div>
          <dt className="inline">Product: </dt>
          <dd className="inline">
            <a
              href={`${storefrontUrl}/products/${r.product.handle}#reviews`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-slate-700 hover:underline"
            >
              {r.product.title}
            </a>
          </dd>
        </div>
        <div>
          <dt className="inline">Shown as: </dt>
          <dd className="inline font-medium text-slate-700">{r.authorName}</dd>
        </div>
        <div>
          <dt className="inline">Customer: </dt>
          <dd className="inline">
            <Link
              href={`/s/${storeId}/customers/${r.customer.id}`}
              className="font-medium text-slate-700 hover:underline"
            >
              {r.customer.email}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="inline">Bought in: </dt>
          <dd className="inline">
            <Link
              href={`/s/${storeId}/orders/${r.order.id}`}
              className="font-medium text-slate-700 hover:underline"
            >
              #{r.order.number}
            </Link>
          </dd>
        </div>
      </dl>

      {canEdit ? (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {r.status !== 'PUBLISHED' ? (
              <ActionForm action={publishReviewAction.bind(null, storeId, r.id)}>
                <SubmitButton size="sm">Publish</SubmitButton>
              </ActionForm>
            ) : null}
            {r.status !== 'REJECTED' ? (
              <ActionForm action={rejectReviewAction.bind(null, storeId, r.id)}>
                <SubmitButton size="sm" variant="secondary">
                  {r.status === 'PUBLISHED' ? 'Unpublish' : 'Reject'}
                </SubmitButton>
              </ActionForm>
            ) : null}
            <div className="ml-auto">
              <ConfirmButton
                action={deleteReviewAction.bind(null, storeId, r.id)}
                label="Delete"
                confirmLabel="Delete for good"
              />
            </div>
          </div>
          <ActionForm action={replyReviewAction.bind(null, storeId, r.id)} className="space-y-2">
            <TextAreaField
              name="reply"
              label="Public reply"
              rows={2}
              maxLength={2000}
              defaultValue={r.reply ?? ''}
              hint="Shown under the review on your store. Leave empty to remove it."
            />
            <SubmitButton size="sm" variant="secondary">
              {r.reply ? 'Update reply' : 'Reply'}
            </SubmitButton>
          </ActionForm>
        </div>
      ) : r.reply ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-medium">Your reply: </span>
          {r.reply}
        </p>
      ) : null}
    </li>
  );
}

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const { view = 'PENDING', page } = await searchParams;
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0]!;
  const [store, reviews, apps] = await Promise.all([
    getStore(storeId),
    api<Paginated<AdminReview>>(`/admin/stores/${storeId}/reviews`, {
      query: { status: current.key === 'ALL' ? undefined : current.key, page: Number(page) || 1 },
    }),
    api<StoreApps>(`/admin/stores/${storeId}/apps`).then(parseStoreApps),
  ]);
  const canEdit = store.permissions.includes('products:write');
  const base = `/s/${storeId}/reviews`;
  const app = apps.productReviews;

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Ratings and reviews from customers who bought the product. Publish the ones that follow your rules, reply in public, and reject spam or abuse. Do not remove reviews just because they are negative."
        actions={
          <ButtonLink href={`/s/${storeId}/apps`} variant="secondary" size="sm">
            Review settings
          </ButtonLink>
        }
      />
      {!app.enabled ? (
        <div className="mb-5">
          <Alert tone="info">
            The Product reviews app is off, so shoppers cannot see or write reviews. Turn it on
            under{' '}
            <Link href={`/s/${storeId}/apps`} className="font-medium underline">
              Apps
            </Link>
            .
          </Alert>
        </div>
      ) : app.autoPublish ? (
        <div className="mb-5">
          <Alert tone="info">
            Reviews are published automatically. You can still unpublish or delete any of them.
          </Alert>
        </div>
      ) : null}
      <div className="mb-4">
        <ViewTabs
          label="Review views"
          items={VIEWS.map((v) => ({
            label: v.label,
            href: `${base}?view=${v.key}`,
            active: current.key === v.key,
          }))}
        />
      </div>
      {reviews.items.length === 0 ? (
        <EmptyState
          icon="star"
          title={current.key === 'PENDING' ? 'Nothing to approve' : 'No reviews here'}
          description="Customers who bought a product can review it from the product page once the app is on."
        />
      ) : (
        <>
          <ul className="space-y-3">
            {reviews.items.map((r) => (
              <ReviewCard
                key={r.id}
                storeId={storeId}
                review={r}
                canEdit={canEdit}
                storefrontUrl={storefrontUrlFor(store.subdomain)}
              />
            ))}
          </ul>
          <div className="mt-4">
            <Pagination
              page={reviews.page}
              pageSize={reviews.pageSize}
              total={reviews.total}
              hrefFor={(p: number) => `${base}?view=${current.key}&page=${p}`}
            />
          </div>
        </>
      )}
    </>
  );
}

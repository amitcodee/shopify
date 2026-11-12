import type { StoreDetail } from '@repo/contracts';
import Link from 'next/link';
import { Alert, formatDateTime } from '@/components/ui';
import { SmallAction } from './settings/small-action';
import { reopenStoreAction } from './store-actions';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / DAY_MS));
}

/** Trial countdown, failed payments and lapsed billing, shown above every store page. */
export function BillingBanner({ store }: { store: StoreDetail }) {
  const billingHref = `/s/${store.id}/settings/billing`;
  const canBill = store.permissions.includes('billing:manage');
  const cta = canBill ? (
    <Link href={billingHref} className="font-semibold underline underline-offset-2">
      {store.billingAction === 'update_payment'
        ? 'Update payment'
        : store.billingAction === 'authorize'
          ? 'Authorise payment'
          : 'Choose a plan'}
    </Link>
  ) : (
    <span>Ask the store owner to update billing.</span>
  );

  if (store.billingLocked) {
    return (
      <div className="mb-6">
        <Alert tone="error">
          Your store is paused: the trial has ended or the subscription lapsed, so the storefront is
          offline. Your products, orders and settings are safe. {cta}
        </Alert>
      </div>
    );
  }
  if (store.billingAction === 'update_payment') {
    return (
      <div className="mb-6">
        <Alert tone="warning">
          Your last subscription payment failed. Your store keeps working for a few days while we
          retry. {cta}
        </Alert>
      </div>
    );
  }
  if (store.billingAction === 'authorize') {
    return (
      <div className="mb-6">
        <Alert tone="warning">
          Your introductory months are ending. Authorise the regular monthly payment to keep your
          store online. {cta}
        </Alert>
      </div>
    );
  }
  if (store.trialEndsAt && store.billingAction === 'subscribe') {
    const days = daysUntil(store.trialEndsAt);
    return (
      <div className="mb-6">
        <Alert tone={days <= 2 ? 'warning' : 'info'}>
          {days === 0
            ? 'Your free trial ends today.'
            : `${days} day${days === 1 ? '' : 's'} left in your free trial.`}{' '}
          Subscribe now and keep the rest of your trial — you are only charged when it ends. {cta}
        </Alert>
      </div>
    );
  }
  return null;
}

/** A store its owner closed: offline, erased on a date unless reopened. */
export function ClosedStoreNotice({ store }: { store: StoreDetail }) {
  const owner = store.role === 'OWNER';
  return (
    <div className="space-y-4">
      <Alert tone="error">
        This store is closed and its storefront is offline.
        {store.deletionScheduledAt
          ? ` All of its data will be permanently deleted on ${formatDateTime(store.deletionScheduledAt)} unless you reopen it.`
          : null}
      </Alert>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Before it is deleted</h2>
        <p className="mt-1 text-sm text-slate-600">
          Download your data:{' '}
          <a className="underline" href={`/s/${store.id}/products/export`}>
            products
          </a>
          ,{' '}
          <a className="underline" href={`/s/${store.id}/orders/export`}>
            orders
          </a>
          .
        </p>
        {owner ? (
          <div className="mt-4">
            <SmallAction action={reopenStoreAction.bind(null, store.id)} label="Reopen store" />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Only the store owner can reopen it.</p>
        )}
      </div>
    </div>
  );
}

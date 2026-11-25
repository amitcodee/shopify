import { type CustomerAccount, formatMoney } from '@repo/contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sf, StorefrontApiError } from '@/lib/api';
import { getCustomerToken, getShop } from '@/lib/shop';
import { setReviewEmailsAction } from './actions';
import { LogoutButton } from './forms';

export const metadata = { title: 'Your account' };

export default async function AccountPage() {
  const customerToken = await getCustomerToken();
  if (!customerToken) redirect('/account/login');
  let account: CustomerAccount;
  const shop = await getShop();
  try {
    account = await sf<CustomerAccount>('/customers/me', { customerToken });
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 401) redirect('/account/login');
    throw error;
  }

  return (
    <>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="page-title t-title">Your account</h1>
          <p className="mt-1 text-zinc-600">
            {account.name ?? account.email} · {account.email}
          </p>
        </div>
        <LogoutButton />
      </div>
      <h2 className="mb-4 text-xl font-semibold">Orders</h2>
      {account.orders.length === 0 ? (
        <p className="text-zinc-600">
          You haven’t placed any orders yet.{' '}
          <Link href="/collections/all" className="underline">
            Start shopping
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
          {account.orders.map((o) => (
            <li key={o.number}>
              <Link
                href={`/account/orders/${o.number}`}
                className="flex justify-between py-4 hover:bg-zinc-50"
              >
                <span>
                  <span className="font-medium">Order #{o.number}</span>
                  <span className="ml-3 text-sm text-zinc-500">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="text-sm">
                  {o.status === 'CANCELLED'
                    ? 'Cancelled'
                    : o.fulfillmentStatus === 'FULFILLED'
                      ? 'Shipped'
                      : 'Processing'}{' '}
                  · {formatMoney(o.total, o.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {shop?.apps.productReviews.enabled ? (
        <section className="mt-12" aria-labelledby="email-prefs">
          <h2 id="email-prefs" className="mb-3 text-xl font-semibold">
            Emails
          </h2>
          <form
            action={setReviewEmailsAction.bind(null, !account.reviewEmails)}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 p-5"
          >
            <div className="text-sm">
              <p className="font-medium text-zinc-900">Review requests</p>
              <p className="mt-1 text-zinc-600">
                {account.reviewEmails
                  ? 'After an order arrives we send one email asking how you liked it.'
                  : 'Turned off: we will not ask you to review your purchases.'}
              </p>
            </div>
            <button type="submit" className="btn btn-outline min-h-11 px-5 text-sm">
              {account.reviewEmails ? 'Turn off' : 'Turn back on'}
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}

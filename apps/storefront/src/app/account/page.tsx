import { type CustomerAccount, formatMoney } from '@repo/contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sf, StorefrontApiError } from '@/lib/api';
import { getCustomerToken } from '@/lib/shop';
import { LogoutButton } from './forms';

export const metadata = { title: 'Your account' };

export default async function AccountPage() {
  const customerToken = await getCustomerToken();
  if (!customerToken) redirect('/account/login');
  let account: CustomerAccount;
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
          <h1 className="text-3xl font-bold tracking-tight">Your account</h1>
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
    </>
  );
}

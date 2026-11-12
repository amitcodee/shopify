import Link from 'next/link';
import { confirmOrderAction } from './actions';

export const metadata = { title: 'Confirm your order', robots: { index: false } };

export default async function ConfirmCashOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ expired?: string }>;
}) {
  const { token } = await params;
  const { expired } = await searchParams;

  if (expired) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="page-title t-title">This link has expired</h1>
        <p className="mt-4 text-zinc-600">
          The order was not confirmed in time and has been cancelled, or the link is not valid. You
          can place the order again from the store.
        </p>
        <Link href="/" className="btn btn-strong mt-8 inline-flex min-h-12 px-6 py-3 text-sm">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <p className="eyebrow text-zinc-500">Cash on delivery</p>
      <h1 className="page-title t-title mt-2">Confirm your order</h1>
      <p className="mt-4 text-zinc-600">
        Confirm that you placed this order and will pay in cash when it is delivered. We will
        prepare it as soon as you confirm.
      </p>
      <form action={confirmOrderAction.bind(null, token.slice(0, 200))} className="mt-8">
        <button type="submit" className="btn btn-strong min-h-12 px-6 py-3 text-sm">
          Yes, confirm my order
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-500">
        Didn&rsquo;t place this order? You can ignore this page; it will be cancelled automatically.
      </p>
    </div>
  );
}

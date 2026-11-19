import Link from 'next/link';
import { reviewEmailsOffAction } from './actions';

export const metadata = { title: 'Review emails', robots: { index: false } };

export default async function ReviewEmailsOffPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; invalid?: string }>;
}) {
  const { token } = await params;
  const { done, invalid } = await searchParams;

  const message = invalid
    ? {
        title: 'This link is not valid',
        body: 'It may have been copied incompletely. Use the link from the email again.',
      }
    : done
      ? {
          title: 'Review emails are off',
          body: 'We will not email you to ask for reviews again. Order and shipping emails still arrive as usual.',
        }
      : null;

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <p className="eyebrow text-zinc-500">Email preferences</p>
      {message ? (
        <>
          <h1 className="page-title t-title mt-2">{message.title}</h1>
          <p className="mt-4 text-zinc-600">{message.body}</p>
          <Link href="/" className="btn btn-strong mt-8 inline-flex min-h-12 px-6 py-3 text-sm">
            Continue shopping
          </Link>
        </>
      ) : (
        <>
          <h1 className="page-title t-title mt-2">Stop review request emails?</h1>
          <p className="mt-4 text-zinc-600">
            After an order ships, we email once to ask what you thought of it. Turn these emails off
            for this store. Order and shipping emails are not affected.
          </p>
          <form action={reviewEmailsOffAction.bind(null, token.slice(0, 200))} className="mt-8">
            <button type="submit" className="btn btn-strong min-h-12 px-6 py-3 text-sm">
              Turn off review emails
            </button>
          </form>
        </>
      )}
    </div>
  );
}

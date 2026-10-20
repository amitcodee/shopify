'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { FollowRedirect } from '@/components/follow-redirect';
import { completeMockPaymentAction } from '../../actions';

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        name="outcome"
        value="succeed"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        Pay now (test card succeeds)
      </button>
      <button
        type="submit"
        name="outcome"
        value="fail"
        disabled={pending}
        className="w-full rounded-md border border-zinc-900 px-4 py-3 text-sm font-semibold hover:bg-white disabled:opacity-50"
      >
        Decline (test card fails)
      </button>
    </>
  );
}

export function PayButtons({ reference }: { reference: string }) {
  const [state, action] = useActionState(
    completeMockPaymentAction.bind(null, reference),
    undefined,
  );
  return (
    <form action={action} className="mt-8 space-y-3">
      <FollowRedirect to={state?.redirectTo} />
      <Buttons />
      {state?.redirectTo ? (
        <p role="status" className="text-center text-sm text-zinc-600">
          Redirecting…
        </p>
      ) : null}
    </form>
  );
}

'use client';

import type { RazorpayCheckout } from '@repo/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { buttonClass } from '@/components/ui';
import { confirmRazorpayAction, subscribeAction, syncBillingAction } from './actions';

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(
    event: 'payment.failed',
    handler: (response: { error?: { description?: string } }) => void,
  ): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Loads Razorpay Checkout once (inserted by our nonced bundle, allowed by 'strict-dynamic'). */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Checkout failed to load')));
    if (!existing) {
      script.src = CHECKOUT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

export function SubscribeButton({
  storeId,
  planId,
  label,
  variant = 'primary',
}: {
  storeId: string;
  planId: string;
  label: string;
  variant?: 'primary' | 'secondary';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function openCheckout(checkout: RazorpayCheckout) {
    const Razorpay = window.Razorpay;
    if (!Razorpay) throw new Error('Checkout unavailable');
    const instance = new Razorpay({
      key: checkout.keyId,
      subscription_id: checkout.subscriptionId,
      name: checkout.name,
      description: checkout.description,
      prefill: { email: checkout.email },
      theme: { color: '#111111' },
      // The launch offer only applies to UPI mandates (Razorpay refuses other methods with it).
      ...(checkout.upiOnly
        ? {
            config: {
              display: {
                blocks: {
                  upi: { name: 'Pay with UPI (launch offer)', instruments: [{ method: 'upi' }] },
                },
                sequence: ['block.upi'],
                preferences: { show_default_blocks: false },
              },
            },
          }
        : {}),
      handler: (response: RazorpaySuccess) => {
        setMessage('Confirming your subscription…');
        startTransition(async () => {
          const result = await confirmRazorpayAction(storeId, {
            paymentId: response.razorpay_payment_id,
            subscriptionId: response.razorpay_subscription_id,
            signature: response.razorpay_signature,
          });
          if (result.error) {
            setMessage(null);
            setError(result.error);
          } else {
            setMessage('You are subscribed. Thank you!');
          }
          router.refresh();
        });
      },
      modal: {
        ondismiss: () => {
          // The merchant may have paid in another tab or app (UPI): check with the provider.
          startTransition(async () => {
            await syncBillingAction(storeId);
            router.refresh();
          });
        },
      },
    });
    instance.on('payment.failed', (response) => {
      setError(response.error?.description ?? 'The payment did not go through. Please try again.');
    });
    instance.open();
  }

  function subscribe() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await subscribeAction(storeId, planId);
      if ('error' in result) {
        setError(result.error);
      } else if ('redirectUrl' in result) {
        window.location.assign(result.redirectUrl);
      } else if ('checkout' in result) {
        setFallbackUrl(result.checkout.shortUrl);
        try {
          await loadCheckout();
          openCheckout(result.checkout);
        } catch {
          if (result.checkout.shortUrl) window.location.assign(result.checkout.shortUrl);
          else setError('Could not open the payment window. Please try again.');
        }
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={subscribe}
        disabled={pending}
        className={`${buttonClass(variant)} w-full sm:w-auto`}
      >
        {pending ? 'Please wait…' : label}
      </button>
      {message ? (
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
          {fallbackUrl ? (
            <>
              {' '}
              <a href={fallbackUrl} className="underline">
                Pay on Razorpay&rsquo;s page instead
              </a>
              .
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

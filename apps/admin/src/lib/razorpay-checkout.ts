/** Razorpay Checkout loader shared by plan subscriptions and premium template purchases. */

export interface RazorpayInstance {
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

export const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Loads Razorpay Checkout once (inserted by our nonced bundle, allowed by 'strict-dynamic'). */
export function loadCheckout(): Promise<void> {
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

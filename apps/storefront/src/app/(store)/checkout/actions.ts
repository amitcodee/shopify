'use server';

import type { CheckoutPreview, CheckoutResult, MockPayment } from '@repo/contracts';
import type { FormResult } from '@/components/form';
import { sameHostPath, sf, StorefrontApiError } from '@/lib/api';
import { getCartToken, getCustomerToken } from '@/lib/shop';

export async function previewAction(input: {
  country?: string;
  region?: string;
  shippingRateId?: string;
  discountCode?: string;
  giftCardCode?: string;
}): Promise<{ preview?: CheckoutPreview; error?: string }> {
  try {
    const preview = await sf<CheckoutPreview>('/checkout/preview', {
      method: 'POST',
      cartToken: await getCartToken(),
      body: {
        country: input.country || undefined,
        region: input.region || undefined,
        shippingRateId: input.shippingRateId || undefined,
        discountCode: input.discountCode || undefined,
        giftCardCode: input.giftCardCode || undefined,
      },
    });
    return { preview };
  } catch (error) {
    if (error instanceof StorefrontApiError) return { error: error.message };
    throw error;
  }
}

function field(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export async function placeOrderAction(_: FormResult, formData: FormData): Promise<FormResult> {
  let result: CheckoutResult;
  try {
    result = await sf<CheckoutResult>('/checkout', {
      method: 'POST',
      cartToken: await getCartToken(),
      customerToken: await getCustomerToken(),
      body: {
        email: field(formData, 'email') ?? '',
        idempotencyKey: field(formData, 'idempotencyKey') ?? '',
        shippingRateId: field(formData, 'shippingRateId'),
        discountCode: field(formData, 'discountCode'),
        giftCardCode: field(formData, 'giftCardCode'),
        note: field(formData, 'note'),
        shippingAddress: {
          name: field(formData, 'name') ?? '',
          line1: field(formData, 'line1') ?? '',
          line2: field(formData, 'line2'),
          city: field(formData, 'city') ?? '',
          region: field(formData, 'region'),
          postalCode: field(formData, 'postalCode') ?? '',
          country: field(formData, 'country') ?? '',
          phone: field(formData, 'phone'),
        },
      },
    });
  } catch (error) {
    if (!(error instanceof StorefrontApiError)) throw error;
    const fieldErrors: Record<string, string> = {};
    for (const e of error.problem.errors ?? []) {
      fieldErrors[e.path.replace(/^shippingAddress\./, '')] ??= e.message;
    }
    return {
      error: error.problem.errors?.length ? 'Please check the highlighted fields.' : error.message,
      fieldErrors,
    };
  }
  // Navigate in the browser (fresh request with the shopper's Host); see sameHostPath.
  return { redirectTo: await sameHostPath(result.paymentUrl) };
}

export async function completeMockPaymentAction(
  reference: string,
  _: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const outcome = formData.get('outcome') === 'fail' ? 'fail' : 'succeed';
  const payment = await sf<MockPayment>(
    `/checkout/mock-payments/${encodeURIComponent(reference)}`,
    { method: 'POST', body: { outcome } },
  );
  if (payment.status === 'SUCCEEDED' && payment.returnUrl) {
    return { redirectTo: await sameHostPath(payment.returnUrl) };
  }
  return { redirectTo: '/checkout?declined=1' };
}

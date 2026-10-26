'use server';

import type { Cart, CreatedCart } from '@repo/contracts';
import { revalidatePath } from 'next/cache';
import { isNotFound, sf, StorefrontApiError } from '@/lib/api';
import { getCartToken, setCartToken } from '@/lib/shop';

export type CartActionState = { error?: string; success?: string } | undefined;

async function ensureCartToken(): Promise<string> {
  const existing = await getCartToken();
  if (existing) {
    try {
      await sf<Cart>('/cart', { cartToken: existing });
      return existing;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }
  const created = await sf<CreatedCart>('/cart', { method: 'POST' });
  await setCartToken(created.token);
  return created.token;
}

export async function addToCartAction(
  _: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const variantId = String(formData.get('variantId') ?? '');
  const quantity = Math.max(1, Math.min(99, Number(formData.get('quantity') ?? 1) || 1));
  try {
    const token = await ensureCartToken();
    await sf<Cart>('/cart/lines', {
      method: 'POST',
      cartToken: token,
      body: { variantId, quantity },
    });
  } catch (error) {
    if (error instanceof StorefrontApiError) return { error: error.message };
    throw error;
  }
  revalidatePath('/', 'layout');
  return { success: 'Added to cart.' };
}

export async function updateLineAction(lineId: string, formData: FormData): Promise<void> {
  const token = await getCartToken();
  const quantity = Math.max(0, Math.min(99, Number(formData.get('quantity') ?? 0) || 0));
  try {
    await sf<Cart>(`/cart/lines/${lineId}`, {
      method: 'PATCH',
      cartToken: token,
      body: { quantity },
    });
  } catch (error) {
    if (!(error instanceof StorefrontApiError)) throw error;
  }
  revalidatePath('/', 'layout');
}

export async function removeLineAction(lineId: string): Promise<void> {
  const token = await getCartToken();
  try {
    await sf<Cart>(`/cart/lines/${lineId}`, { method: 'DELETE', cartToken: token });
  } catch (error) {
    if (!(error instanceof StorefrontApiError)) throw error;
  }
  revalidatePath('/', 'layout');
}

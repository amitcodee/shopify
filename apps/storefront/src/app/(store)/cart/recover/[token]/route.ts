import type { CreatedCart } from '@repo/contracts';
import { redirect } from 'next/navigation';
import { isNotFound, sf } from '@/lib/api';
import { setCartToken } from '@/lib/shop';

/** Link from an abandoned-checkout email: restores the items into a fresh cart on this device. */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const created = await sf<CreatedCart>('/cart/recover', {
      method: 'POST',
      body: { token: token.slice(0, 200) },
    });
    await setCartToken(created.token);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    redirect('/cart?recovery=expired');
  }
  redirect('/cart');
}

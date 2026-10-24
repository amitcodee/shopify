import type { CartLine } from '@repo/contracts';

/**
 * Why a cart line cannot be ordered right now, or null when it can. Lines that are not
 * available are left out of the subtotal and checkout; a product that is no longer for sale
 * (unpublished, archived, or scheduled for later) has no product page to link to.
 */
export function lineProblem(line: CartLine): { label: string; linkable: boolean } | null {
  if (line.available) return null;
  if (line.maxQuantity === 0) return { label: 'Sold out', linkable: true };
  if (line.maxQuantity !== null && line.quantity > line.maxQuantity) {
    return { label: `Only ${line.maxQuantity} available`, linkable: true };
  }
  return { label: 'No longer available', linkable: false };
}

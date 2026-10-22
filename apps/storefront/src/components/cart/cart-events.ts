/** Fired by the product form after a successful add to cart (the drawer refreshes and opens). */
export const CART_ADDED_EVENT = 'cart:added';
/** Fired by the header cart link to open the drawer instead of navigating to /cart. */
export const CART_OPEN_EVENT = 'cart:open';

export function openCartDrawer(): void {
  window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT));
}

/**
 * A tiny client-side toast store. `toast()` can be called from any client component; the
 * <Toaster> in the root layout renders whatever is queued.
 */

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
  /** Bumped when an identical toast is shown again, to restart its timer. */
  version: number;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const MAX_VISIBLE = 4;

function emit() {
  for (const listener of listeners) listener(toasts);
}

/**
 * Show a toast. Showing the same message again while it is still visible refreshes that toast
 * instead of stacking a duplicate.
 */
export function toast(
  message: string,
  options: { tone?: ToastTone; action?: ToastAction } = {},
): number {
  const tone = options.tone ?? 'success';
  const existing = toasts.find((t) => t.message === message && t.tone === tone);
  if (existing) {
    toasts = toasts.map((t) =>
      t === existing ? { ...t, action: options.action, version: t.version + 1 } : t,
    );
    emit();
    return existing.id;
  }
  const id = nextId++;
  toasts = [...toasts, { id, message, tone, action: options.action, version: 0 }].slice(
    -MAX_VISIBLE,
  );
  emit();
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts(): Toast[] {
  return toasts;
}

const EMPTY: Toast[] = [];
export function getServerToasts(): Toast[] {
  return EMPTY;
}

'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  dismissToast,
  getServerToasts,
  getToasts,
  subscribeToasts,
  type Toast,
  type ToastTone,
} from '@/lib/toast';
import { Icon, type IconName } from './icons';

const DURATION = 5000;

const TONES: Record<ToastTone, { icon: IconName; color: string }> = {
  success: { icon: 'checkCircle', color: 'text-emerald-400' },
  error: { icon: 'alert', color: 'text-red-400' },
  info: { icon: 'info', color: 'text-sky-400' },
};

/**
 * Renders queued toasts in a polite live region at the bottom of the screen. Each toast closes
 * itself after a few seconds (paused while hovered or focused) and slides out.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </section>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = () => {
    setLeaving(true);
    setTimeout(() => dismissToast(toast.id), 180);
  };

  useEffect(() => {
    if (paused) return;
    timer.current = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => dismissToast(toast.id), 180);
    }, DURATION);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Restart when the same toast is shown again (version bump).
  }, [paused, toast.id, toast.version]);

  const tone = TONES[toast.tone];
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      data-leaving={leaving ? '' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-slate-900 py-3 pr-2 pl-4 text-sm text-white shadow-[0_16px_40px_-12px_rgb(15_23_42/0.5)] ring-1 ring-white/10"
    >
      <Icon name={tone.icon} className={`mt-0.5 size-[18px] shrink-0 ${tone.color}`} />
      <p className="min-w-0 flex-1 py-px leading-5">{toast.message}</p>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            close();
          }}
          className="shrink-0 rounded-md px-2 py-0.5 font-semibold text-indigo-300 hover:bg-white/10 hover:text-indigo-200"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
      >
        <Icon name="close" className="size-4" />
      </button>
    </div>
  );
}

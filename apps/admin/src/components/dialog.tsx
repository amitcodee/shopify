'use client';

import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Icon } from './icons';

/**
 * Modal dialog on the native <dialog> element (focus trap, Escape and the top layer for free).
 * Render it only while open: it opens itself on mount and calls `onClose` when dismissed.
 */
export function Dialog({
  title,
  description,
  children,
  footer,
  onClose,
  size = 'md',
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener('close', handleClose);
    // No close() here: it would queue a `close` event that a re-run of this effect (Strict
    // Mode) would receive. Unmounting removes the element from the top layer anyway.
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  const width = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Clicking the backdrop (the dialog element itself, outside the panel) dismisses.
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${width} rounded-xl bg-white p-0 text-slate-900 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]`}
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[15px] leading-6 font-semibold text-slate-900">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => ref.current?.close()}
          className="-mr-1.5 rounded-md p-1 text-slate-400 hover:bg-slate-900/5 hover:text-slate-700"
        >
          <Icon name="close" className="h-4.5 w-4.5" strokeWidth={2} />
        </button>
      </div>
      {children ? <div className="px-5 pb-5">{children}</div> : null}
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}

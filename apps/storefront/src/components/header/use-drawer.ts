'use client';

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** How long the slide-out animation in globals.css (.drawer-*) runs before unmounting. */
const CLOSE_MS = 220;

export type DrawerState = 'open' | 'closing' | 'closed';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Open/close state for a modal side panel. While open: focus moves into the panel and stays
 * there (Tab wraps), Escape closes, the page behind does not scroll, and closing returns focus
 * to whatever opened it. The panel stays mounted only while open or animating out, so a closed
 * drawer is not in the accessibility tree at all.
 */
export function useDrawer(panelRef: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<DrawerState>('closed');
  const returnFocus = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A submit button that disables itself while busy (add to cart) drops focus to <body>; it is
  // still where focus should return, so remember the last focused element.
  const lastFocused = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    clearTimeout(timer.current);
    const active = document.activeElement;
    returnFocus.current =
      active instanceof HTMLElement && active !== document.body ? active : lastFocused.current;
    setState('open');
  }, []);

  const close = useCallback(() => {
    setState((current) => (current === 'open' ? 'closing' : current));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('closed'), CLOSE_MS);
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function onFocus(event: FocusEvent) {
      if (event.target instanceof HTMLElement) lastFocused.current = event.target;
    }
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('focusin', onFocus);
      clearTimeout(timer.current);
    };
  }, []);

  const isOpen = state === 'open';
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    // Focus the control marked data-autofocus (the close button), or the panel itself.
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel;
    first?.focus({ preventScroll: true });

    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (
        event.shiftKey &&
        (document.activeElement === firstItem || document.activeElement === panel)
      ) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [isOpen, close, panelRef]);

  return { state, isOpen, open, close };
}

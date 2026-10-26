'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRightIcon, ChevronDownIcon } from './icons';

type Collection = { title: string; handle: string };

/**
 * "Shop" dropdown listing the store's collections (desktop header). Opens on click, or on hover
 * with a mouse; Escape and clicks outside close it. Closed, the panel is not rendered.
 */
export function ShopMenu({
  collections,
  linkClassName,
}: {
  collections: Collection[];
  linkClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    }
    function onFocus(event: FocusEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
    };
  }, [open]);

  function hover(next: boolean) {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(next), next ? 80 : 180);
  }

  const twoColumns = collections.length > 6;
  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={(e) => e.pointerType === 'mouse' && hover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hover(false)}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          clearTimeout(hoverTimer.current);
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center gap-1 [text-transform:inherit] ${linkClassName}`}
      >
        Shop
        <ChevronDownIcon className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          id={panelId}
          className="dropdown-panel absolute top-full left-1/2 z-50 -translate-x-1/2 pt-3 text-left normal-case tracking-normal"
        >
          <div
            className={`rounded-lg border border-zinc-200 bg-page p-5 shadow-xl ${twoColumns ? 'w-[30rem]' : 'w-64'}`}
          >
            <p className="eyebrow text-zinc-500">Collections</p>
            <ul className={`mt-3 grid gap-x-6 gap-y-1 ${twoColumns ? 'grid-cols-2' : ''}`}>
              {collections.map((c) => (
                <li key={c.handle}>
                  <Link
                    href={`/collections/${c.handle}`}
                    onClick={() => setOpen(false)}
                    className="-mx-2 block rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/collections/all"
              onClick={() => setOpen(false)}
              className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 text-sm font-semibold text-zinc-900 hover:underline"
            >
              Shop all products
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

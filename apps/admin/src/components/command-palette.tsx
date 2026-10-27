'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';

export interface Command {
  label: string;
  href: string;
  group: string;
  icon?: IconName | undefined;
  /** Extra words that should match, e.g. "new create" for "Add product". */
  keywords?: string | undefined;
  /** Two-key "g then x" shortcut shown next to the command. */
  shortcut?: string | undefined;
  external?: boolean | undefined;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest('input, textarea, select, [contenteditable="true"]'));
}

function matches(command: Command, query: string): boolean {
  const haystack = `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * Jump to any page or action from the keyboard. Ctrl/⌘+K (or the top-bar button) opens it;
 * arrows move, Enter goes, Escape closes. "g" followed by a letter jumps straight to a section
 * (g o → Orders, g p → Products, …) when you are not typing in a field.
 */
export function CommandPalette({ commands }: { commands: Command[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let pendingG = 0;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('dialog[open]')) return;
      const key = event.key.toLowerCase();
      if (key === 'g') {
        pendingG = event.timeStamp;
        return;
      }
      if (pendingG && event.timeStamp - pendingG < 1200) {
        pendingG = 0;
        const target = commands.find((c) => c.shortcut === `g ${key}`);
        if (target) {
          event.preventDefault();
          router.push(target.href);
        }
      }
    };
    const onOpenRequest = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onOpenRequest);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', onOpenRequest);
    };
  }, [commands, router]);

  // Close when navigation happens by any means.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return open ? <PaletteDialog commands={commands} onClose={() => setOpen(false)} /> : null;
}

function PaletteDialog({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
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
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  const results = useMemo(
    () => (query.trim() ? commands.filter((c) => matches(c, query)) : commands),
    [commands, query],
  );
  const current = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: 'nearest' });
  }, [current, listId]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    if (command.external) window.open(command.href, '_blank', 'noopener,noreferrer');
    else router.push(command.href);
    onClose();
  };

  const groups: { name: string; items: { command: Command; index: number }[] }[] = [];
  results.forEach((command, index) => {
    const group = groups.find((g) => g.name === command.group);
    if (group) group.items.push({ command, index });
    else groups.push({ name: command.group, items: [{ command, index }] });
  });

  return (
    <dialog
      ref={ref}
      aria-label="Command palette"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="palette mt-[12vh] mb-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl bg-white p-0 text-slate-900 shadow-2xl ring-1 ring-slate-900/10 backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px] sm:mx-auto"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-4">
        <Icon name="search" className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={2} />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-${current}` : undefined}
          aria-label="Search pages and actions"
          placeholder="Search pages and actions…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((current + 1) % Math.max(1, results.length));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((current - 1 + results.length) % Math.max(1, results.length));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(results[current]);
            }
          }}
          className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400"
        />
        <kbd className="hidden rounded border border-slate-200 px-1.5 font-sans text-[11px] leading-5 text-slate-400 sm:block">
          Esc
        </kbd>
      </div>
      <div id={listId} role="listbox" className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
        {results.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-slate-500">
            Nothing matches “{query}”.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.name} role="group" aria-label={group.name} className="mb-1 last:mb-0">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                {group.name}
              </p>
              {group.items.map(({ command, index }) => (
                <div
                  key={command.href + command.label}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === current}
                  onMouseMove={() => setActive(index)}
                  onClick={() => run(command)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    index === current ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700'
                  }`}
                >
                  <Icon
                    name={command.icon ?? 'arrowRight'}
                    className={`h-4 w-4 shrink-0 ${index === current ? 'text-indigo-600' : 'text-slate-400'}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.external ? (
                    <Icon name="external" className="h-3.5 w-3.5 text-slate-400" />
                  ) : null}
                  {command.shortcut ? (
                    <span className="flex gap-1">
                      {command.shortcut.split(' ').map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-slate-200 bg-white px-1.5 font-sans text-[11px] leading-5 text-slate-500 uppercase"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <div className="hidden items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-500 sm:flex">
        <span>↑↓ to move</span>
        <span>↵ to open</span>
        <span>
          <kbd className="font-sans">g</kbd> then a letter to jump
        </span>
      </div>
    </dialog>
  );
}

/** Top-bar button that opens the palette (for mouse and touch users). */
export function CommandPaletteButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
      className="flex h-8 shrink-0 items-center gap-2 rounded-lg px-2 text-sm text-slate-500 ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-800 hover:ring-slate-300"
    >
      <Icon name="search" className="h-4 w-4" strokeWidth={2} />
      <span className="hidden lg:inline">Jump to</span>
      <kbd className="hidden rounded border border-slate-300 bg-white px-1 font-sans text-[11px] leading-4 text-slate-500 sm:block">
        Ctrl K
      </kbd>
      <span className="sr-only">Open command palette</span>
    </button>
  );
}

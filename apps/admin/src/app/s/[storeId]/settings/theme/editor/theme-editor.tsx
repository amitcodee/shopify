'use client';

import {
  findThemeTemplate,
  type HomeSection,
  type PreviewMessage,
  STORE_APP_CATALOG,
  type StoreAppId,
  type StoreApps,
  type Theme,
  THEME_DRAFT_PARAM,
} from '@repo/contracts';
import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/icons';
import {
  askAiAction,
  discardDraftAction,
  previewTokenAction,
  publishDraftAction,
  saveAppsAction,
  saveDraftAction,
} from './actions';
import { FieldControl } from './editor-fields';
import {
  AI_IDEAS,
  PREVIEW_PAGES,
  SECTION_NOTES,
  SECTIONS,
  type SectionId,
  THEME_GROUPS,
} from './editor-schema';

type Panel = 'sections' | 'theme' | 'apps';
type Device = 'desktop' | 'mobile';
type Status =
  { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

const same = (a: Theme, b: Theme) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The theme editor: a live preview of the storefront with the store's unpublished draft,
 * section and theme settings, apps, and an AI assistant. Every change is saved to the draft
 * (never to the live store) until the merchant publishes.
 */
export function ThemeEditor({
  storeId,
  storeName,
  storefrontUrl,
  live,
  draft,
  previewToken,
  apps: initialApps,
  aiEnabled,
  canEdit,
  exitHref,
}: {
  storeId: string;
  storeName: string;
  storefrontUrl: string;
  live: Theme;
  draft: Theme | null;
  previewToken: string;
  apps: StoreApps;
  aiEnabled: boolean;
  canEdit: boolean;
  exitHref: string;
}) {
  const [theme, setTheme] = useState<Theme>(draft ?? live);
  const [published, setPublished] = useState<Theme>(live);
  const [hasDraft, setHasDraft] = useState(draft !== null);
  const [past, setPast] = useState<Theme[]>([]);
  const [future, setFuture] = useState<Theme[]>([]);
  const [panel, setPanel] = useState<Panel>('sections');
  const [selected, setSelected] = useState<SectionId | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [page, setPage] = useState<string>('/');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [token, setToken] = useState(previewToken);
  const [apps, setApps] = useState(initialApps);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<{ text: string; undo?: Theme } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const saved = useRef<Theme>(draft ?? live);

  const storefrontOrigin = useMemo(() => new URL(storefrontUrl).origin, [storefrontUrl]);
  const src = useMemo(() => {
    const url = new URL(page, storefrontUrl);
    url.searchParams.set(THEME_DRAFT_PARAM, token);
    return url.toString();
  }, [page, storefrontUrl, token]);

  const post = useCallback(
    (message: PreviewMessage) =>
      frame.current?.contentWindow?.postMessage(message, storefrontOrigin),
    [storefrontOrigin],
  );

  /** Records an edit (undoable). */
  const change = useCallback(
    (next: Theme) => {
      setTheme((current) => {
        if (same(current, next)) return current;
        setPast((p) => [...p.slice(-49), current]);
        setFuture([]);
        return next;
      });
    },
    [setTheme],
  );

  const undo = useCallback(() => {
    setPast((p) => {
      const previous = p.at(-1);
      if (!previous) return p;
      setTheme((current) => {
        setFuture((f) => [current, ...f]);
        return previous;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      const next = f[0];
      if (!next) return f;
      setTheme((current) => {
        setPast((p) => [...p, current]);
        return next;
      });
      return f.slice(1);
    });
  }, []);

  // Autosave the draft shortly after each change, then refresh the preview.
  useEffect(() => {
    if (!canEdit || same(theme, saved.current)) return;
    const timer = setTimeout(async () => {
      setStatus({ kind: 'saving' });
      const result = await saveDraftAction(storeId, theme);
      if (!result.ok) {
        setStatus({ kind: 'error', message: result.error });
        return;
      }
      saved.current = theme;
      setHasDraft(true);
      setStatus({ kind: 'saved' });
      post({ source: 'cp-editor', type: 'refresh' });
    }, 500);
    return () => clearTimeout(timer);
  }, [theme, canEdit, storeId, post]);

  // Preview tokens last two hours; renew well before that during a long session.
  useEffect(() => {
    const timer = setInterval(
      async () => {
        const result = await previewTokenAction(storeId);
        if (result.ok) setToken(result.data.token);
      },
      90 * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, [storeId]);

  // Messages from the preview frame: clicking a section selects it here.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== storefrontOrigin) return;
      const data = event.data as PreviewMessage | null;
      if (!data || data.source !== 'cp-preview') return;
      if (data.type === 'section' && data.section in SECTIONS) {
        setSelected(data.section as SectionId);
        setPanel('sections');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [storefrontOrigin]);

  useEffect(() => {
    if (selected) post({ source: 'cp-editor', type: 'select', section: selected });
  }, [selected, post]);

  // Keyboard: undo / redo.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const publish = async () => {
    setPublishing(true);
    const result = await publishDraftAction(storeId, theme);
    setPublishing(false);
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error });
      return;
    }
    saved.current = result.data;
    setPublished(result.data);
    setHasDraft(false);
    setStatus({ kind: 'idle' });
    setNotice({ text: 'Published. Your storefront updates within 30 seconds.' });
  };

  const discard = async () => {
    setConfirmDiscard(false);
    const result = await discardDraftAction(storeId);
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.error });
      return;
    }
    saved.current = result.data;
    setTheme(result.data);
    setPublished(result.data);
    setPast([]);
    setFuture([]);
    setHasDraft(false);
    setStatus({ kind: 'idle' });
    post({ source: 'cp-editor', type: 'refresh' });
  };

  const toggleApp = async (id: StoreAppId) => {
    const next = { ...apps, [id]: { ...apps[id], enabled: !apps[id].enabled } } as StoreApps;
    setApps(next);
    const result = await saveAppsAction(storeId, next);
    if (!result.ok) {
      setApps(apps);
      setStatus({ kind: 'error', message: result.error });
      return;
    }
    // Apps apply to the live store at once; the preview picks them up after the shop cache.
    setNotice({
      text: `${STORE_APP_CATALOG.find((a) => a.id === id)?.name} ${next[id].enabled ? 'turned on' : 'turned off'}.`,
    });
    setTimeout(() => post({ source: 'cp-editor', type: 'refresh' }), 300);
  };

  const template = findThemeTemplate(theme.settings.template);
  const dirty = hasDraft && !same(theme, published);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-100 text-slate-900">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:gap-3 sm:px-3">
        <Link
          href={exitHref}
          className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Exit the theme editor"
        >
          <Icon name="chevronLeft" className="h-5 w-5" />
        </Link>
        <span className="h-6 w-px bg-slate-200" aria-hidden />
        <nav aria-label="Editor panels" className="flex items-center gap-1">
          {(
            [
              ['sections', 'layers', 'Sections'],
              ['theme', 'palette', 'Theme settings'],
              ['apps', 'apps', 'Apps'],
            ] as [Panel, IconName, string][]
          ).map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={panel === id}
              title={label}
              onClick={() => setPanel(id)}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition ${
                panel === id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon name={icon} className="h-[18px] w-[18px]" />
              <span className="hidden xl:inline">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mx-auto flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden truncate font-semibold md:inline">
            {template ? template.name : 'Custom theme'}
          </span>
          {dirty ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Unpublished changes
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              Live
            </span>
          )}
          <label className="sr-only" htmlFor="preview-page">
            Preview page
          </label>
          <select
            id="preview-page"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white py-1.5 pr-8 pl-2.5 text-sm"
          >
            {PREVIEW_PAGES.map((p) => (
              <option key={p.path} value={p.path}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <SaveStatus status={status} />
          <div
            className="hidden items-center rounded-lg bg-slate-100 p-0.5 md:flex"
            role="group"
            aria-label="Preview size"
          >
            {(
              [
                ['desktop', 'desktop', 'Desktop'],
                ['mobile', 'mobile', 'Mobile'],
              ] as [Device, IconName, string][]
            ).map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={device === id}
                title={label}
                onClick={() => setDevice(id)}
                className={`flex size-8 items-center justify-center rounded-md ${
                  device === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Icon name={icon} />
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
          <IconButton label="Undo" icon="undo" disabled={past.length === 0} onClick={undo} />
          <IconButton label="Redo" icon="redo" disabled={future.length === 0} onClick={redo} />
          {canEdit && hasDraft ? (
            confirmDiscard ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={discard}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                >
                  Discard changes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 lg:block"
              >
                Discard
              </button>
            )
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={publish}
              disabled={!hasDraft || publishing || status.kind === 'saving'}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left panel */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
          {panel === 'sections' ? (
            <SectionsPanel
              theme={theme}
              selected={selected}
              onSelect={setSelected}
              onChange={change}
              canEdit={canEdit}
            />
          ) : null}
          {panel === 'theme' ? (
            <div className="p-4">
              <h2 className="text-sm font-semibold">Theme settings</h2>
              <div className="mt-3 divide-y divide-slate-100">
                {THEME_GROUPS.map((group, i) => (
                  <details key={group.title} open={i === 0} className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
                      {group.title}
                      <Icon
                        name="chevronDown"
                        className="h-4 w-4 text-slate-400 transition group-open:rotate-180"
                      />
                    </summary>
                    <div className="mt-3 space-y-3">
                      {group.fields.map((field, j) => (
                        <FieldControl
                          key={`${group.title}-${j}`}
                          field={field}
                          theme={theme}
                          onChange={change}
                          disabled={!canEdit}
                        />
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              <Link
                href={`${exitHref}?tab=templates`}
                className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Start from another template
                <Icon name="arrowRight" />
              </Link>
            </div>
          ) : null}
          {panel === 'apps' ? (
            <div className="p-4">
              <h2 className="text-sm font-semibold">Apps</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Turning an app on or off applies to your live store right away.
              </p>
              <ul className="mt-4 space-y-2">
                {STORE_APP_CATALOG.map((app) => (
                  <li key={app.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{app.name}</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">{app.tagline}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={apps[app.id].enabled}
                        aria-label={`${app.name}: ${apps[app.id].enabled ? 'on' : 'off'}`}
                        disabled={!canEdit}
                        onClick={() => toggleApp(app.id)}
                        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                          apps[app.id].enabled ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            apps[app.id].enabled ? 'translate-x-4' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <Link
                href={`/s/${storeId}/apps`}
                className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Configure apps
                <Icon name="arrowRight" />
              </Link>
            </div>
          ) : null}
        </aside>

        {/* Preview */}
        <main className="relative flex min-w-0 flex-1 flex-col items-center overflow-hidden p-3">
          <div
            className={`relative h-full overflow-hidden rounded-xl bg-white shadow-[0_10px_40px_-15px_rgb(15_23_42/0.35)] ring-1 ring-slate-900/10 transition-[width] duration-300 ${
              device === 'mobile' ? 'w-[390px]' : 'w-full'
            }`}
          >
            <iframe
              ref={frame}
              key={token}
              src={src}
              title={`Preview of ${storeName}`}
              className="h-full w-full"
              onLoad={() => {
                if (selected) post({ source: 'cp-editor', type: 'select', section: selected });
              }}
            />
          </div>
          {canEdit && aiEnabled ? (
            <AiBar
              onAsk={async (prompt) => {
                const result = await askAiAction(storeId, prompt, theme);
                if (!result.ok) return result.error;
                if (result.data.changed.length === 0) {
                  setNotice({ text: result.data.summary || 'Nothing needed changing.' });
                  return null;
                }
                const before = theme;
                change(result.data.theme);
                setNotice({ text: result.data.summary, undo: before });
                return null;
              }}
            />
          ) : null}
          {notice ? (
            <div
              role="status"
              className="absolute top-6 left-1/2 z-10 flex max-w-lg -translate-x-1/2 items-start gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"
            >
              <Icon name="sparkles" className="mt-0.5 h-4 w-4 text-indigo-300" />
              <p className="flex-1 leading-6">{notice.text}</p>
              {notice.undo ? (
                <button
                  type="button"
                  onClick={() => {
                    change(notice.undo as Theme);
                    setNotice(null);
                  }}
                  className="font-semibold text-indigo-300 hover:text-white"
                >
                  Undo
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss"
                className="text-slate-400 hover:text-white"
              >
                <Icon name="close" />
              </button>
            </div>
          ) : null}
        </main>

        {/* Section settings */}
        {selected ? (
          <aside
            aria-label={`${SECTIONS[selected].label} settings`}
            className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Icon name={SECTIONS[selected].icon} className="h-4 w-4 text-slate-500" />
              <h2 className="flex-1 text-sm font-semibold">{SECTIONS[selected].label}</h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close section settings"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              >
                <Icon name="close" />
              </button>
            </div>
            <SectionSettings
              id={selected}
              storeId={storeId}
              theme={theme}
              onChange={change}
              canEdit={canEdit}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function IconButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: IconName;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-35"
    >
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function SaveStatus({ status }: { status: Status }) {
  if (status.kind === 'idle') return null;
  if (status.kind === 'error') {
    return (
      <span
        role="alert"
        className="mr-1 hidden max-w-56 truncate text-xs text-red-600 lg:inline"
        title={status.message}
      >
        Not saved: {status.message}
      </span>
    );
  }
  return (
    <span className="mr-1 hidden text-xs text-slate-500 lg:inline" aria-live="polite">
      {status.kind === 'saving' ? 'Saving draft…' : 'Draft saved'}
    </span>
  );
}

function SectionRow({
  id,
  theme,
  selected,
  onSelect,
  onChange,
  canEdit,
  handle,
}: {
  id: SectionId;
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: Theme) => void;
  canEdit: boolean;
  handle?: ReactNode;
}) {
  const section = SECTIONS[id];
  const visible = section.visibility ? theme.settings[section.visibility] : true;
  return (
    <div
      className={`group flex items-center gap-1 rounded-lg pr-1 ${
        selected ? 'bg-indigo-50 text-indigo-800' : 'hover:bg-slate-50'
      }`}
    >
      {handle}
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={`flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm ${handle ? '' : 'pl-2'} ${
          visible ? '' : 'text-slate-400'
        }`}
      >
        <Icon name={section.icon} className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="truncate">{section.label}</span>
      </button>
      {section.visibility && canEdit ? (
        <button
          type="button"
          title={visible ? `Hide ${section.label}` : `Show ${section.label}`}
          aria-pressed={!visible}
          onClick={() =>
            onChange({
              ...theme,
              settings: { ...theme.settings, [section.visibility as string]: !visible },
            })
          }
          className={`rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700 ${
            visible ? 'opacity-0 group-hover:opacity-100 focus:opacity-100' : ''
          }`}
        >
          <Icon name={visible ? 'eye' : 'eyeOff'} />
          <span className="sr-only">
            {visible ? `Hide ${section.label}` : `Show ${section.label}`}
          </span>
        </button>
      ) : null}
    </div>
  );
}

function SectionsPanel({
  theme,
  selected,
  onSelect,
  onChange,
  canEdit,
}: {
  theme: Theme;
  selected: SectionId | null;
  onSelect: (id: SectionId) => void;
  onChange: (next: Theme) => void;
  canEdit: boolean;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const order = theme.settings.sectionOrder;
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1) as [HomeSection];
    next.splice(to, 0, item);
    onChange({ ...theme, settings: { ...theme.settings, sectionOrder: next } });
  };
  const row = (id: SectionId, handle?: ReactNode) => (
    <SectionRow
      key={id}
      id={id}
      theme={theme}
      selected={selected === id}
      onSelect={() => onSelect(id)}
      onChange={onChange}
      canEdit={canEdit}
      handle={handle}
    />
  );
  return (
    <div className="p-3">
      <h2 className="px-1 text-sm font-semibold">Home page</h2>
      <Group title="Header">
        {row('announcement')}
        {row('header')}
      </Group>
      <Group title="Template">
        {row('hero')}
        <ol aria-label="Homepage sections (drag to reorder)">
          {order.map((id, index) => (
            <li
              key={id}
              draggable={canEdit}
              onDragStart={() => setDragging(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragging !== null) move(dragging, index);
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
              className={dragging === index ? 'opacity-50' : ''}
            >
              {row(
                id,
                canEdit ? (
                  <span className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0}
                      className="rounded px-1 text-slate-300 hover:text-slate-700 disabled:invisible"
                      aria-label={`Move ${SECTIONS[id].label} up`}
                    >
                      <Icon name="arrowUp" className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, index + 1)}
                      disabled={index === order.length - 1}
                      className="rounded px-1 text-slate-300 hover:text-slate-700 disabled:invisible"
                      aria-label={`Move ${SECTIONS[id].label} down`}
                    >
                      <Icon name="arrowDown" className="h-3 w-3" />
                    </button>
                  </span>
                ) : undefined,
              )}
            </li>
          ))}
        </ol>
      </Group>
      <Group title="Footer">{row('footer')}</Group>
      <p className="mt-4 px-1 text-xs leading-5 text-slate-500">
        Tip: click any part of the preview to edit it, and drag sections to reorder them.
      </p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function SectionSettings({
  id,
  storeId,
  theme,
  onChange,
  canEdit,
}: {
  id: SectionId;
  storeId: string;
  theme: Theme;
  onChange: (next: Theme) => void;
  canEdit: boolean;
}) {
  const section = SECTIONS[id];
  const note = SECTION_NOTES[id];
  return (
    <div className="space-y-4 p-4">
      {section.visibility ? (
        <FieldControl
          field={{ type: 'toggle', key: section.visibility, label: 'Show this section' }}
          theme={theme}
          onChange={onChange}
          disabled={!canEdit}
        />
      ) : null}
      {section.fields.map((field, i) => (
        <FieldControl key={i} field={field} theme={theme} onChange={onChange} disabled={!canEdit} />
      ))}
      {note ? (
        <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          {note.text}{' '}
          <Link
            href={`/s/${storeId}/${note.href}`}
            className="font-medium text-indigo-700 hover:underline"
          >
            {note.link}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Ask AI": a prompt bar floating over the preview, like an assistant in the canvas. Only
 * rendered when the platform has the assistant configured, so it never covers the preview idly.
 */
function AiBar({ onAsk }: { onAsk: (prompt: string) => Promise<string | null> }) {
  const [prompt, setPrompt] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (text: string) => {
    const value = text.trim();
    if (value.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    const failure = await onAsk(value);
    setBusy(false);
    if (failure) setError(failure);
    else {
      setPrompt('');
      setOpen(false);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-6">
      <div className="pointer-events-auto w-full max-w-xl">
        {open ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {AI_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => submit(idea)}
                disabled={busy}
                className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-900/10 backdrop-blur hover:bg-white disabled:opacity-50"
              >
                {idea}
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(prompt);
          }}
          className="flex items-center gap-2 rounded-2xl bg-white/85 p-1.5 pl-3 shadow-[0_12px_40px_-12px_rgb(15_23_42/0.45)] ring-1 ring-slate-900/10 backdrop-blur-xl"
        >
          <Icon name="sparkles" className="h-5 w-5 text-indigo-600" />
          <label htmlFor="ai-prompt" className="sr-only">
            Ask AI to change your theme
          </label>
          <input
            id="ai-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setOpen(true)}
            maxLength={500}
            disabled={busy}
            placeholder="Ask AI to change your theme… e.g. “make it dark and elegant”"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={busy || prompt.trim().length < 3}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
          >
            {busy ? 'Designing…' : 'Ask AI'}
          </button>
        </form>
        {error ? (
          <p
            role="alert"
            className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

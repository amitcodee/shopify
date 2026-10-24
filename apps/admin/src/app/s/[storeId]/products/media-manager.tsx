'use client';

import type { ProductImage } from '@repo/contracts';
import {
  type DragEvent,
  type FormEvent,
  useId,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Dialog } from '@/components/dialog';
import { Icon } from '@/components/icons';
import { Alert, buttonClass, Card, inputClass } from '@/components/ui';
import type { ActionResult } from './actions';
import { imageSrc, imageSrcSet } from './images';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const ACCEPT_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_IMAGES = 50;
/** The API takes 10 files per request; server actions are capped at 25 MB per request. */
const BATCH_FILES = 10;
const BATCH_BYTES = 22 * 1024 * 1024;

interface Staged {
  id: string;
  file: File;
  preview: string;
}

type Op =
  | { type: 'order'; ids: string[] }
  | { type: 'alt'; id: string; alt: string }
  | { type: 'delete'; id: string };

type DialogState =
  | { kind: 'url' }
  | { kind: 'alt'; image: ProductImage; index: number }
  | { kind: 'delete'; image: ProductImage; index: number }
  | null;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function batches(files: File[]): File[][] {
  const out: File[][] = [];
  let current: File[] = [];
  let size = 0;
  for (const file of files) {
    if (current.length && (current.length >= BATCH_FILES || size + file.size > BATCH_BYTES)) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(file);
    size += file.size;
  }
  if (current.length) out.push(current);
  return out;
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function MediaManager({
  images,
  canWrite,
  upload,
  importFromUrl,
  reorder,
  updateAlt,
  remove,
}: {
  images: ProductImage[];
  canWrite: boolean;
  upload: (formData: FormData) => Promise<ActionResult>;
  importFromUrl: (url: string, alt: string) => Promise<ActionResult>;
  reorder: (imageIds: string[]) => Promise<ActionResult>;
  updateAlt: (imageId: string, alt: string) => Promise<ActionResult>;
  remove: (imageId: string) => Promise<ActionResult>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const altId = useId();
  const [pending, startTransition] = useTransition();
  const [shown, applyOp] = useOptimistic(images, (state: ProductImage[], op: Op) => {
    if (op.type === 'delete') return state.filter((i) => i.id !== op.id);
    if (op.type === 'alt') return state.map((i) => (i.id === op.id ? { ...i, alt: op.alt } : i));
    const byId = new Map(state.map((i) => [i.id, i]));
    return op.ids.flatMap((id) => byId.get(id) ?? []);
  });

  const [staged, setStaged] = useState<Staged[]>([]);
  const [alt, setAlt] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const byId = new Map(shown.map((i) => [i.id, i]));
  const ordered = dragOrder ? dragOrder.flatMap((id) => byId.get(id) ?? []) : shown;
  const room = MAX_IMAGES - shown.length - staged.length;

  function stage(list: FileList | File[]) {
    const errors: string[] = [];
    const accepted: Staged[] = [];
    let overflow = 0;
    for (const file of Array.from(list)) {
      if (!(ACCEPT.includes(file.type) || (file.type === '' && ACCEPT_EXT.test(file.name)))) {
        errors.push(`${file.name} is not a supported image. Use JPEG, PNG, WebP, GIF or AVIF.`);
      } else if (file.size > MAX_BYTES) {
        errors.push(`${file.name} is ${formatBytes(file.size)}. Images must be 20 MB or smaller.`);
      } else if (accepted.length >= room) {
        overflow++;
      } else {
        accepted.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
          file,
          preview: URL.createObjectURL(file),
        });
      }
    }
    if (overflow) {
      errors.push(
        `A product can have up to ${MAX_IMAGES} images, so ${overflow} file${overflow === 1 ? ' was' : 's were'} not added.`,
      );
    }
    setStaged((prev) => [...prev, ...accepted]);
    setNotice(errors.length ? { tone: 'error', text: errors.join(' ') } : null);
  }

  function unstage(id?: string) {
    setStaged((prev) => {
      for (const s of prev) if (!id || s.id === id) URL.revokeObjectURL(s.preview);
      return id ? prev.filter((s) => s.id !== id) : [];
    });
  }

  function uploadStaged() {
    const files = staged.map((s) => s.file);
    if (!files.length) return;
    const groups = batches(files);
    setNotice(null);
    startTransition(async () => {
      let done = 0;
      for (const [index, group] of groups.entries()) {
        setProgress(
          groups.length > 1
            ? `Uploading ${done + 1}–${done + group.length} of ${files.length}…`
            : `Uploading ${files.length === 1 ? 'image' : `${files.length} images`}…`,
        );
        const formData = new FormData();
        for (const file of group) formData.append('files', file, file.name);
        if (alt.trim()) formData.set('alt', alt.trim());
        const result = await upload(formData);
        if (!result.ok) {
          setStaged((prev) => {
            const sent = new Set(groups.slice(0, index).flat());
            for (const s of prev) if (sent.has(s.file)) URL.revokeObjectURL(s.preview);
            return prev.filter((s) => !sent.has(s.file));
          });
          setProgress(null);
          setNotice({
            tone: 'error',
            text: done ? `${done} uploaded, then: ${result.error}` : result.error,
          });
          return;
        }
        done += group.length;
      }
      unstage();
      setAlt('');
      setProgress(null);
      setNotice({
        tone: 'success',
        text: done === 1 ? 'Image uploaded.' : `${done} images uploaded.`,
      });
    });
  }

  function commitOrder(ids: string[]) {
    if (ids.join() === shown.map((i) => i.id).join()) return;
    setNotice(null);
    startTransition(async () => {
      applyOp({ type: 'order', ids });
      const result = await reorder(ids);
      setNotice(result.ok ? null : { tone: 'error', text: result.error });
    });
  }

  function closeDialog() {
    setDialog(null);
    setDialogError(null);
  }

  function runDialog(work: () => Promise<ActionResult>, optimistic?: Op) {
    setDialogError(null);
    startTransition(async () => {
      // Optimistic changes revert by themselves if the action fails.
      if (optimistic) applyOp(optimistic);
      const result = await work();
      if (!result.ok) {
        setDialogError(result.error);
        return;
      }
      setDialog(null);
      setNotice(result.message ? { tone: 'success', text: result.message } : null);
    });
  }

  // ── Drag and drop: files from the desktop, or tiles within the grid ────────────
  const isFileDrag = (e: DragEvent) => e.dataTransfer.types.includes('Files');

  function onZoneDragOver(e: DragEvent) {
    if (!canWrite || !isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropActive(true);
  }
  function onZoneDrop(e: DragEvent) {
    if (!canWrite || !isFileDrag(e)) return;
    e.preventDefault();
    setDropActive(false);
    stage(e.dataTransfer.files);
  }

  function onTileDragStart(e: DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragId(id);
    setDragOrder(shown.map((i) => i.id));
  }
  function onTileDragOver(e: DragEvent, overId: string) {
    if (!dragId || !dragOrder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overId === dragId) return;
    const from = dragOrder.indexOf(dragId);
    const to = dragOrder.indexOf(overId);
    if (from !== -1 && to !== -1) setDragOrder(move(dragOrder, from, to));
  }
  function onTileDragEnd() {
    const ids = dragOrder;
    setDragId(null);
    setDragOrder(null);
    if (ids) commitOrder(ids);
  }

  const busy = pending || progress !== null;
  const addButtons = canWrite ? (
    <>
      <button
        type="button"
        className={buttonClass('secondary', 'sm')}
        onClick={() => inputRef.current?.click()}
        disabled={room <= 0}
      >
        <Icon name="upload" className="-ml-0.5 h-4 w-4 text-slate-500" />
        Add images
      </button>
      <button
        type="button"
        className={buttonClass('ghost', 'sm')}
        onClick={() => setDialog({ kind: 'url' })}
        disabled={room <= 0}
      >
        <Icon name="link" className="-ml-0.5 h-4 w-4 text-slate-500" />
        Add from URL
      </button>
    </>
  ) : null;

  return (
    <Card
      title="Media"
      description={
        shown.length
          ? `${shown.length} of ${MAX_IMAGES} images · the first is the main photo${canWrite ? '; drag to reorder' : ''}`
          : 'Photos shoppers see on the product page and in listings.'
      }
      actions={shown.length ? addButtons : null}
    >
      {canWrite ? (
        <input
          ref={inputRef}
          type="file"
          multiple
          aria-label="Upload images"
          accept={ACCEPT.join(',')}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files?.length) stage(e.target.files);
            e.target.value = '';
          }}
        />
      ) : null}

      <div
        onDragOver={onZoneDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false);
        }}
        onDrop={onZoneDrop}
        className={`relative rounded-lg transition-shadow ${dropActive ? 'ring-2 ring-indigo-500 ring-offset-4' : ''}`}
      >
        {dropActive ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-indigo-50/90 text-sm font-medium text-indigo-700">
            Drop images to add them
          </div>
        ) : null}

        {ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-xs ring-1 ring-slate-200">
              <Icon name="image" className="h-5 w-5" />
            </span>
            {canWrite ? (
              <>
                <div className="mt-3 flex flex-wrap justify-center gap-2">{addButtons}</div>
                <p className="mt-2 text-xs text-slate-500">
                  or drop files here · JPEG, PNG, WebP, GIF or AVIF up to 20 MB
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No images yet.</p>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-5">
            {ordered.map((image, index) => {
              const featured = index === 0;
              const label = `image ${index + 1}`;
              return (
                <li
                  key={image.id}
                  draggable={canWrite && !busy}
                  onDragStart={(e) => onTileDragStart(e, image.id)}
                  onDragOver={(e) => onTileDragOver(e, image.id)}
                  onDrop={(e) => {
                    if (dragId) e.preventDefault();
                  }}
                  onDragEnd={onTileDragEnd}
                  className={`group relative overflow-hidden rounded-lg border bg-slate-50 ${
                    featured ? 'col-span-2 row-span-2' : ''
                  } ${dragId === image.id ? 'border-indigo-400 opacity-40' : 'border-slate-200'} ${
                    canWrite && !busy ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageSrc(image, featured ? 600 : 200)}
                    srcSet={imageSrcSet(image)}
                    sizes={
                      featured
                        ? '(min-width: 1024px) 320px, 60vw'
                        : '(min-width: 1024px) 160px, 30vw'
                    }
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    draggable={false}
                    loading={index > 7 ? 'lazy' : undefined}
                    className="aspect-square h-full w-full object-cover"
                  />
                  <span className="pointer-events-none absolute top-1.5 left-1.5 flex items-center gap-1">
                    {featured ? (
                      <span className="rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
                        Main
                      </span>
                    ) : null}
                    {!image.alt ? (
                      <span className="rounded-md bg-amber-100/95 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                        No alt
                      </span>
                    ) : null}
                  </span>
                  {canWrite ? (
                    <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <span className="flex gap-1">
                        <TileButton
                          icon="chevronLeft"
                          label={`Move ${label} earlier`}
                          disabled={busy || index === 0}
                          onClick={() =>
                            commitOrder(
                              move(
                                shown.map((i) => i.id),
                                index,
                                index - 1,
                              ),
                            )
                          }
                        />
                        <TileButton
                          icon="chevronRight"
                          label={`Move ${label} later`}
                          disabled={busy || index === ordered.length - 1}
                          onClick={() =>
                            commitOrder(
                              move(
                                shown.map((i) => i.id),
                                index,
                                index + 1,
                              ),
                            )
                          }
                        />
                      </span>
                      <span className="flex gap-1">
                        <TileButton
                          icon="pencil"
                          label={`Edit alt text of ${label}`}
                          disabled={busy}
                          onClick={() => setDialog({ kind: 'alt', image, index })}
                        />
                        <TileButton
                          icon="trash"
                          label={`Delete ${label}`}
                          danger
                          disabled={busy}
                          onClick={() => setDialog({ kind: 'delete', image, index })}
                        />
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
            {canWrite && room > 0 ? (
              <li>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-[13px] font-medium text-slate-500 transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 hover:text-indigo-600"
                >
                  <Icon name="plus" className="h-5 w-5" />
                  Add
                  <span className="sr-only"> images</span>
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      <div aria-live="polite" className="empty:hidden mt-3">
        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      </div>

      {staged.length > 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-slate-800">
              {staged.length} {staged.length === 1 ? 'image' : 'images'} ready to upload
            </p>
            <button
              type="button"
              className="text-[13px] font-medium text-slate-500 hover:text-slate-800"
              onClick={() => unstage()}
              disabled={busy}
            >
              Clear
            </button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {staged.map((s) => (
              <li
                key={s.id}
                className="flex max-w-full items-center gap-2 rounded-lg bg-white py-1 pr-1 pl-1 shadow-xs ring-1 ring-slate-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.preview} alt="" className="h-8 w-8 rounded-md object-cover" />
                <span className="min-w-0 truncate text-xs text-slate-700">
                  {s.file.name}
                  <span className="ml-1 text-slate-400">{formatBytes(s.file.size)}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${s.file.name}`}
                  onClick={() => unstage(s.id)}
                  disabled={busy}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Icon name="close" className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor={altId} className="block text-[13px] font-medium text-slate-800">
                Alt text
              </label>
              <input
                id={altId}
                value={alt}
                maxLength={512}
                onChange={(e) => setAlt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    uploadStaged();
                  }
                }}
                placeholder="Describe the image for screen readers"
                className={`${inputClass} w-full py-2`}
              />
            </div>
            <button
              type="button"
              className={buttonClass('primary')}
              onClick={uploadStaged}
              disabled={busy}
            >
              {progress ? <Spinner /> : null}
              {progress ? 'Uploading…' : 'Upload'}
            </button>
          </div>
          {progress ? <p className="mt-2 text-xs text-slate-500">{progress}</p> : null}
        </div>
      ) : null}

      {dialog?.kind === 'url' ? (
        <UrlDialog
          error={dialogError}
          pending={pending}
          onClose={closeDialog}
          onSubmit={(url, urlAlt) => runDialog(() => importFromUrl(url, urlAlt))}
        />
      ) : null}
      {dialog?.kind === 'alt' ? (
        <AltDialog
          image={dialog.image}
          index={dialog.index}
          error={dialogError}
          pending={pending}
          onClose={closeDialog}
          onSubmit={(value) =>
            runDialog(() => updateAlt(dialog.image.id, value), {
              type: 'alt',
              id: dialog.image.id,
              alt: value.trim(),
            })
          }
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <Dialog
          title={`Delete image ${dialog.index + 1}?`}
          description="It is removed from the gallery and from any variant that shows it. This cannot be undone."
          onClose={closeDialog}
          size="sm"
          footer={
            <>
              <button type="button" className={buttonClass('secondary')} onClick={closeDialog}>
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass('danger')}
                disabled={pending}
                onClick={() =>
                  runDialog(() => remove(dialog.image.id), { type: 'delete', id: dialog.image.id })
                }
              >
                {pending ? <Spinner /> : null}
                Delete image
              </button>
            </>
          }
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc(dialog.image, 200)}
              alt=""
              className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
            />
            <p className="min-w-0 text-sm text-slate-600 [overflow-wrap:anywhere]">
              {dialog.image.alt || 'No alt text'}
            </p>
          </div>
          {dialogError ? (
            <div className="mt-3">
              <Alert tone="error">{dialogError}</Alert>
            </div>
          ) : null}
        </Dialog>
      ) : null}
    </Card>
  );
}

function TileButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: 'chevronLeft' | 'chevronRight' | 'pencil' | 'trash';
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-md bg-white/95 shadow-sm ring-1 ring-slate-900/10 transition-colors hover:bg-white disabled:opacity-40 ${
        danger ? 'text-red-600' : 'text-slate-700'
      }`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" strokeWidth={2.25} />
    </button>
  );
}

function Spinner() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function UrlDialog({
  error,
  pending,
  onClose,
  onSubmit,
}: {
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (url: string, alt: string) => void;
}) {
  const urlId = useId();
  const altId = useId();
  const formId = useId();
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(url, alt);
  }
  return (
    <Dialog
      title="Add image from URL"
      description="We download the image and store a copy, so the link can change later."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={buttonClass('secondary')} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className={buttonClass('primary')} disabled={pending}>
            {pending ? <Spinner /> : null}
            {pending ? 'Adding…' : 'Add image'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="space-y-1.5">
          <label htmlFor={urlId} className="block text-[13px] font-medium text-slate-800">
            Image URL
          </label>
          <input
            id={urlId}
            type="url"
            required
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            pattern="https://.*"
            className={`${inputClass} w-full py-2`}
          />
          <p className="text-xs text-slate-500">
            A public https:// link to a JPEG, PNG, WebP, GIF or AVIF.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={altId} className="block text-[13px] font-medium text-slate-800">
            Alt text (optional)
          </label>
          <input
            id={altId}
            value={alt}
            maxLength={512}
            onChange={(e) => setAlt(e.target.value)}
            className={`${inputClass} w-full py-2`}
          />
        </div>
      </form>
    </Dialog>
  );
}

function AltDialog({
  image,
  index,
  error,
  pending,
  onClose,
  onSubmit,
}: {
  image: ProductImage;
  index: number;
  error: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (alt: string) => void;
}) {
  const altId = useId();
  const formId = useId();
  const [alt, setAlt] = useState(image.alt);
  return (
    <Dialog
      title={`Alt text for image ${index + 1}`}
      description="Read aloud by screen readers and shown if the image cannot load."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={buttonClass('secondary')} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className={buttonClass('primary')} disabled={pending}>
            {pending ? <Spinner /> : null}
            {pending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(alt);
        }}
        className="space-y-4"
      >
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc(image, 200)}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-cover"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor={altId} className="block text-[13px] font-medium text-slate-800">
              Alt text
            </label>
            <textarea
              id={altId}
              rows={3}
              autoFocus
              value={alt}
              maxLength={512}
              onChange={(e) => setAlt(e.target.value)}
              className={`${inputClass} w-full py-2`}
            />
            <p className="text-xs text-slate-500 tabular-nums">{alt.length}/512</p>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

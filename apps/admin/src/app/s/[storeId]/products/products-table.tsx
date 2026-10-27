'use client';

import { formatMoney, type ProductListItem } from '@repo/contracts';
import Link from 'next/link';
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Dialog } from '@/components/dialog';
import { Icon } from '@/components/icons';
import { Alert, Badge, buttonClass, inputClass, Table, Td, Thumbnail } from '@/components/ui';
import type { ActionResult, BulkProductAction } from './actions';
import { statusTone } from './status';

type Row = ProductListItem & { scheduledFor: string | null };

type Pending = { action: 'add_tags' | 'remove_tags' } | { action: 'delete' } | null;

export function ProductsTable({
  items,
  currency,
  base,
  canWrite,
  bulk,
  empty,
}: {
  items: Row[];
  /** Shown instead of the table when there are no items (the notice stays visible). */
  empty: ReactNode;
  currency: string;
  base: string;
  canWrite: boolean;
  bulk: (ids: string[], action: BulkProductAction, tags?: string[]) => Promise<ActionResult>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [dialog, setDialog] = useState<Pending>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const allRef = useRef<HTMLInputElement>(null);

  // Drop selections that are no longer on the page (after a delete or a filter change).
  const visible = new Set(items.map((p) => p.id));
  const chosen = [...selected].filter((id) => visible.has(id));
  const all = chosen.length > 0 && chosen.length === items.length;
  const some = chosen.length > 0 && !all;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function run(action: BulkProductAction, tags?: string[]) {
    setNotice(null);
    setDialogError(null);
    const ids = chosen;
    startTransition(async () => {
      const result = await bulk(ids, action, tags);
      if (!result.ok) {
        if (dialog) setDialogError(result.error);
        else setNotice({ tone: 'error', text: result.error });
        return;
      }
      setDialog(null);
      setSelected(new Set());
      setNotice({ tone: 'success', text: result.message ?? 'Done.' });
    });
  }

  const count = chosen.length;
  const plural = `${count} product${count === 1 ? '' : 's'}`;

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="empty:hidden">
        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      </div>

      {canWrite && count > 0 ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="sticky top-2 z-20 flex flex-wrap items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/95 px-3 py-2 shadow-raised backdrop-blur"
        >
          <span className="mr-2 text-[13px] font-semibold text-indigo-950 tabular-nums">
            {count} selected
          </span>
          <BulkButton disabled={pending} onClick={() => run('activate')}>
            Set as active
          </BulkButton>
          <BulkButton disabled={pending} onClick={() => run('draft')}>
            Set as draft
          </BulkButton>
          <BulkButton disabled={pending} onClick={() => run('archive')}>
            Archive
          </BulkButton>
          <BulkButton disabled={pending} onClick={() => setDialog({ action: 'add_tags' })}>
            Add tags
          </BulkButton>
          <BulkButton disabled={pending} onClick={() => setDialog({ action: 'remove_tags' })}>
            Remove tags
          </BulkButton>
          <button
            type="button"
            disabled={pending}
            onClick={() => setDialog({ action: 'delete' })}
            className={`${buttonClass('secondary', 'sm')} text-red-600 hover:text-red-700`}
          >
            <Icon name="trash" className="-ml-0.5 h-3.5 w-3.5" />
            Delete
          </button>
          <span className="ml-auto flex items-center gap-2">
            {pending ? <span className="text-[13px] text-indigo-900">Working…</span> : null}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md px-2 py-1 text-[13px] font-medium text-indigo-700 hover:bg-indigo-100"
            >
              Clear selection
            </button>
          </span>
        </div>
      ) : null}

      {items.length === 0 ? (
        empty
      ) : (
        <Table
          head={[
            canWrite ? (
              <input
                key="all"
                ref={allRef}
                type="checkbox"
                aria-label="Select all products on this page"
                checked={all}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(items.map((p) => p.id)) : new Set())
                }
                className="h-4 w-4 rounded border-slate-300 align-middle"
              />
            ) : (
              <span key="img" className="sr-only">
                Image
              </span>
            ),
            'Product',
            'Status',
            'Inventory',
            'Price',
            'Variants',
          ]}
          numeric={[4, 5]}
        >
          {items.map((p) => {
            const isSelected = chosen.includes(p.id);
            return (
              <tr key={p.id} className={isSelected ? 'bg-indigo-50/50' : undefined}>
                <Td className="w-[1%] pr-0! whitespace-nowrap">
                  <span className="flex items-center gap-3">
                    {canWrite ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${p.title}`}
                        checked={isSelected}
                        onChange={(e) => toggle(p.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    ) : null}
                    <Thumbnail src={p.thumbnailUrl ?? p.imageUrl} />
                  </span>
                </Td>
                <Td className="min-w-48">
                  <Link
                    href={`${base}/${p.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-600"
                  >
                    {p.title}
                  </Link>
                  {p.isBundle ? (
                    <span className="ml-2 align-middle">
                      <Badge tone="indigo">Bundle</Badge>
                    </span>
                  ) : null}
                  {p.vendor || p.productType || p.supplierName ? (
                    <p className="text-xs text-slate-500">
                      {[p.vendor, p.productType, p.supplierName && `from ${p.supplierName}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                </Td>
                <Td>
                  <span className="flex flex-wrap items-center gap-1">
                    <Badge tone={statusTone(p.status)}>
                      {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </Badge>
                    {p.scheduledFor ? (
                      <span title={`Goes live ${p.scheduledFor}`}>
                        <Badge tone="blue">Scheduled for {p.scheduledFor}</Badge>
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td className={`whitespace-nowrap ${p.totalInventory <= 0 ? 'text-red-600' : ''}`}>
                  {p.totalInventory} in stock
                </Td>
                <Td numeric>
                  {p.minPrice === p.maxPrice
                    ? formatMoney(p.minPrice, currency)
                    : `${formatMoney(p.minPrice, currency)} – ${formatMoney(p.maxPrice, currency)}`}
                </Td>
                <Td numeric>{p.variantCount}</Td>
              </tr>
            );
          })}
        </Table>
      )}

      {dialog?.action === 'delete' ? (
        <Dialog
          title={`Delete ${plural}?`}
          description="Products and their images are deleted permanently. Orders keep their line items."
          size="sm"
          onClose={() => {
            setDialog(null);
            setDialogError(null);
          }}
          footer={
            <>
              <button
                type="button"
                className={buttonClass('secondary')}
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={buttonClass('danger')}
                disabled={pending}
                onClick={() => run('delete')}
              >
                {pending ? 'Deleting…' : `Delete ${plural}`}
              </button>
            </>
          }
        >
          {dialogError ? <Alert tone="error">{dialogError}</Alert> : null}
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-700">
            {items
              .filter((p) => chosen.includes(p.id))
              .map((p) => (
                <li key={p.id} className="truncate">
                  {p.title}
                </li>
              ))}
          </ul>
        </Dialog>
      ) : null}

      {dialog?.action === 'add_tags' || dialog?.action === 'remove_tags' ? (
        <TagsDialog
          mode={dialog.action}
          plural={plural}
          pending={pending}
          error={dialogError}
          onClose={() => {
            setDialog(null);
            setDialogError(null);
          }}
          onSubmit={(tags) => run(dialog.action, tags)}
        />
      ) : null}
    </div>
  );
}

function BulkButton({
  children,
  onClick,
  disabled,
}: {
  children: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClass('secondary', 'sm')}
    >
      {children}
    </button>
  );
}

function TagsDialog({
  mode,
  plural,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  mode: 'add_tags' | 'remove_tags';
  plural: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (tags: string[]) => void;
}) {
  const id = useId();
  const formId = useId();
  const [value, setValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const adding = mode === 'add_tags';

  function submit(e: FormEvent) {
    e.preventDefault();
    const tags = [
      ...new Set(
        value
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (!tags.length) {
      setLocalError('Enter at least one tag.');
      return;
    }
    if (tags.length > 50) {
      setLocalError('Enter at most 50 tags at a time.');
      return;
    }
    setLocalError(null);
    onSubmit(tags);
  }

  return (
    <Dialog
      title={adding ? `Add tags to ${plural}` : `Remove tags from ${plural}`}
      description={
        adding
          ? 'Existing tags are kept. A product can have up to 50 tags.'
          : 'Products without these tags are left as they are.'
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className={buttonClass('secondary')} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className={buttonClass('primary')} disabled={pending}>
            {pending ? 'Working…' : adding ? 'Add tags' : 'Remove tags'}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-3">
        {error || localError ? <Alert tone="error">{localError ?? error}</Alert> : null}
        <div className="space-y-1.5">
          <label htmlFor={id} className="block text-[13px] font-medium text-slate-800">
            {adding ? 'Tags to add' : 'Tags to remove'}
          </label>
          <input
            id={id}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sale, summer"
            className={`${inputClass} w-full py-2`}
          />
          <p className="text-xs text-slate-500">Comma separated.</p>
        </div>
      </form>
    </Dialog>
  );
}

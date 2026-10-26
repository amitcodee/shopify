'use client';

import {
  formatMoney,
  parseMoney,
  STORE_APP_CATALOG,
  type StoreAppId,
  type StoreApps,
} from '@repo/contracts';
import { type ReactNode, useId, useState } from 'react';
import { Icon, type IconName } from '@/components/icons';
import { Alert, Badge, buttonClass, inputClass } from '@/components/ui';
import { saveAppsAction } from '../settings/theme/editor/actions';

const ICONS: Record<StoreAppId, IconName> = {
  freeShippingBar: 'truck',
  productBadges: 'sparkles',
  whatsapp: 'inbox',
  shareButtons: 'link',
  cookieNotice: 'info',
};

const TINTS: Record<StoreAppId, string> = {
  freeShippingBar: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  productBadges: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  whatsapp: 'bg-green-50 text-green-700 ring-green-600/15',
  shareButtons: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  cookieNotice: 'bg-amber-50 text-amber-700 ring-amber-600/15',
};

/** The store's apps: switch each on or off and edit its settings. */
export function AppsManager({
  storeId,
  initial,
  currency,
  canEdit,
}: {
  storeId: string;
  initial: StoreApps;
  currency: string;
  canEdit: boolean;
}) {
  const [apps, setApps] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [open, setOpen] = useState<StoreAppId | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const save = async (next: StoreApps, text: string) => {
    setBusy(true);
    setMessage(null);
    const result = await saveAppsAction(storeId, next);
    setBusy(false);
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error });
      return false;
    }
    setApps(result.data);
    setSaved(result.data);
    setMessage({ tone: 'success', text });
    return true;
  };

  const update = <K extends StoreAppId>(id: K, patch: Partial<StoreApps[K]>) =>
    setApps((a) => ({ ...a, [id]: { ...a[id], ...patch } }));

  const installed = STORE_APP_CATALOG.filter((a) => saved[a.id].enabled).length;

  return (
    <div className="space-y-5">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <p className="text-sm text-slate-600">
        {installed} of {STORE_APP_CATALOG.length} apps on
      </p>
      <ul className="grid gap-4 lg:grid-cols-2">
        {STORE_APP_CATALOG.map((app) => {
          const on = saved[app.id].enabled;
          const editing = open === app.id;
          return (
            <li
              key={app.id}
              className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-5 shadow-card"
            >
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${TINTS[app.id]}`}
                >
                  <Icon name={ICONS[app.id]} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900">{app.name}</h2>
                    <Badge tone={on ? 'green' : 'gray'}>{on ? 'On' : 'Off'}</Badge>
                    <span className="text-xs text-slate-400">{app.category}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{app.description}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const next = {
                          ...saved,
                          [app.id]: { ...saved[app.id], enabled: !on },
                        } as StoreApps;
                        void save(next, `${app.name} ${on ? 'turned off' : 'is on'}.`);
                      }}
                      className={buttonClass(on ? 'secondary' : 'primary', 'sm')}
                    >
                      {on ? 'Turn off' : 'Turn on'}
                    </button>
                    {hasSettings(app.id) ? (
                      <button
                        type="button"
                        aria-expanded={editing}
                        onClick={() => {
                          setApps(saved);
                          setOpen(editing ? null : app.id);
                        }}
                        className={buttonClass('ghost', 'sm')}
                      >
                        <Icon name="settings" className="-ml-0.5 h-4 w-4" />
                        Settings
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-slate-500">
                    You can view apps; ask the owner to change them.
                  </p>
                )}
              </div>
              {editing ? (
                <form
                  className="mt-4 space-y-4 rounded-lg bg-slate-50 p-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await save(apps, `${app.name} settings saved.`)) setOpen(null);
                  }}
                >
                  <AppSettings id={app.id} apps={apps} update={update} currency={currency} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className={buttonClass('primary', 'sm')}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      className={buttonClass('secondary', 'sm')}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function hasSettings(id: StoreAppId): boolean {
  return id !== 'shareButtons';
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children(id)}
      {help ? <p className="mt-1 text-xs text-slate-500">{help}</p> : null}
    </div>
  );
}

function AppSettings({
  id,
  apps,
  update,
  currency,
}: {
  id: StoreAppId;
  apps: StoreApps;
  update: <K extends StoreAppId>(id: K, patch: Partial<StoreApps[K]>) => void;
  currency: string;
}) {
  const [amount, setAmount] = useState(() =>
    formatMoney(apps.freeShippingBar.threshold, currency).replace(/[^\d.]/g, ''),
  );
  const input = `${inputClass} w-full`;

  if (id === 'whatsapp') {
    return (
      <>
        <Field
          label="WhatsApp number"
          help="Country code and number, digits only — for example 919876543210."
        >
          {(fid) => (
            <input
              id={fid}
              inputMode="numeric"
              className={input}
              value={apps.whatsapp.phone}
              onChange={(e) => update('whatsapp', { phone: e.target.value.replace(/\D/g, '') })}
            />
          )}
        </Field>
        <Field label="First message">
          {(fid) => (
            <input
              id={fid}
              maxLength={160}
              className={input}
              value={apps.whatsapp.message}
              onChange={(e) => update('whatsapp', { message: e.target.value })}
            />
          )}
        </Field>
      </>
    );
  }
  if (id === 'freeShippingBar') {
    return (
      <>
        <Field
          label={`Free shipping from (${currency})`}
          help="Match the free-shipping rate in your shipping settings."
        >
          {(fid) => (
            <input
              id={fid}
              inputMode="decimal"
              className={input}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                const minor = parseMoney(e.target.value, currency);
                if (minor !== null && minor > 0) update('freeShippingBar', { threshold: minor });
              }}
            />
          )}
        </Field>
        <Field label="Message" help="{amount} is replaced with what is left to spend.">
          {(fid) => (
            <input
              id={fid}
              maxLength={80}
              className={input}
              value={apps.freeShippingBar.message}
              onChange={(e) => update('freeShippingBar', { message: e.target.value })}
            />
          )}
        </Field>
        <Field label="When reached">
          {(fid) => (
            <input
              id={fid}
              maxLength={80}
              className={input}
              value={apps.freeShippingBar.successMessage}
              onChange={(e) => update('freeShippingBar', { successMessage: e.target.value })}
            />
          )}
        </Field>
      </>
    );
  }
  if (id === 'productBadges') {
    return (
      <Field label="Show “New” for products published in the last (days)">
        {(fid) => (
          <input
            id={fid}
            type="number"
            min={1}
            max={90}
            className={input}
            value={apps.productBadges.newDays}
            onChange={(e) => update('productBadges', { newDays: Number(e.target.value) || 1 })}
          />
        )}
      </Field>
    );
  }
  if (id === 'cookieNotice') {
    return (
      <Field label="Message">
        {(fid) => (
          <textarea
            id={fid}
            rows={3}
            maxLength={200}
            className={input}
            value={apps.cookieNotice.message}
            onChange={(e) => update('cookieNotice', { message: e.target.value })}
          />
        )}
      </Field>
    );
  }
  return null;
}

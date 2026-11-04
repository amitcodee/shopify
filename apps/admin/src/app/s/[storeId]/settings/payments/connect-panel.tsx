'use client';

import { type ReactNode, useState } from 'react';
import { Icon } from '@/components/icons';
import { buttonClass } from '@/components/ui';

/**
 * One click to connect: opens the gateway's API keys page in a new tab and the keys form here, so
 * the merchant only copies and pastes. Updating saved keys just opens the form.
 */
export function ConnectPanel({
  label,
  keysUrl,
  connected,
  children,
}: {
  label: string;
  keysUrl: string;
  connected: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    if (!open && !connected) window.open(keysUrl, '_blank', 'noopener,noreferrer');
    setOpen(!open);
  };
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={`${buttonClass(connected ? 'secondary' : 'primary')} w-full`}
      >
        {connected ? 'Update keys' : `Connect ${label}`}
        <Icon
          name={!connected && !open ? 'external' : 'chevronDown'}
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

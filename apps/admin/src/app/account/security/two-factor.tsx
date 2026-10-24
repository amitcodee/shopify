'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/form';
import { Alert, inputClass } from '@/components/ui';
import { disableTwoFactorAction, enableTwoFactorAction, startTwoFactorAction } from './actions';

function CodeInput({ id }: { id: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        6-digit code
      </label>
      <input
        id={id}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        className={`${inputClass} w-40 py-2 tracking-widest`}
      />
    </div>
  );
}

export function TwoFactor({ enabled }: { enabled: boolean }) {
  const [setupState, startSetup] = useActionState(startTwoFactorAction, undefined);
  const [enableState, enable] = useActionState(enableTwoFactorAction, undefined);
  const [disableState, disable] = useActionState(disableTwoFactorAction, undefined);

  if (enabled) {
    return (
      <form action={disable} className="space-y-3">
        {disableState?.error ? <Alert tone="error">{disableState.error}</Alert> : null}
        {enableState?.success ? <Alert tone="success">{enableState.success}</Alert> : null}
        <p className="text-sm text-slate-600">
          Enter a current code to turn two-factor authentication off.
        </p>
        <CodeInput id="disable-code" />
        <SubmitButton variant="danger">Turn off</SubmitButton>
      </form>
    );
  }

  const setup = setupState?.totpSetup;
  return (
    <div className="space-y-4">
      {disableState?.success ? <Alert tone="success">{disableState.success}</Alert> : null}
      {setupState?.error ? <Alert tone="error">{setupState.error}</Alert> : null}
      {!setup ? (
        <form action={startSetup}>
          <SubmitButton>Set up two-factor authentication</SubmitButton>
        </form>
      ) : (
        <form action={enable} className="space-y-3">
          {enableState?.error ? <Alert tone="error">{enableState.error}</Alert> : null}
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              In your authenticator app, add an account using this setup key:
              <code className="mt-1 block break-all rounded bg-slate-100 px-2 py-1 font-mono">
                {setup.secret}
              </code>
              <a href={setup.otpauthUrl} className="text-xs text-indigo-600 underline">
                Open in an authenticator app on this device
              </a>
            </li>
            <li>Enter the 6-digit code it shows to finish.</li>
          </ol>
          <CodeInput id="enable-code" />
          <SubmitButton>Turn on</SubmitButton>
        </form>
      )}
    </div>
  );
}

import {
  minorToDecimalString,
  STORE_GATEWAYS,
  type ConnectedStoreGateway,
  type StoreGatewayInfo,
  type StoreGatewaysOverview,
} from '@repo/contracts';
import { CopyButton } from '@/components/copy-button';
import { ActionForm, CheckboxField, Field, SelectField, SubmitButton } from '@/components/form';
import { Badge, Card, linkClass } from '@/components/ui';
import { SmallAction } from '../small-action';
import { saveCodAction, saveStoreGatewayAction, storeGatewayAction } from './actions';
import { ConnectPanel } from './connect-panel';

function GatewayCard({
  storeId,
  info,
  connected,
  webhookUrl,
  currency,
  canManage,
}: {
  storeId: string;
  info: StoreGatewayInfo;
  connected: ConnectedStoreGateway | undefined;
  webhookUrl: string;
  currency: string;
  canManage: boolean;
}) {
  const fits = !info.currencies || info.currencies.includes(currency);
  return (
    <section
      aria-labelledby={`store-gateway-${info.id}`}
      className={`flex min-w-0 flex-col rounded-xl border bg-white p-4 ${
        connected?.active ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white"
          >
            {info.label.slice(0, 2)}
          </span>
          <h3 id={`store-gateway-${info.id}`} className="font-semibold text-slate-900">
            {info.label}
          </h3>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {connected ? (
            <Badge tone={connected.mode === 'live' ? 'blue' : 'yellow'}>
              {connected.mode === 'live' ? 'Live keys' : 'Test keys'}
            </Badge>
          ) : null}
          {connected?.active ? <Badge tone="green">Taking payments</Badge> : null}
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{info.description}</p>
      <ul aria-label="Payment methods" className="mt-3 flex flex-wrap gap-1">
        {info.methods.map((method) => (
          <li
            key={method}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
          >
            {method}
          </li>
        ))}
      </ul>

      {connected ? (
        <p className="mt-3 text-xs text-slate-500">
          Account <code className="text-slate-700">{connected.keyHint}</code> · verified{' '}
          {new Date(connected.verifiedAt).toLocaleDateString('en-GB')}
        </p>
      ) : null}

      {!fits ? (
        <p className="mt-3 text-sm text-amber-800">
          {info.label} charges in {info.currencies?.join(', ')}. This store sells in {currency}. You
          can save keys now and activate after changing the store currency.
        </p>
      ) : null}

      {canManage ? (
        <div className="mt-auto pt-4">
          {connected ? (
            <div className="mb-3 flex flex-wrap items-center gap-4">
              {connected.active ? (
                <SmallAction
                  action={storeGatewayAction.bind(null, storeId, info.id, 'deactivate')}
                  label="Deactivate"
                />
              ) : (
                <SmallAction
                  action={storeGatewayAction.bind(null, storeId, info.id, 'activate')}
                  label="Use for checkout"
                />
              )}
              <SmallAction
                action={storeGatewayAction.bind(null, storeId, info.id, 'remove')}
                label="Remove keys"
                danger
              />
            </div>
          ) : null}
          <ConnectPanel label={info.label} keysUrl={info.keysUrl} connected={Boolean(connected)}>
            <p className="text-xs text-slate-600">
              Find these in your{' '}
              <a className={linkClass} href={info.keysUrl} target="_blank" rel="noreferrer">
                {info.label} dashboard
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              . We check them with {info.label}, store them encrypted and never show secrets again.
            </p>
            <ActionForm
              action={saveStoreGatewayAction.bind(null, storeId, info.id)}
              className="space-y-3"
            >
              {info.modeFromKey ? null : (
                <SelectField
                  name="mode"
                  label="Environment"
                  defaultValue={connected?.mode ?? 'test'}
                  options={[
                    { value: 'test', label: 'Test (no real money)' },
                    { value: 'live', label: 'Live' },
                  ]}
                />
              )}
              {info.fields.map((field) => (
                <Field
                  key={field.key}
                  name={field.key}
                  label={field.label}
                  type={field.secret ? 'password' : 'text'}
                  // Browsers ignore "off" on forms with a password field and fill in the admin login.
                  autoComplete={field.secret ? 'new-password' : 'one-time-code'}
                  data-1p-ignore
                  data-lpignore="true"
                  spellCheck={false}
                  placeholder={
                    connected && field.secret ? 'Saved (leave blank to keep)' : field.placeholder
                  }
                  hint={field.hint}
                  required={!connected && !field.optional}
                />
              ))}
              <SubmitButton variant="secondary">
                {connected ? 'Verify and save' : 'Verify and connect'}
              </SubmitButton>
            </ActionForm>
            {info.webhookSteps ? (
              <div className="border-t border-slate-200 pt-3 text-xs text-slate-600">
                <p>{info.webhookSteps}</p>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2">
                  <code className="min-w-0 flex-1 break-all text-slate-800">{webhookUrl}</code>
                  <CopyButton value={webhookUrl} label="Copy webhook URL" />
                </div>
                {/\/\/(localhost|127\.0\.0\.1)[:/]/.test(webhookUrl) ? (
                  <p className="mt-2 text-amber-800">
                    This is a local address, which {info.label} cannot reach. Deploy the API with
                    PUBLIC_API_URL set, or use a tunnel, before testing payments.
                  </p>
                ) : null}
              </div>
            ) : null}
          </ConnectPanel>
        </div>
      ) : null}
    </section>
  );
}

function CashOnDelivery({
  storeId,
  cod,
  currency,
  canManage,
}: {
  storeId: string;
  cod: StoreGatewaysOverview['cod'];
  currency: string;
  canManage: boolean;
}) {
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Cash on delivery</h3>
        <Badge tone={cod.enabled ? 'green' : 'gray'}>{cod.enabled ? 'On' : 'Off'}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Shoppers can pay in cash when the order arrives, alongside any gateway. Orders are confirmed
        straight away, and you mark the cash received on each order. It needs no account or keys.
      </p>
      {canManage ? (
        <ActionForm
          action={saveCodAction.bind(null, storeId, currency)}
          className="mt-4 flex flex-wrap items-end gap-4"
        >
          <CheckboxField
            name="enabled"
            label="Offer cash on delivery"
            defaultChecked={cod.enabled}
          />
          <div className="w-56">
            <Field
              name="maxAmount"
              label={`Largest order (${currency})`}
              inputMode="decimal"
              placeholder="No limit"
              defaultValue={
                cod.maxAmount === null ? '' : minorToDecimalString(cod.maxAmount, currency)
              }
            />
          </div>
          <SubmitButton variant="secondary">Save</SubmitButton>
        </ActionForm>
      ) : null}
    </section>
  );
}

/** Gateways the merchant connects with their own API keys; money settles in their own account. */
export function StoreGateways({
  storeId,
  overview,
  currency,
  canManage,
}: {
  storeId: string;
  overview: StoreGatewaysOverview;
  currency: string;
  canManage: boolean;
}) {
  return (
    <Card
      title="Ways to get paid"
      description="Connect your own gateway account with your API keys. Money goes straight to that account and no platform fee is added. Add as many as you like, and choose one for checkout."
    >
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {STORE_GATEWAYS.map((info) => (
          <GatewayCard
            key={info.id}
            storeId={storeId}
            info={info}
            connected={overview.connected.find((c) => c.id === info.id)}
            webhookUrl={overview.webhookUrls[info.id]}
            currency={currency}
            canManage={canManage}
          />
        ))}
      </div>
      <CashOnDelivery
        storeId={storeId}
        cod={overview.cod}
        currency={currency}
        canManage={canManage}
      />
      {canManage ? null : (
        <p className="mt-4 text-sm text-slate-500">Only the store owner can change gateways.</p>
      )}
    </Card>
  );
}

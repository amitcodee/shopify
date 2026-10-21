import {
  API_TOKEN_PERMISSIONS,
  type ApiToken,
  type Webhook,
  WEBHOOK_HEADERS,
  WEBHOOK_TOPICS,
  type WebhookDelivery,
} from '@repo/contracts';
import { ActionForm, Field, SelectField, SubmitButton } from '@/components/form';
import { Badge, Card, EmptyState, formatDateTime, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { SmallAction } from '../small-action';
import {
  createTokenAction,
  createWebhookAction,
  deleteWebhookAction,
  enableWebhookAction,
  revokeTokenAction,
} from './actions';

export default async function DeveloperSettings({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store.permissions.includes('settings:write')) {
    return (
      <EmptyState
        title="Developer settings"
        description="Ask a store owner or admin for access to API tokens and webhooks."
      />
    );
  }
  const base = `/admin/stores/${storeId}`;
  const [tokens, hooks] = await Promise.all([
    api<ApiToken[]>(`${base}/api-tokens`),
    api<Webhook[]>(`${base}/webhooks`),
  ]);
  const deliveries = await Promise.all(
    hooks.map((h) => api<WebhookDelivery[]>(`${base}/webhooks/${h.id}/deliveries`)),
  );
  const grantable = API_TOKEN_PERMISSIONS.filter((p) => store.permissions.includes(p));

  return (
    <div className="space-y-6">
      <Card
        title="Admin API access tokens"
        description={`For integrations and scripts: send "Authorization: Bearer <token>" to /api/v1/admin/stores/${storeId}/…. A token acts with the permissions you choose, never more than yours.`}
      >
        {tokens.length > 0 ? (
          <Table head={['Name', 'Token', 'Permissions', 'Last used', '']}>
            {tokens.map((t) => (
              <tr key={t.id}>
                <Td>
                  {t.name}
                  <p className="text-xs text-slate-500">by {t.createdBy}</p>
                </Td>
                <Td className="font-mono text-xs">{t.prefix}…</Td>
                <Td className="text-xs">{t.permissions.join(', ')}</Td>
                <Td>{t.lastUsedAt ? formatDateTime(t.lastUsedAt) : 'Never'}</Td>
                <Td>
                  {t.revokedAt ? (
                    <Badge tone="gray">revoked</Badge>
                  ) : (
                    <SmallAction
                      action={revokeTokenAction.bind(null, storeId, t.id)}
                      label="Revoke"
                      danger
                    />
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        ) : null}
        <ActionForm action={createTokenAction.bind(null, storeId)} className="mt-4 space-y-3">
          <Field name="name" label="Token name" required maxLength={100} />
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Permissions</legend>
            <div className="grid gap-1 sm:grid-cols-3">
              {grantable.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={p}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {p}
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton variant="secondary">Create token</SubmitButton>
        </ActionForm>
      </Card>

      <Card
        title="Webhooks"
        description={`We POST JSON to your URL when an event happens. Verify the "${WEBHOOK_HEADERS.signature}" header: base64 HMAC-SHA256 of the raw body with the webhook's secret. Failed deliveries are retried for about a day.`}
      >
        {hooks.length > 0 ? (
          <div className="space-y-4">
            {hooks.map((h, i) => (
              <div key={h.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-sm">{h.topic}</span>{' '}
                    {h.disabled ? <Badge tone="red">disabled after failures</Badge> : null}
                    <p className="break-all text-xs text-slate-500">{h.url}</p>
                  </div>
                  <div className="flex gap-4">
                    {h.disabled ? (
                      <SmallAction
                        action={enableWebhookAction.bind(null, storeId, h.id)}
                        label="Enable"
                      />
                    ) : null}
                    <SmallAction
                      action={deleteWebhookAction.bind(null, storeId, h.id)}
                      label="Delete"
                      danger
                    />
                  </div>
                </div>
                {deliveries[i]?.length ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                    {deliveries[i].slice(0, 5).map((d) => (
                      <li key={d.id}>
                        {formatDateTime(d.createdAt)} ·{' '}
                        <span
                          className={
                            d.status === 'SUCCEEDED'
                              ? 'text-emerald-700'
                              : d.status === 'FAILED'
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }
                        >
                          {d.status.toLowerCase()}
                        </span>
                        {d.attempts > 1 ? ` after ${d.attempts} attempts` : ''}
                        {d.lastError ? ` · ${d.lastError}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">No deliveries yet.</p>
                )}
              </div>
            ))}
          </div>
        ) : null}
        <ActionForm action={createWebhookAction.bind(null, storeId)} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
            <SelectField
              name="topic"
              label="Event"
              options={WEBHOOK_TOPICS.map((t) => ({ value: t, label: t }))}
            />
            <Field
              name="url"
              label="URL"
              type="url"
              required
              placeholder="https://example.com/hooks"
            />
          </div>
          <SubmitButton variant="secondary">Add webhook</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

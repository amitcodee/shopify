import type { Domain } from '@repo/contracts';
import { ActionForm, Field, SubmitButton } from '@/components/form';
import { Badge, Card, EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { addDomainAction, domainAction } from '../commerce-actions';
import { SmallAction } from '../small-action';

const storefrontPattern = process.env.STOREFRONT_PUBLIC_URL ?? 'http://{subdomain}.localhost:3200';

export default async function DomainsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, domains] = await Promise.all([
    getStore(storeId),
    api<Domain[]>(`/admin/stores/${storeId}/domains`),
  ]);
  const canEdit = store.permissions.includes('settings:write');

  return (
    <div className="space-y-6">
      <Card title="Store address" description="Always available, even with custom domains.">
        <p className="font-mono text-sm">
          {storefrontPattern.replace('{subdomain}', store.subdomain)}
        </p>
      </Card>

      <Card
        title="Custom domains"
        description="Use your own domain. Ownership is verified with a DNS TXT record."
      >
        {domains.length === 0 ? (
          <EmptyState title="No custom domains" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {domains.map((d) => (
              <li key={d.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.hostname}</span>
                    {d.verified ? (
                      <Badge tone="green">Verified</Badge>
                    ) : (
                      <Badge tone="yellow">Pending verification</Badge>
                    )}
                    {d.isPrimary ? <Badge tone="indigo">Primary</Badge> : null}
                  </div>
                  {canEdit ? (
                    <div className="flex gap-4">
                      {!d.verified ? (
                        <SmallAction
                          action={domainAction.bind(null, storeId, d.id, 'verify')}
                          label="Verify"
                        />
                      ) : null}
                      {d.verified && !d.isPrimary ? (
                        <SmallAction
                          action={domainAction.bind(null, storeId, d.id, 'primary')}
                          label="Make primary"
                        />
                      ) : null}
                      <SmallAction
                        action={domainAction.bind(null, storeId, d.id, 'remove')}
                        label="Remove"
                        danger
                      />
                    </div>
                  ) : null}
                </div>
                {!d.verified ? (
                  <div className="overflow-x-auto rounded-md bg-slate-50 p-3 text-xs">
                    <p className="mb-2 text-slate-600">Add these records at your DNS provider:</p>
                    <table className="font-mono">
                      <tbody>
                        {[d.verificationRecord, d.routingRecord].map((r) => (
                          <tr key={r.type}>
                            <td className="pr-4 font-semibold">{r.type}</td>
                            <td className="pr-4">{r.name}</td>
                            <td className="break-all">{r.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <ActionForm
              action={addDomainAction.bind(null, storeId)}
              className="flex max-w-xl flex-wrap items-end gap-3"
            >
              <div className="flex-1">
                <Field name="hostname" label="Domain" placeholder="shop.example.com" required />
              </div>
              <SubmitButton variant="secondary">Add domain</SubmitButton>
            </ActionForm>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

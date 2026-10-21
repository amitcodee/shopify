import type { Policy } from '@repo/contracts';
import { ActionForm, SubmitButton, TextAreaField } from '@/components/form';
import { Card, formatDateTime } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { savePolicyAction } from '../actions';

export default async function PoliciesPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, policies] = await Promise.all([
    getStore(storeId),
    api<Policy[]>(`/admin/stores/${storeId}/policies`),
  ]);
  const canWrite = store.permissions.includes('themes:write');

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Published policies are linked from your storefront footer and checkout. Leave a policy empty
        to remove it.
      </p>
      {policies.map((policy) => (
        <Card
          key={policy.kind}
          title={policy.title}
          description={
            policy.updatedAt
              ? `Live at /policies/${policy.kind} · updated ${formatDateTime(policy.updatedAt)}`
              : 'Not published'
          }
        >
          <ActionForm
            action={savePolicyAction.bind(null, storeId, policy.kind)}
            className="space-y-3"
          >
            <fieldset disabled={!canWrite}>
              <TextAreaField
                name="body"
                label={policy.title}
                defaultValue={policy.body}
                rows={8}
                maxLength={50000}
              />
            </fieldset>
            {canWrite ? <SubmitButton variant="secondary">Save</SubmitButton> : null}
          </ActionForm>
        </Card>
      ))}
    </div>
  );
}

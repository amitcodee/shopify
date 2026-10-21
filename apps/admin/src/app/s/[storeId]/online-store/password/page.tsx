import type { StorefrontAccess } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton, TextAreaField } from '@/components/form';
import { Card } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { saveStorefrontAccessAction } from '../actions';

export default async function PasswordPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const [store, access] = await Promise.all([
    getStore(storeId),
    api<StorefrontAccess>(`/admin/stores/${storeId}/storefront-access`),
  ]);
  const canWrite = store.permissions.includes('themes:write');
  return (
    <Card
      title="Password protection"
      description="Hide your storefront behind a password while you get ready to launch. Order status and invoice links keep working."
    >
      <ActionForm
        action={saveStorefrontAccessAction.bind(null, storeId)}
        className="max-w-xl space-y-4"
      >
        <fieldset disabled={!canWrite} className="space-y-4">
          <CheckboxField
            name="enabled"
            label="Require a password to visit the storefront"
            defaultChecked={access.enabled}
          />
          <Field
            name="password"
            label="Password"
            defaultValue={access.password}
            hint="Share it with people who may preview the store. Changing it signs everyone out."
            maxLength={100}
          />
          <TextAreaField
            name="message"
            label="Message for visitors"
            defaultValue={access.message}
            rows={3}
            maxLength={500}
          />
        </fieldset>
        {canWrite ? <SubmitButton>Save</SubmitButton> : null}
      </ActionForm>
    </Card>
  );
}

import { SUPPORTED_CURRENCIES } from '@repo/contracts';
import { ActionForm, Field, SelectField, SubmitButton } from '@/components/form';
import { Card } from '@/components/ui';
import { getStore } from '@/lib/session';
import { updateStoreAction } from './actions';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default async function GeneralSettings({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  const canEdit = store.permissions.includes('settings:write');

  return (
    <Card title="Store details" description="Shown to customers on your storefront and emails.">
      <ActionForm action={updateStoreAction.bind(null, store.id)} className="max-w-xl space-y-4">
        <fieldset disabled={!canEdit} className="space-y-4">
          <Field
            name="name"
            label="Store name"
            defaultValue={store.name}
            required
            maxLength={100}
          />
          <Field
            name="contactEmail"
            label="Contact email"
            type="email"
            defaultValue={store.contactEmail}
            required
          />
          <SelectField
            name="currency"
            label="Currency"
            defaultValue={store.currency}
            options={SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }))}
            hint="Changing currency does not convert existing prices."
          />
          <SelectField
            name="timezone"
            label="Time zone"
            defaultValue={store.timezone}
            options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
          />
        </fieldset>
        {canEdit ? <SubmitButton>Save changes</SubmitButton> : null}
      </ActionForm>
    </Card>
  );
}

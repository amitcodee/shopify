import type { PlatformSettings } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton } from '@/components/form';
import { Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { savePlatformSettingsAction } from '../actions';

export default async function PlatformSettingsPage() {
  const [user, settings] = await Promise.all([
    getCurrentUser(),
    api<PlatformSettings>('/platform/settings'),
  ]);
  const canEdit = user.platformRole === 'SUPER_ADMIN';
  return (
    <>
      <PageHeader title="Platform settings" />
      <Card>
        <ActionForm action={savePlatformSettingsAction} className="max-w-xl space-y-4">
          <fieldset disabled={!canEdit} className="space-y-4">
            <CheckboxField
              name="signupsEnabled"
              label="Allow new merchant sign-ups"
              defaultChecked={settings.signupsEnabled}
              hint="Existing merchants and staff invitations are unaffected."
            />
            <Field
              name="supportEmail"
              label="Support email"
              type="email"
              required
              defaultValue={settings.supportEmail}
            />
            <Field
              name="adminNotice"
              label="Notice shown to all merchants"
              defaultValue={settings.adminNotice}
              maxLength={300}
              hint="For maintenance windows or announcements. Leave empty to hide."
            />
          </fieldset>
          {canEdit ? <SubmitButton>Save settings</SubmitButton> : null}
        </ActionForm>
      </Card>
    </>
  );
}

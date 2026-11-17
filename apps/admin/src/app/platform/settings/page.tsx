import type { PlatformSettings } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton, TextAreaField } from '@/components/form';
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
          <fieldset disabled={!canEdit} className="space-y-4 border-t border-gray-200 pt-5">
            <legend className="text-sm font-semibold text-gray-900">Business details</legend>
            <p className="text-sm text-gray-600">
              Shown on the public legal, contact and footer pages. Indian law (IT Rules 2021,
              Consumer Protection E-Commerce Rules 2020) and payment providers expect your legal
              name, address and a Grievance Officer. Empty fields stay hidden.
            </p>
            <Field
              name="legalName"
              label="Legal entity name"
              defaultValue={settings.legalName}
              maxLength={200}
              hint="For example: Example Commerce Private Limited"
            />
            <TextAreaField
              name="registeredAddress"
              label="Registered address"
              defaultValue={settings.registeredAddress}
              maxLength={500}
              rows={3}
            />
            <Field name="gstin" label="GSTIN" defaultValue={settings.gstin} maxLength={15} />
            <Field
              name="supportPhone"
              label="Support phone"
              type="tel"
              defaultValue={settings.supportPhone}
              maxLength={30}
            />
            <Field
              name="grievanceOfficerName"
              label="Grievance Officer name"
              defaultValue={settings.grievanceOfficerName}
              maxLength={120}
            />
            <Field
              name="grievanceOfficerEmail"
              label="Grievance Officer email"
              type="email"
              defaultValue={settings.grievanceOfficerEmail}
            />
          </fieldset>
          {canEdit ? <SubmitButton>Save settings</SubmitButton> : null}
        </ActionForm>
      </Card>
    </>
  );
}

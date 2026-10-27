import type { Supplier } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton, TextAreaField } from '@/components/form';
import type { FormState } from '@/lib/form';

export function SupplierForm({
  supplier,
  action,
  disabled,
}: {
  supplier: Supplier | null;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  disabled: boolean;
}) {
  return (
    <ActionForm action={action}>
      <fieldset disabled={disabled} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="name"
            label="Company name"
            defaultValue={supplier?.name}
            required
            maxLength={100}
          />
          <Field
            name="contactName"
            label="Contact person"
            defaultValue={supplier?.contactName}
            maxLength={100}
          />
          <Field
            name="email"
            label="Email"
            type="email"
            defaultValue={supplier?.email}
            maxLength={254}
          />
          <Field
            name="phone"
            label="Phone"
            type="tel"
            defaultValue={supplier?.phone}
            maxLength={40}
          />
          <Field
            name="website"
            label="Website"
            type="url"
            placeholder="https://"
            defaultValue={supplier?.website}
            maxLength={2048}
          />
          <Field
            name="leadTimeDays"
            label="Lead time (days)"
            type="number"
            min={0}
            max={365}
            defaultValue={supplier?.leadTimeDays ?? ''}
            hint="Typical days from ordering to delivery. Fills in the expected date."
          />
        </div>
        <TextAreaField
          name="address"
          label="Address"
          rows={2}
          defaultValue={supplier?.address}
          maxLength={500}
        />
        <TextAreaField
          name="notes"
          label="Notes"
          rows={3}
          defaultValue={supplier?.notes}
          maxLength={2000}
          hint="Payment terms, minimum order, account number… Only staff see this."
        />
        <CheckboxField
          name="active"
          label="Active"
          defaultChecked={supplier?.active ?? true}
          hint="Inactive suppliers are hidden when creating purchase orders and editing products."
        />
      </fieldset>
      {disabled ? null : <SubmitButton>{supplier ? 'Save supplier' : 'Add supplier'}</SubmitButton>}
    </ActionForm>
  );
}

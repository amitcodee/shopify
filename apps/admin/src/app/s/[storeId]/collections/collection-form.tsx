import type { Collection } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton, TextAreaField } from '@/components/form';
import type { FormState } from '@/lib/form';

export function CollectionForm({
  collection,
  action,
  canWrite,
}: {
  collection: Collection | null;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  canWrite: boolean;
}) {
  return (
    <ActionForm action={action} className="max-w-xl space-y-4">
      <fieldset disabled={!canWrite} className="space-y-4">
        <Field
          name="title"
          label="Title"
          defaultValue={collection?.title}
          required
          maxLength={200}
        />
        <TextAreaField
          name="description"
          label="Description"
          defaultValue={collection?.description ?? ''}
          rows={3}
        />
        <Field
          name="handle"
          label="URL handle"
          defaultValue={collection?.handle}
          hint="Leave empty to generate from the title."
        />
        <Field
          name="ruleTag"
          label="Automated: include products tagged"
          defaultValue={collection?.ruleTag}
          hint="Leave empty for a manual collection where you pick products."
        />
        <CheckboxField
          name="published"
          label="Visible on storefront"
          defaultChecked={collection?.published ?? true}
        />
      </fieldset>
      {canWrite ? (
        <SubmitButton>{collection ? 'Save collection' : 'Create collection'}</SubmitButton>
      ) : null}
    </ActionForm>
  );
}

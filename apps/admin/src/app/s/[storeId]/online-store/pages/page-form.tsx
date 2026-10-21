import type { Page } from '@repo/contracts';
import { ActionForm, CheckboxField, Field, SubmitButton, TextAreaField } from '@/components/form';
import type { FormState } from '@/lib/form';

export function PageForm({
  page,
  action,
  canWrite,
}: {
  page: Page | null;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  canWrite: boolean;
}) {
  return (
    <ActionForm action={action} className="max-w-2xl space-y-4">
      <fieldset disabled={!canWrite} className="space-y-4">
        <Field name="title" label="Title" defaultValue={page?.title} required maxLength={200} />
        <TextAreaField
          name="body"
          label="Content"
          defaultValue={page?.body ?? ''}
          rows={14}
          maxLength={50000}
          hint="Plain text. Leave a blank line between paragraphs."
        />
        <Field
          name="handle"
          label="URL handle"
          defaultValue={page?.handle}
          hint="Shown at /pages/<handle>. Leave empty to generate from the title."
        />
        <CheckboxField
          name="published"
          label="Visible on storefront"
          defaultChecked={page?.published ?? true}
        />
      </fieldset>
      {canWrite ? <SubmitButton>{page ? 'Save page' : 'Create page'}</SubmitButton> : null}
    </ActionForm>
  );
}

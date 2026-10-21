import type { BlogPost } from '@repo/contracts';
import { ActionForm, Field, SelectField, SubmitButton, TextAreaField } from '@/components/form';
import type { FormState } from '@/lib/form';

/** "2026-05-01T09:30" in the datetime-local format (UTC). */
const localValue = (iso: string | null) => (iso ? iso.slice(0, 16) : '');

export function PostForm({
  post,
  action,
  canWrite,
}: {
  post: BlogPost | null;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  canWrite: boolean;
}) {
  return (
    <ActionForm action={action} className="max-w-2xl space-y-4">
      <fieldset disabled={!canWrite} className="space-y-4">
        <Field name="title" label="Title" defaultValue={post?.title} required maxLength={200} />
        <TextAreaField
          name="excerpt"
          label="Excerpt"
          defaultValue={post?.excerpt ?? ''}
          rows={2}
          maxLength={500}
          hint="Shown in the blog list."
        />
        <TextAreaField
          name="body"
          label="Content"
          defaultValue={post?.body ?? ''}
          rows={14}
          maxLength={50000}
          hint="Plain text. Leave a blank line between paragraphs."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="author" label="Author" defaultValue={post?.author} maxLength={100} />
          <Field
            name="tags"
            label="Tags"
            defaultValue={post?.tags.join(', ')}
            hint="Comma separated."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="visibility"
            label="Visibility"
            defaultValue={post?.publishedAt ? 'published' : 'draft'}
            options={[
              { value: 'draft', label: 'Draft (hidden)' },
              { value: 'published', label: 'Published' },
            ]}
          />
          <Field
            name="publishedAt"
            label="Publish date (UTC)"
            type="datetime-local"
            defaultValue={localValue(post?.publishedAt ?? null)}
            hint="Empty means now. A future date schedules the post."
          />
        </div>
        <Field
          name="handle"
          label="URL handle"
          defaultValue={post?.handle}
          hint="The post's address under /blog. Leave empty to generate from the title."
        />
      </fieldset>
      {canWrite ? <SubmitButton>{post ? 'Save post' : 'Create post'}</SubmitButton> : null}
    </ActionForm>
  );
}

'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/form';
import { Alert } from '@/components/ui';
import type { ImportState } from './actions';

export function ImportForm({
  action,
}: {
  action: (state: ImportState, formData: FormData) => Promise<ImportState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const result = state?.result;
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {result ? (
        <div className="space-y-3">
          <Alert tone={result.errors.length ? 'info' : 'success'}>
            Created {result.created.length} product{result.created.length === 1 ? '' : 's'}
            {result.skipped.length ? `, skipped ${result.skipped.length} existing` : ''}
            {result.errors.length ? `, ${result.errors.length} problem(s) below` : ''}.
          </Alert>
          {result.errors.length ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {result.errors.map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          ) : null}
          {result.skipped.length ? (
            <p className="text-sm text-slate-600">
              Skipped (handle already exists): {result.skipped.map((s) => s.handle).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-1">
        <label htmlFor="csv-file" className="block text-sm font-medium text-slate-700">
          CSV file
        </label>
        <input
          id="csv-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="block text-sm"
        />
      </div>
      <SubmitButton>Import products</SubmitButton>
    </form>
  );
}

import { ApiError } from './api';

/** State returned by server actions to forms rendered with <ActionForm>. */
export type FormState =
  | {
      error?: string;
      success?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
      /** Sign-in challenge when the account has two-factor authentication. */
      mfaToken?: string;
      /** Two-factor enrolment details to show once. */
      totpSetup?: { secret: string; otpauthUrl: string };
    }
  | undefined;

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !/password/i.test(key)) values[key] = value;
  }
  return values;
}

/** Maps an API error (problem+json) to form state; rethrows anything unexpected. */
export function toFormState(error: unknown, formData?: FormData): FormState {
  if (!(error instanceof ApiError)) throw error;
  const fieldErrors: Record<string, string> = {};
  for (const item of error.problem.errors ?? []) {
    const key = item.path || '_';
    fieldErrors[key] ??= item.message;
  }
  return {
    error: error.problem.errors?.length ? 'Please fix the highlighted fields.' : error.message,
    fieldErrors,
    values: formData ? formValues(formData) : undefined,
  };
}

/** Reads optional string fields, dropping empty ones. */
export function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

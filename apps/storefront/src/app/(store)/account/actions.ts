'use server';

// These actions return { redirectTo } and the browser performs a full navigation, which also
// refreshes the header (account/cart state); see FollowRedirect.

import type { CustomerRegisterResult, CustomerSession } from '@repo/contracts';
import type { FormResult } from '@/components/form';
import { sf, StorefrontApiError } from '@/lib/api';
import { setCustomerToken } from '@/lib/shop';

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function toResult(error: unknown): FormResult {
  if (!(error instanceof StorefrontApiError)) throw error;
  const fieldErrors: Record<string, string> = {};
  for (const e of error.problem.errors ?? []) fieldErrors[e.path] ??= e.message;
  return {
    error: error.problem.errors?.length ? 'Please check the highlighted fields.' : error.message,
    fieldErrors,
  };
}

export async function loginAction(_: FormResult, formData: FormData): Promise<FormResult> {
  try {
    const session = await sf<CustomerSession>('/customers/login', {
      method: 'POST',
      body: { email: str(formData, 'email'), password: str(formData, 'password') },
    });
    await setCustomerToken(session.token, session.expiresAt);
  } catch (error) {
    return toResult(error);
  }
  return { redirectTo: '/account' };
}

export async function registerAction(_: FormResult, formData: FormData): Promise<FormResult> {
  let result: CustomerRegisterResult;
  try {
    result = await sf<CustomerRegisterResult>('/customers/register', {
      method: 'POST',
      body: {
        name: str(formData, 'name'),
        email: str(formData, 'email'),
        password: str(formData, 'password'),
        acceptsMarketing: formData.get('acceptsMarketing') === 'on',
      },
    });
  } catch (error) {
    return toResult(error);
  }
  if (result.status === 'activation_sent') {
    return {
      success:
        'We found your previous orders. Check your email for a link to activate your account.',
    };
  }
  await setCustomerToken(result.session.token, result.session.expiresAt);
  return { redirectTo: '/account' };
}

export async function forgotPasswordAction(_: FormResult, formData: FormData): Promise<FormResult> {
  try {
    await sf('/customers/password-reset', {
      method: 'POST',
      body: { email: str(formData, 'email') },
    });
  } catch (error) {
    return toResult(error);
  }
  return { success: 'If an account exists for that email, a reset link is on its way.' };
}

export async function completeLinkAction(
  purpose: 'activate' | 'reset',
  token: string,
  _: FormResult,
  formData: FormData,
): Promise<FormResult> {
  try {
    const session = await sf<CustomerSession>(`/customers/${purpose}`, {
      method: 'POST',
      body: { token, password: str(formData, 'password') },
    });
    await setCustomerToken(session.token, session.expiresAt);
  } catch (error) {
    return toResult(error);
  }
  return { redirectTo: '/account' };
}

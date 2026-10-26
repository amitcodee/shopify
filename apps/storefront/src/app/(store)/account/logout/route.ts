import { NextResponse } from 'next/server';
import { sf, StorefrontApiError } from '@/lib/api';
import { CUSTOMER_COOKIE, getCustomerToken } from '@/lib/shop';

/** Signs the customer out (revokes the session server-side) and returns to the home page. */
export async function POST(): Promise<NextResponse> {
  try {
    await sf('/customers/logout', { method: 'POST', customerToken: await getCustomerToken() });
  } catch (error) {
    if (!(error instanceof StorefrontApiError)) throw error;
  }
  const response = new NextResponse(null, { status: 303, headers: { Location: '/' } });
  response.cookies.delete(CUSTOMER_COOKIE);
  return response;
}

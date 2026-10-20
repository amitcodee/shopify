import type { ProviderLink } from '@repo/contracts';
import { type NextRequest, NextResponse } from 'next/server';
import { api, ApiError } from '@/lib/api';

/**
 * Continues payments onboarding with a fresh single-use link. Also the provider's `refresh_url`,
 * which it opens when a link has expired or was already used.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  try {
    const link = await api<ProviderLink>(
      `/admin/stores/${encodeURIComponent(storeId)}/payments/account/onboarding-link`,
      { method: 'POST' },
    );
    return NextResponse.redirect(link.url);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return NextResponse.redirect(new URL(`/s/${storeId}/settings/payments`, request.url));
  }
}

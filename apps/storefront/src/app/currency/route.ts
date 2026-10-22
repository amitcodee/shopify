import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { CURRENCY_COOKIE } from '@/lib/api';
import { safeRelativePath } from '@repo/contracts';

/** Currency switcher (a plain GET form): remembers the choice and returns to the page. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code')?.toUpperCase() ?? '';
  if (/^[A-Z]{3}$/.test(code)) {
    (await cookies()).set(CURRENCY_COOKIE, code, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  redirect(safeRelativePath(url.searchParams.get('return'), '/'));
}

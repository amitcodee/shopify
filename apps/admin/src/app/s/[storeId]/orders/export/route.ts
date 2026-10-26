import { api } from '@/lib/api';
import { ORDER_VIEWS } from '../views';

/** Downloads the orders in the current view and search as CSV. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
): Promise<Response> {
  const { storeId } = await params;
  const search = new URL(request.url).searchParams;
  const view = ORDER_VIEWS.find((v) => v.key === search.get('view')) ?? ORDER_VIEWS[0];
  const { filename, csv } = await api<{ filename: string; csv: string }>(
    `/admin/stores/${storeId}/orders/export`,
    { query: { ...view.query, q: search.get('q') ?? undefined } },
  );
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

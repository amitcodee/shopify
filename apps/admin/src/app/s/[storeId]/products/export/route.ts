import { api } from '@/lib/api';

/** Downloads the store's products as a Shopify-style CSV (one row per variant). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> },
): Promise<Response> {
  const { storeId } = await params;
  const { filename, csv } = await api<{ filename: string; csv: string }>(
    `/admin/stores/${storeId}/product-csv/export`,
  );
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

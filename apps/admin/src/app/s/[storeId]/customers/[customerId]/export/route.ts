import { api } from '@/lib/api';

/** Downloads everything the store holds about a customer (data-subject access request). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string; customerId: string }> },
): Promise<Response> {
  const { storeId, customerId } = await params;
  const data = await api<unknown>(`/admin/stores/${storeId}/customers/${customerId}/export`);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="customer-${customerId}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}

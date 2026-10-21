import { api } from '@/lib/api';

/** Downloads the segment's customers as CSV (the API records the export in the audit log). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string; segmentId: string }> },
): Promise<Response> {
  const { storeId, segmentId } = await params;
  const { filename, csv } = await api<{ filename: string; csv: string }>(
    `/admin/stores/${storeId}/segments/${segmentId}/export`,
  );
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

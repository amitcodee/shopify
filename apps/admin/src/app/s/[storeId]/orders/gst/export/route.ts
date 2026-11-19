import { GSTR1_SECTIONS, type Gstr1Report, gstr1Csv } from '@repo/contracts';
import { api } from '@/lib/api';

/** Downloads one GSTR-1 table for a month as CSV (GST Offline Tool layout). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
): Promise<Response> {
  const { storeId } = await params;
  const search = new URL(request.url).searchParams;
  const section = GSTR1_SECTIONS.find((s) => s.key === search.get('section'));
  if (!section) return new Response('Unknown section', { status: 400 });
  const month = search.get('month') ?? undefined;
  const report = await api<Gstr1Report>(`/admin/stores/${storeId}/gst-returns/gstr1`, {
    query: { month },
  });
  return new Response(gstr1Csv(report, section.key), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gstr1-${report.month}-${section.key}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

import { GSTR1_SECTIONS, type Gstr1Report, gstr1Csv, gstr1Json } from '@repo/contracts';
import { api } from '@/lib/api';

/** Downloads a month's GSTR-1: one table as CSV (offline tool layout), or the portal JSON. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
): Promise<Response> {
  const { storeId } = await params;
  const search = new URL(request.url).searchParams;
  const month = search.get('month') ?? undefined;
  const load = () =>
    api<Gstr1Report>(`/admin/stores/${storeId}/gst-returns/gstr1`, { query: { month } });
  if (search.get('format') === 'json') {
    const report = await load();
    return new Response(JSON.stringify(gstr1Json(report)), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="gstr1-${report.month}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  const section = GSTR1_SECTIONS.find((s) => s.key === search.get('section'));
  if (!section) return new Response('Unknown section', { status: 400 });
  const report = await load();
  return new Response(gstr1Csv(report, section.key), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gstr1-${report.month}-${section.key}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

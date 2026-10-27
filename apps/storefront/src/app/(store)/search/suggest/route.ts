import { formatMoney, type ProductCardPage } from '@repo/contracts';
import { NextResponse } from 'next/server';
import { sf } from '@/lib/api';
import { getShop } from '@/lib/shop';

export interface Suggestion {
  title: string;
  href: string;
  price: string;
  imageUrl: string | null;
  available: boolean;
}

/**
 * Search-as-you-type for the header search box: up to five products matching `q`. The API is
 * only reachable from this server (requests are signed with the shopper's host), so the browser
 * asks here. Any failure answers with an empty list; the full search page still works.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ items: [] });
  try {
    const shop = await getShop();
    if (!shop || shop.locked) return NextResponse.json({ items: [] });
    const page = await sf<ProductCardPage>('/products', { query: { q, pageSize: 5 } });
    const items: Suggestion[] = page.items.map((p) => ({
      title: p.title,
      href: `/products/${p.handle}`,
      price:
        p.maxPrice !== p.minPrice
          ? `From ${formatMoney(p.minPrice, shop.currency)}`
          : formatMoney(p.minPrice, shop.currency),
      imageUrl: p.imageRenditions?.[0]?.url ?? p.imageUrl,
      available: p.available,
    }));
    return NextResponse.json(
      { items, total: page.total },
      { headers: { 'cache-control': 'private, max-age=30' } },
    );
  } catch {
    return NextResponse.json({ items: [] });
  }
}

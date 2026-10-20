import type { ProductCardPage, Shop } from '@repo/contracts';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { sf } from '@/lib/api';
import { getShop } from '@/lib/shop';

function Hero({ shop }: { shop: Shop }) {
  const { preset, settings } = shop.theme;
  const title = settings.heroTitle || shop.name;
  const subtitle = settings.heroSubtitle || 'Discover our latest products.';
  const cta = (
    <Link
      href="/collections/all"
      className="mt-6 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-[var(--store-accent-contrast)] hover:opacity-90"
    >
      Shop now
    </Link>
  );

  if (preset === 'bold') {
    return (
      <section className="mb-12 rounded-2xl bg-brand px-8 py-20 text-brand-contrast">
        <h1 className="text-5xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-4 max-w-xl text-lg opacity-90">{subtitle}</p>
        {cta}
      </section>
    );
  }
  if (preset === 'classic') {
    return (
      <section className="mb-12 border-y border-zinc-200 py-16 text-center">
        <h1 className="text-4xl tracking-tight text-brand">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-600">{subtitle}</p>
        {cta}
      </section>
    );
  }
  return (
    <section className="mb-12 rounded-2xl bg-zinc-50 px-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-brand">{title}</h1>
      <p className="mt-3 max-w-xl text-lg text-zinc-600">{subtitle}</p>
      {cta}
    </section>
  );
}

export default async function HomePage() {
  const shop = await getShop();
  if (!shop) return null;
  const latest = await sf<ProductCardPage>('/products', { query: { pageSize: 8 } });

  return (
    <>
      <Hero shop={shop} />

      {shop.collections.length > 0 ? (
        <section aria-labelledby="collections-heading" className="mb-12">
          <h2 id="collections-heading" className="mb-4 text-xl font-semibold">
            Collections
          </h2>
          <ul className="flex flex-wrap gap-3">
            {shop.collections.map((c) => (
              <li key={c.handle}>
                <Link
                  href={`/collections/${c.handle}`}
                  className="inline-block rounded-full border border-zinc-300 px-4 py-2 text-sm hover:border-zinc-900"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="latest-heading">
        <h2 id="latest-heading" className="mb-4 text-xl font-semibold">
          New in
        </h2>
        <ProductGrid products={latest.items} currency={shop.currency} />
      </section>
    </>
  );
}

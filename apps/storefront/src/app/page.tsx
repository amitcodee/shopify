import type { ProductCardPage, Shop } from '@repo/contracts';
import Link from 'next/link';
import { Icon } from '@/components/icons';
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
      className="group mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-contrast shadow-lg shadow-accent/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/30"
    >
      Shop now
      <Icon name="arrowRight" className="size-4 transition group-hover:translate-x-0.5" />
    </Link>
  );

  if (preset === 'bold') {
    return (
      <section className="relative mb-16 overflow-hidden rounded-3xl bg-brand px-8 py-20 text-brand-contrast sm:px-14 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-accent/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-brand-contrast/10 blur-3xl"
        />
        <div className="relative max-w-2xl">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed opacity-85">{subtitle}</p>
          {cta}
        </div>
      </section>
    );
  }
  if (preset === 'classic') {
    return (
      <section className="mb-16 border-y border-zinc-200 py-20 text-center sm:py-24">
        <p className="text-xs font-semibold tracking-[0.3em] text-zinc-500 uppercase">
          {shop.name}
        </p>
        <h1 className="mt-4 text-4xl tracking-tight text-brand sm:text-5xl">{title}</h1>
        <div aria-hidden className="mx-auto mt-6 h-px w-16 bg-accent" />
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">{subtitle}</p>
        {cta}
      </section>
    );
  }
  return (
    <section className="relative mb-16 overflow-hidden rounded-3xl bg-gradient-to-br from-brand/[0.07] via-white to-accent/[0.12] px-8 py-20 ring-1 ring-zinc-900/5 sm:px-14 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-10 size-72 rounded-full bg-accent/20 blur-3xl"
      />
      <div className="relative max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-brand sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-600">{subtitle}</p>
        {cta}
      </div>
    </section>
  );
}

function SectionHeading({ id, title, href }: { id: string; title: string; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 id={id} className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950"
        >
          View all
          <Icon name="arrowRight" className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
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
        <section aria-labelledby="collections-heading" className="mb-16">
          <SectionHeading id="collections-heading" title="Shop by collection" />
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {shop.collections.map((c, index) => (
              <li key={c.handle}>
                <Link
                  href={`/collections/${c.handle}`}
                  className={`group relative flex h-28 items-end overflow-hidden rounded-2xl p-5 ring-1 ring-zinc-900/5 transition hover:-translate-y-0.5 hover:shadow-lift sm:h-36 ${
                    index % 2 === 0 ? 'bg-brand/[0.06]' : 'bg-accent/[0.09]'
                  }`}
                >
                  <span className="relative text-base font-semibold tracking-tight text-zinc-900">
                    {c.title}
                  </span>
                  <span
                    aria-hidden
                    className="absolute top-4 right-4 grid size-8 place-items-center rounded-full bg-white text-zinc-700 shadow-sm transition group-hover:bg-brand group-hover:text-brand-contrast"
                  >
                    <Icon name="arrowRight" className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="latest-heading">
        <SectionHeading id="latest-heading" title="New in" href="/collections/all" />
        <ProductGrid products={latest.items} currency={shop.currency} />
      </section>
    </>
  );
}

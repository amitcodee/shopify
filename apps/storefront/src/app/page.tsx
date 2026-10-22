import type {
  Paginated,
  ProductCard,
  ProductCardPage,
  Shop,
  StorefrontBlogPost,
} from '@repo/contracts';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { BlogPosts } from '@/components/sections/blog-posts';
import { BrandStory } from '@/components/sections/brand-story';
import { CollectionCarousel } from '@/components/sections/collection-carousel';
import {
  type CollectionFeature,
  FeaturedCollections,
} from '@/components/sections/featured-collections';
import { NewsletterSection } from '@/components/sections/newsletter-section';
import { SectionHeader } from '@/components/sections/section-header';
import { TrustBar } from '@/components/sections/trust-bar';
import { sf, StorefrontApiError } from '@/lib/api';
import { getShop, getThemePreview } from '@/lib/shop';

interface HeroProps {
  shop: Shop;
  title: string;
  subtitle: string;
  /** A product photo the layout can feature (split and full-bleed heroes). */
  image: ProductCard | undefined;
}

function Cta({
  label,
  variant = 'btn-accent',
  className = 'mt-8',
}: {
  label: string;
  variant?: string;
  className?: string;
}) {
  return (
    <Link href="/collections/all" className={`btn ${variant} ${className} px-6 py-3 text-sm`}>
      {label}
    </Link>
  );
}

function Hero({ shop, title, subtitle, image }: HeroProps) {
  const { preset, settings } = shop.theme;
  const cta = settings.heroCta || 'Shop now';

  switch (preset) {
    case 'bold':
      return (
        <section className="store-section rounded-2xl bg-brand px-6 py-16 text-brand-contrast sm:px-12 sm:py-24">
          <div className="mb-8 h-1.5 w-16 rounded-full bg-accent" />
          <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-tight break-words sm:text-7xl">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-lg opacity-90">{subtitle}</p>
          <Cta label={cta} variant="btn-on-brand" />
        </section>
      );

    case 'classic':
      return (
        <section className="store-section border-y border-zinc-200 px-4 py-16 text-center sm:py-20">
          <h1 className="text-4xl tracking-tight text-brand break-words sm:text-5xl">{title}</h1>
          <div className="mx-auto mt-5 h-px w-16 bg-accent" />
          <p className="mx-auto mt-5 max-w-xl text-zinc-600">{subtitle}</p>
          <Cta label={cta} />
        </section>
      );

    case 'split':
      return (
        <section className="store-section grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <div className="order-2 md:order-1">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-brand break-words sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-lg text-zinc-600">{subtitle}</p>
            <Cta label={cta} />
          </div>
          <div className="order-1 aspect-[4/3] overflow-hidden rounded-2xl bg-surface md:order-2 md:aspect-[4/5]">
            {image?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_30%_30%,var(--store-accent),transparent_60%)] opacity-40" />
            )}
          </div>
        </section>
      );

    case 'fullbleed': {
      const photo = image?.imageUrl;
      return (
        <section
          className={`store-section relative -mt-[var(--store-main-y)] ml-[calc(50%-50vw)] w-screen overflow-hidden ${
            photo ? 'bg-[#111111] text-[#ffffff]' : 'bg-brand text-brand-contrast'
          }`}
        >
          {photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#000000b3] via-[#00000066] to-[#00000026]" />
            </>
          ) : null}
          <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-36">
            <h1 className="max-w-4xl text-5xl font-bold leading-[0.95] tracking-tight break-words sm:text-7xl lg:text-8xl">
              {title}
            </h1>
            <p className="mt-6 max-w-lg text-lg opacity-90">{subtitle}</p>
            <Cta label={cta} variant={photo ? 'btn-on-image' : 'btn-on-brand'} />
          </div>
        </section>
      );
    }

    case 'editorial': {
      const issue = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return (
        <section className="store-section border-t border-zinc-900 pt-4">
          <div className="eyebrow flex justify-between gap-4 text-zinc-600">
            <span>{issue}</span>
            <span className="hidden sm:inline">{shop.name}</span>
          </div>
          <h1 className="mt-10 max-w-5xl text-5xl font-normal leading-[1.05] tracking-tight text-brand break-words sm:mt-14 sm:text-7xl">
            {title}
          </h1>
          <div className="mt-10 grid gap-6 border-t border-zinc-300 pt-6 sm:mt-14 md:grid-cols-[2fr_1fr] md:items-end">
            <p className="max-w-xl text-lg leading-relaxed text-zinc-600">{subtitle}</p>
            <div className="md:text-right">
              <Cta label={cta} className="" />
            </div>
          </div>
        </section>
      );
    }

    case 'catalog':
      return (
        <section className="store-section flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-brand break-words sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
          </div>
          <Link href="/collections/all" className="btn px-4 py-2 text-sm">
            {cta}
          </Link>
        </section>
      );

    case 'banner':
      return (
        <section className="store-section rounded-2xl bg-[linear-gradient(135deg,var(--store-banner-from),var(--store-banner-to))] px-6 py-20 text-center text-[var(--store-banner-text)] sm:py-28">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight break-words sm:text-6xl">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg opacity-90">{subtitle}</p>
          <Cta label={cta} variant="btn-on-banner" />
        </section>
      );

    default:
      return (
        <section className="store-section rounded-2xl bg-surface px-6 py-14 sm:px-12 sm:py-20">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-brand break-words sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-zinc-600">{subtitle}</p>
          <Cta label={cta} />
        </section>
      );
  }
}

/** Image beside the brand story: left on these layouts, right on the rest. */
const STORY_IMAGE_FIRST = new Set(['split', 'classic', 'banner', 'catalog']);

/** Shown only while previewing a template, when the merchant has not written a story yet. */
const SAMPLE_STORY = {
  title: 'Made with care',
  text:
    'Use this space to tell shoppers who you are, what you make and why it matters.\n\n' +
    'Add your own story under Settings → Theme → Customize, and it will appear here.',
};

/** API errors (e.g. a collection removed meanwhile) hide a section; anything else is rethrown. */
function orNull<T>(error: unknown): T | null {
  if (error instanceof StorefrontApiError) return null;
  throw error;
}

export default async function HomePage() {
  const shop = await getShop();
  if (!shop) return null;
  const { preset, settings } = shop.theme;
  const pageSize = settings.gridColumns === 5 ? 10 : settings.gridColumns === 3 ? 9 : 8;
  // Collection cards use up to six collections; carousels the first three.
  const collections = shop.collections.slice(
    0,
    settings.showCollections ? 6 : settings.showCollectionCarousels ? 3 : 0,
  );
  const carousels = settings.showCollectionCarousels ? 3 : 0;
  const [latest, collectionPages, posts, preview] = await Promise.all([
    sf<ProductCardPage>('/products', { query: { pageSize } }),
    Promise.all(
      collections.map((c, i) =>
        sf<ProductCardPage>('/products', {
          query: { collection: c.handle, pageSize: i < carousels ? 12 : 1 },
        }).catch(orNull<ProductCardPage>),
      ),
    ),
    settings.showBlogPosts
      ? sf<Paginated<StorefrontBlogPost>>('/blog').then(
          (page) => page.items.slice(0, 3),
          (error: unknown) => orNull<StorefrontBlogPost[]>(error) ?? [],
        )
      : [],
    getThemePreview(),
  ]);
  // Whole rows on wide screens, once there are at least two of them to show.
  const rows = Math.floor(latest.items.length / settings.gridColumns);
  const products = rows >= 2 ? latest.items.slice(0, rows * settings.gridColumns) : latest.items;

  const features: CollectionFeature[] = collections.map((c, i) => {
    const page = collectionPages[i];
    return {
      ...c,
      total: page?.total ?? null,
      imageUrl: page?.items.find((p) => p.imageUrl)?.imageUrl ?? null,
    };
  });

  // The merchant's story; while previewing a template, sample copy stands in for a missing one.
  let story: { title: string; text: string } | null = null;
  if (settings.brandStoryTitle || settings.brandStoryText) {
    if (settings.showBrandStory)
      story = { title: settings.brandStoryTitle, text: settings.brandStoryText };
  } else if (preview) {
    story = SAMPLE_STORY;
  }
  const withImages = latest.items.filter((p) => p.imageUrl);
  const storyImage =
    withImages[2]?.secondImageUrl ?? withImages[2]?.imageUrl ?? withImages[0]?.imageUrl ?? null;

  return (
    <>
      <Hero
        shop={shop}
        title={settings.heroTitle || shop.name}
        subtitle={settings.heroSubtitle || 'Discover our latest products.'}
        image={latest.items.find((p) => p.imageUrl)}
      />

      {settings.showTrustBar ? <TrustBar theme={settings} /> : null}

      {settings.showCollections && features.length > 0 ? (
        <FeaturedCollections collections={features} dense={preset === 'catalog'} />
      ) : null}

      <section aria-labelledby="latest-heading" className="store-section">
        <SectionHeader
          id="latest-heading"
          title={settings.featuredTitle || 'New in'}
          eyebrow="Just landed"
          href="/collections/all"
        />
        <ProductGrid products={products} currency={shop.currency} theme={settings} />
      </section>

      {collections.slice(0, carousels).map((c, i) => {
        const items = collectionPages[i]?.items ?? [];
        return items.length >= 2 ? (
          <CollectionCarousel
            key={c.handle}
            title={c.title}
            handle={c.handle}
            products={items}
            currency={shop.currency}
            theme={settings}
          />
        ) : null;
      })}

      {story ? (
        <BrandStory
          title={story.title}
          text={story.text}
          imageUrl={storyImage}
          imageFirst={STORY_IMAGE_FIRST.has(preset)}
        />
      ) : null}

      {posts.length > 0 ? <BlogPosts posts={posts} /> : null}

      {settings.showNewsletter ? (
        <NewsletterSection title={settings.newsletterTitle} text={settings.newsletterText} />
      ) : null}
    </>
  );
}

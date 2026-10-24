import type { Paginated, ProductCardPage, StorefrontBlogPost } from '@repo/contracts';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/product-grid';
import { BlogPosts } from '@/components/sections/blog-posts';
import { BrandStory } from '@/components/sections/brand-story';
import { CollectionCarousel } from '@/components/sections/collection-carousel';
import {
  type CollectionFeature,
  FeaturedCollections,
} from '@/components/sections/featured-collections';
import { Hero, type HeroImage } from '@/components/sections/hero';
import { NewsletterSection } from '@/components/sections/newsletter-section';
import { SectionHeader } from '@/components/sections/section-header';
import { TrustBar } from '@/components/sections/trust-bar';
import { sf, StorefrontApiError } from '@/lib/api';
import { srcSetFor } from '@/lib/images';
import { getShop, getThemePreview } from '@/lib/shop';
import { themeStyleId } from '@/lib/theme';

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
  // The root host renders the marketing home in the layout instead; other store-less hosts 404.
  if (!shop) notFound();
  const { preset, settings } = shop.theme;
  const style = themeStyleId(shop.theme);
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
    const pictured = page?.items.find((p) => p.imageUrl);
    return {
      ...c,
      total: page?.total ?? null,
      imageUrl: pictured?.imageUrl ?? null,
      imageSrcSet: pictured?.imageUrl
        ? srcSetFor(pictured.imageUrl, pictured.imageRenditions)
        : undefined,
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
  // Each card's first photo with its renditions (cards without a photo are left out).
  const photos = latest.items.flatMap((p) =>
    p.imageUrl
      ? [
          {
            card: p,
            image: {
              src: p.imageUrl,
              alt: p.imageAlt,
              srcSet: srcSetFor(p.imageUrl, p.imageRenditions),
            } satisfies HeroImage,
          },
        ]
      : [],
  );
  const storyCard = photos[2]?.card;
  const storyPhoto: HeroImage | null = storyCard?.secondImageUrl
    ? {
        src: storyCard.secondImageUrl,
        alt: '',
        srcSet: srcSetFor(storyCard.secondImageUrl, storyCard.secondImageRenditions),
      }
    : (photos[2]?.image ?? photos[0]?.image ?? null);

  // The hero features the store's own photos. While previewing a template, the template's
  // industry photos stand in, so the preview shows the design as intended.
  let heroImage: HeroImage | null = photos[0]?.image ?? null;
  let heroExtras: HeroImage[] = photos.slice(1).map((p) => p.image);
  if (preview) {
    const base = `/media/templates/${preview.industry}`;
    heroImage = { src: `${base}/hero.webp`, alt: '' };
    heroExtras = ['p1', 'p2', 'p3'].map((name) => ({ src: `${base}/${name}.webp`, alt: '' }));
  }

  return (
    <>
      <Hero
        style={style}
        shopName={shop.name}
        title={settings.heroTitle || shop.name}
        subtitle={settings.heroSubtitle || 'Discover our latest products.'}
        cta={settings.heroCta || 'Shop now'}
        image={heroImage}
        extras={heroExtras}
        tiles={features
          .filter((f) => f.total !== 0)
          .map((f) => ({
            label: f.title,
            href: `/collections/${f.handle}`,
            image: f.imageUrl,
            imageSrcSet: f.imageSrcSet,
          }))}
      />

      {settings.showTrustBar ? <TrustBar theme={settings} /> : null}

      {settings.showCollections && features.length > 0 ? (
        <FeaturedCollections
          collections={features}
          dense={preset === 'catalog'}
          captionBelow={style === 'editorial' || style === 'classic'}
        />
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
          imageUrl={storyPhoto?.src ?? null}
          imageSrcSet={storyPhoto?.srcSet}
          imageFirst={STORY_IMAGE_FIRST.has(preset)}
          style={style}
        />
      ) : null}

      {posts.length > 0 ? <BlogPosts posts={posts} /> : null}

      {settings.showNewsletter ? (
        <NewsletterSection
          title={settings.newsletterTitle}
          text={settings.newsletterText}
          style={style}
        />
      ) : null}
    </>
  );
}

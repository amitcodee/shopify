import type { ThemeStyleId } from '@repo/contracts';
import { NewsletterForm } from '@/components/newsletter-form';

const DEFAULT_TITLE = 'Join our newsletter';
const DEFAULT_TEXT = 'New arrivals and offers, straight to your inbox. Unsubscribe anytime.';

/**
 * Newsletter sign-up band at the end of the homepage: a brand-colored block in bold, a ruled
 * two-column band in editorial and catalog, and a centered panel elsewhere.
 */
export function NewsletterSection({
  title,
  text,
  style,
}: {
  title: string;
  text: string;
  style: ThemeStyleId;
}) {
  const heading = (className: string) => (
    <h2 id="newsletter-heading" className={`t-title break-words ${className}`}>
      {title || DEFAULT_TITLE}
    </h2>
  );

  if (style === 'bold' || style === 'banner') {
    return (
      <section
        aria-labelledby="newsletter-heading"
        className="store-section relative overflow-hidden rounded-2xl bg-brand px-6 py-14 text-brand-contrast sm:px-12 sm:py-20"
      >
        <div
          aria-hidden="true"
          className="absolute -right-20 -bottom-28 size-80 rounded-full bg-accent opacity-60 blur-3xl"
        />
        <div className="relative grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow opacity-75">Newsletter</p>
            {heading('mt-3 text-3xl sm:text-5xl')}
            <p className="mt-4 max-w-md opacity-85">{text || DEFAULT_TEXT}</p>
          </div>
          <NewsletterForm tone="brand" className="lg:justify-self-end" />
        </div>
      </section>
    );
  }

  if (style === 'editorial' || style === 'catalog') {
    return (
      <section
        aria-labelledby="newsletter-heading"
        className="store-section grid gap-8 border-y border-zinc-900 py-10 sm:py-14 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-16"
      >
        <div>
          <p className="eyebrow text-zinc-500">Newsletter</p>
          {heading(
            style === 'editorial' ? 'mt-3 text-4xl sm:text-5xl' : 'mt-2 text-2xl sm:text-3xl',
          )}
          <p className="mt-4 max-w-lg text-zinc-600">{text || DEFAULT_TEXT}</p>
        </div>
        <NewsletterForm className="lg:justify-self-end" />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="newsletter-heading"
      className="store-section relative overflow-hidden rounded-2xl border border-zinc-200 bg-surface px-6 py-14 text-center sm:px-12 sm:py-20"
    >
      <p className="eyebrow text-zinc-500">Newsletter</p>
      {heading('mx-auto mt-3 max-w-2xl text-3xl sm:text-[2.75rem]')}
      <p className="mx-auto mt-4 max-w-lg text-zinc-600">{text || DEFAULT_TEXT}</p>
      <NewsletterForm align="center" className="mt-8" />
    </section>
  );
}

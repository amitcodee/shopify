import { NewsletterForm } from '@/components/newsletter-form';

const DEFAULT_TITLE = 'Join our newsletter';
const DEFAULT_TEXT = 'New arrivals and offers, straight to your inbox. Unsubscribe anytime.';

/** Newsletter sign-up band at the end of the homepage. */
export function NewsletterSection({ title, text }: { title: string; text: string }) {
  return (
    <section
      aria-labelledby="newsletter-heading"
      className="store-section rounded-2xl bg-surface px-6 py-12 text-center sm:px-12 sm:py-16"
    >
      <p className="eyebrow text-zinc-500">Newsletter</p>
      <h2
        id="newsletter-heading"
        className="mx-auto mt-3 max-w-2xl font-heading text-2xl font-semibold leading-tight tracking-tight break-words sm:text-4xl"
      >
        {title || DEFAULT_TITLE}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-zinc-600">{text || DEFAULT_TEXT}</p>
      <NewsletterForm align="center" className="mt-8" />
    </section>
  );
}

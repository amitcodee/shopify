/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import { THEME_INDUSTRIES, THEME_TEMPLATES } from '@repo/contracts';
import { Icon, type IconName } from './icons';
import { LEGAL_DOCS, LEGAL_UPDATED, type LegalBlock, type LegalDoc } from './legal-data';
import {
  Arrow,
  buttonPrimary,
  buttonSecondary,
  container,
  CtaBand,
  displayFace,
  focusRing,
  headline,
  IconGrid,
  ink,
  PageHero,
  paper,
  PhotoPanel,
  section,
  SectionHeading,
} from './page-parts';
import { fetchSupportEmail } from './public-api';
import { signupUrl } from './urls';

const DOC_ICONS: Record<string, IconName> = {
  terms: 'file',
  privacy: 'shield',
  cookies: 'lock',
  'acceptable-use': 'users',
  billing: 'card',
  'data-processing': 'stack',
};

// ── /legal ──────────────────────────────────────────────────────────────────────

export function LegalHubPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Legal' }]}
        eyebrow="Legal"
        title="Policies, in plain language"
        subtitle="The terms you agree to when you run a store with us, how we handle personal data, and the few essential cookies we use."
      />
      <section className={`bg-white ${section}`}>
        <div className={container}>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {LEGAL_DOCS.map((doc) => (
              <li key={doc.slug} className="flex">
                <a
                  href={`/legal/${doc.slug}`}
                  className={`group flex flex-1 flex-col rounded-xl bg-white p-7 ring-1 ring-slate-900/[0.08] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgb(10_34_54/0.35)] hover:ring-azure-600/30 ${focusRing}`}
                >
                  <span className="flex size-11 items-center justify-center rounded-lg bg-azure-50 text-azure-700">
                    <Icon name={DOC_ICONS[doc.slug] ?? 'file'} />
                  </span>
                  <span
                    className={`mt-5 text-xl font-semibold tracking-[-0.01em] text-navy-900 group-hover:text-azure-700 ${displayFace}`}
                  >
                    {doc.title}
                  </span>
                  <span className="mt-2 leading-7 text-slate-600">{doc.summary}</span>
                  <span className="mt-auto flex items-center justify-between pt-6 text-sm">
                    <span className="text-slate-500">Updated {doc.updated}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-azure-700">
                      Read <Arrow />
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-12 flex flex-col gap-4 rounded-xl bg-mist p-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-navy-900">Looking for how we keep stores safe?</p>
              <p className="mt-1 text-slate-600">
                Database-level isolation, hosted card payments and two-factor sign-in.
              </p>
            </div>
            <a href="/security" className={`group ${buttonSecondary}`}>
              Security overview <Arrow />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

// ── /legal/<doc> ────────────────────────────────────────────────────────────────

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === 'string') return <p>{block}</p>;
  if ('list' in block) {
    return (
      <ul className="space-y-2.5">
        {block.list.map((item) => (
          <li key={item} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-azure-600"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if ('note' in block) {
    return (
      <p className="rounded-lg border-l-4 border-azure-600 bg-azure-50/70 px-5 py-4 text-navy-900">
        {block.note}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-slate-900/10">
      <table className="w-full min-w-[34rem] text-left text-[0.9375rem]">
        <thead className="bg-mist text-navy-900">
          <tr>
            {block.table.head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-900/[0.07]">
          {block.table.rows.map((row) => (
            <tr key={row[0]} className="align-top">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`px-4 py-3 ${i === 0 ? 'font-medium whitespace-nowrap text-navy-900' : 'text-slate-600'}`}
                >
                  {i === 0 && block.table.head[0] === 'Name' ? (
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.8125rem]">
                      {cell}
                    </code>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function LegalDocPage({ doc }: { doc: LegalDoc }) {
  const supportEmail = await fetchSupportEmail();
  const others = LEGAL_DOCS.filter((d) => d.slug !== doc.slug);
  return (
    <>
      <PageHero
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Legal', href: '/legal' },
          { label: doc.title },
        ]}
        title={doc.title}
        subtitle={doc.summary}
        actions={<p className="text-sm text-slate-500">Last updated {doc.updated}</p>}
      />
      <section className="bg-white py-14 sm:py-20">
        <div className={`${container} grid gap-12 lg:grid-cols-[16rem_1fr] lg:gap-16`}>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="On this page" className="rounded-xl bg-mist p-5">
              <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                On this page
              </p>
              <ol className="mt-3 space-y-1 text-sm">
                {doc.sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={`flex gap-2 rounded-md px-2 py-1.5 text-slate-700 hover:bg-white hover:text-azure-700 ${focusRing}`}
                    >
                      <span className="w-5 shrink-0 text-slate-400 tabular-nums">{i + 1}.</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="max-w-3xl min-w-0">
            {doc.sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-24 border-t border-slate-900/[0.07] py-9 first:border-t-0 first:pt-0"
              >
                <h2
                  className={`flex gap-3 text-2xl font-semibold tracking-[-0.01em] text-navy-900 ${displayFace}`}
                >
                  <span className="text-azure-600 tabular-nums">{i + 1}.</span>
                  {s.title}
                </h2>
                <div className="mt-4 space-y-4 text-[1.0625rem] leading-8 text-slate-700">
                  {s.blocks.map((b, j) => (
                    <Block key={j} block={b} />
                  ))}
                </div>
              </section>
            ))}

            <div className="mt-4 rounded-xl bg-navy-950 p-7 text-white sm:p-8">
              <p className={`text-xl font-semibold ${displayFace}`}>Contact us</p>
              <p className="mt-2 leading-7 text-slate-300">
                {supportEmail ? (
                  <>
                    Email{' '}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="font-semibold text-white underline underline-offset-4"
                    >
                      {supportEmail}
                    </a>{' '}
                    and mention “{doc.title}” in the subject.
                  </>
                ) : (
                  <>
                    Use the{' '}
                    <a
                      href="/contact"
                      className="font-semibold text-white underline underline-offset-4"
                    >
                      contact page
                    </a>{' '}
                    and mention “{doc.title}”.
                  </>
                )}
              </p>
            </div>

            <div className="mt-12">
              <p className="text-sm font-semibold text-navy-900">Other policies</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {others.map((d) => (
                  <li key={d.slug}>
                    <a
                      href={`/legal/${d.slug}`}
                      className={`inline-flex items-center gap-1.5 rounded-md bg-azure-50 px-3 py-1.5 text-sm font-medium text-azure-700 hover:bg-azure-100 ${focusRing}`}
                    >
                      <Icon name={DOC_ICONS[d.slug] ?? 'file'} className="size-4" />
                      {d.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

// ── /about ──────────────────────────────────────────────────────────────────────

const PRINCIPLES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'rocket',
    title: 'Launch in an afternoon',
    body: 'A template for your industry, your products and payments connected — then you are open.',
  },
  {
    icon: 'shield',
    title: 'Safe by default',
    body: 'Store data is isolated in the database, card details stay with your payment provider, and staff sign in with two-factor codes.',
  },
  {
    icon: 'card',
    title: 'Your money, your account',
    body: 'Payouts go from Stripe or Razorpay straight to you. We never hold your funds.',
  },
  {
    icon: 'switch',
    title: 'No lock-in',
    body: 'Export your catalog as CSV, switch templates any time and keep every product, page and order.',
  },
  {
    icon: 'globe',
    title: 'Built to sell anywhere',
    body: 'Multi-currency checkout with your own exchange rates, and stores on your own domain.',
  },
  {
    icon: 'code',
    title: 'Open to developers',
    body: 'A documented REST API, signed webhooks and scoped access tokens for your own integrations.',
  },
];

export function AboutPage() {
  return (
    <>
      <PageHero
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'About' }]}
        eyebrow="About us"
        title={
          <>
            Commerce that is <span className="text-azure-600">simple to start</span> and safe to
            grow
          </>
        }
        subtitle="Commerce Platform gives independent brands a complete online store — storefront, checkout, payments and back office — without stitching tools together."
        actions={
          <>
            <a href={signupUrl} className={`group ${buttonPrimary}`}>
              Start free trial <Arrow />
            </a>
            <a href="/features" className={buttonSecondary}>
              See what&rsquo;s included
            </a>
          </>
        }
        aside={
          <PhotoPanel
            photo="team-planning"
            ratio="aspect-[4/3]"
            alt="A team planning work together"
          />
        }
      />

      <section className={`bg-white ${section}`}>
        <div className={`${container} grid gap-12 lg:grid-cols-2 lg:gap-20`}>
          <h2 className={`text-navy-900 ${headline}`}>Why we built it</h2>
          <div className="space-y-5 text-lg leading-8 text-slate-600">
            <p>
              Opening an online store should not mean juggling a website builder, a payment gateway,
              a stock spreadsheet and an email tool. We put them in one product that works together
              from the first order.
            </p>
            <p>
              Every price, discount and tax is worked out on the server, so what shoppers pay is
              always right. Templates are settings rather than code, so changing your design never
              breaks your store.
            </p>
          </div>
        </div>
      </section>

      <section className={`${paper} ${section}`}>
        <div className={container}>
          <SectionHeading title="What we stand for" />
          <div className="mt-12">
            <IconGrid items={PRINCIPLES} />
          </div>
        </div>
      </section>

      <section className={`${ink} ${section} text-white`}>
        <div className={container}>
          <dl className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [String(THEME_TEMPLATES.length), 'store templates'],
              [String(THEME_INDUSTRIES.length), 'industries covered'],
              ['2', 'payment providers: Stripe and Razorpay'],
              ['0', 'card numbers stored on our servers'],
            ].map(([value, label]) => (
              <div key={label} className="flex flex-col-reverse border-t border-white/15 pt-5">
                <dt className="mt-2 text-slate-300">{label}</dt>
                <dd className={`text-5xl font-medium tracking-[-0.03em] text-white ${displayFace}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-12 text-sm text-slate-400">
            Read our{' '}
            <a href="/legal" className="font-semibold text-white underline underline-offset-4">
              policies
            </a>{' '}
            and{' '}
            <a href="/security" className="font-semibold text-white underline underline-offset-4">
              security overview
            </a>
            . Policies last updated {LEGAL_UPDATED}.
          </p>
        </div>
      </section>

      <CtaBand />
    </>
  );
}

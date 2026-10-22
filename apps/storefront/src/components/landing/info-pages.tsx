/* eslint-disable @next/next/no-html-link-for-pages -- the root layout picks the marketing page from the request path, so links between marketing pages must be full page loads, not client navigations. */
import { Icon, type IconName } from './icons';
import {
  buttonDark,
  buttonGhostDark,
  buttonLight,
  CheckList,
  container,
  CtaBand,
  focusRing,
  IconGrid,
  PageHero,
  SectionHeading,
  Steps,
  textLink,
} from './page-parts';
import { apiDocsUrl, signupUrl } from './urls';

// ── /switch ─────────────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  'Handle',
  'Title',
  'Description',
  'Vendor',
  'Type',
  'Tags',
  'Status',
  'Option1 Name',
  'Option1 Value',
  'Variant SKU',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Grams',
  'Variant Inventory Qty',
  'SEO Title',
  'SEO Description',
];

export function SwitchPage() {
  return (
    <>
      <PageHero
        eyebrow="Switch to Commerce Platform"
        title="Moving your store, one clear step at a time"
        subtitle="Bring your catalog over with a CSV file, point your domain at your new store and connect payments. Here is exactly what moves, how, and what to check before launch."
        actions={
          <>
            <a href={signupUrl} className={buttonLight}>
              Start for free
            </a>
            <a href="#checklist" className={buttonGhostDark}>
              See the checklist
            </a>
          </>
        }
        aside={
          <div
            className="overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/10"
            aria-hidden="true"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs text-slate-400">
              <Icon name="file" className="size-4" />
              products.csv
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-6 text-slate-300">
              <span className="text-indigo-300">
                Handle,Title,Option1 Name,Option1 Value,Variant Price
              </span>
              {'\n'}linen-shirt,Linen shirt,Size,S,55.00{'\n'}linen-shirt,,Size,M,55.00{'\n'}
              linen-shirt,,Size,L,55.00
              {'\n'}canvas-tote,Canvas tote,,,30.00
            </pre>
          </div>
        }
      />

      <section aria-labelledby="what-moves" className="py-20 sm:py-28">
        <div className={container}>
          <SectionHeading
            id="what-moves"
            eyebrow="What moves, and how"
            title="An honest migration plan"
            intro="There is no one-click migration tool. Products come over with a CSV import; everything else takes a few minutes to set up in your admin."
          />
          <div className="mt-12">
            <IconGrid
              items={[
                {
                  icon: 'box',
                  title: 'Products — CSV import',
                  body: 'Export products from your current platform as CSV and upload it under Products → Import. Shopify-style columns, one row per variant.',
                },
                {
                  icon: 'layout',
                  title: 'Images — upload after import',
                  body: 'The CSV carries product data, not images. Add images on each product page after the import.',
                },
                {
                  icon: 'link',
                  title: 'Domain — DNS records',
                  body: 'Add your domain, create a TXT and a CNAME record at your DNS provider, verify, and make it primary.',
                  href: '/features/domains',
                },
                {
                  icon: 'card',
                  title: 'Payments — new connection',
                  body: 'Connect Stripe or Razorpay to your new store. Payouts go to your own account.',
                  href: '/features/payments',
                },
                {
                  icon: 'users',
                  title: 'Customers — sign up again',
                  body: 'Customer accounts and past orders are not imported. Customers create an account on your new store when they next order.',
                },
                {
                  icon: 'tag',
                  title: 'Discounts and gift cards — recreate',
                  body: 'Recreate active discount codes, and issue gift cards with custom codes to honour existing balances.',
                  href: '/features/marketing',
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="csv" className="bg-slate-50 py-20 sm:py-28">
        <div className={`${container} grid gap-14 lg:grid-cols-2`}>
          <div>
            <SectionHeading
              id="csv"
              eyebrow="Product CSV"
              title="Familiar columns, checked row by row"
              intro="The import creates new products through the same validation and plan limits as the admin. Products whose handle already exists are skipped, and any problem is reported with its row number."
            />
            <div className="mt-8">
              <CheckList
                items={[
                  'One row per variant; repeat the handle for each variant',
                  'Up to three options per product',
                  'Status can be draft, active or archived',
                  'Export your catalog in the same format at any time',
                ]}
              />
            </div>
            <a href="/guides/add-products" className={`mt-8 inline-block ${textLink}`}>
              Read the product guide →
            </a>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">Columns the import understands</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {CSV_COLUMNS.map((c) => (
                <li
                  key={c}
                  className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs text-slate-700 ring-1 ring-slate-200"
                >
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-600">
              Handle, Title and Variant Price are required. Options go up to Option3, and columns
              like Variant Barcode, Variant Taxable and Variant Allow Backorder are supported too.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="steps" className="py-20 sm:py-28">
        <div className={container}>
          <SectionHeading id="steps" eyebrow="The plan" title="Switch in three steps" />
          <div className="mt-12">
            <Steps
              steps={[
                {
                  title: 'Create your store',
                  body: 'Sign up and pick a template. Keep the store behind its password page while you set up.',
                },
                {
                  title: 'Import and review',
                  body: 'Upload your CSV, then add images, collections and stock locations.',
                },
                {
                  title: 'Connect and launch',
                  body: 'Connect payments, add your domain, test an order and remove the password.',
                },
              ]}
            />
          </div>
        </div>
      </section>

      <section
        id="checklist"
        aria-labelledby="checklist-title"
        className="scroll-mt-20 bg-slate-950 py-20 sm:py-28"
      >
        <div className={`${container} grid gap-12 lg:grid-cols-2`}>
          <SectionHeading
            id="checklist-title"
            dark
            eyebrow="Before you launch"
            title="Your launch checklist"
            intro="Work through these in your admin, then turn off the password page."
          />
          <ol className="space-y-3">
            {[
              ['Products imported and set to Active', '/guides/add-products'],
              ['Images, collections and stock in place', '/guides/add-products'],
              ['Template applied and customized', '/guides/apply-a-template'],
              ['Shipping zones and tax rates added', '/guides/shipping-and-taxes'],
              ['Payments connected and showing Active', '/guides/set-up-payments'],
              ['Pages and store policies written', '/features/online-store'],
              ['Domain verified and primary', '/guides/connect-a-domain'],
              ['A test order placed and refunded', '/guides/fulfil-and-refund'],
            ].map(([item, href], i) => (
              <li key={item}>
                <a
                  href={href}
                  className="flex items-center gap-4 rounded-xl bg-white/5 px-4 py-3.5 text-slate-100 ring-1 ring-white/10 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200">
                    {i + 1}
                  </span>
                  <span className="flex-1">{item}</span>
                  <span aria-hidden="true" className="text-slate-500">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <CtaBand title="Ready to make the move?" />
    </>
  );
}

// ── /security ───────────────────────────────────────────────────────────────────

const SECURITY_AREAS: { icon: IconName; title: string; points: string[] }[] = [
  {
    icon: 'stack',
    title: 'Every store’s data kept apart',
    points: [
      'The server works out which store a request belongs to — it never takes a store ID on trust.',
      'Every query is scoped to that store, and PostgreSQL row-level security enforces it again on every store table.',
      'Rows can only reference rows in the same store, and automated tests try to cross between stores on every route.',
    ],
  },
  {
    icon: 'card',
    title: 'Payments without card data',
    points: [
      'Shoppers enter card details on Stripe’s or Razorpay’s hosted page, keeping the platform within PCI SAQ-A.',
      'Totals are calculated on the server from your catalog, never from the browser.',
      'Payment webhooks are signature-verified, de-duplicated and amount-checked.',
    ],
  },
  {
    icon: 'lock',
    title: 'Accounts that are hard to take over',
    points: [
      'Passwords are hashed with Argon2id; sign-up emails are verified before a store is created.',
      'Two-factor authentication with an authenticator app; turning it on or off signs out other sessions.',
      'After 10 failed attempts an account locks for 15 minutes and the owner gets an unlock link by email.',
    ],
  },
  {
    icon: 'shield',
    title: 'Pages that can’t be hijacked',
    points: [
      'A strict, nonce-based content security policy on the admin and every storefront.',
      'Themes are settings, and descriptions and pages are plain text — no merchant HTML or scripts reach shoppers.',
      'Uploaded images are decoded and re-encoded, and SVG files are refused.',
    ],
  },
  {
    icon: 'users',
    title: 'Least-privilege staff access',
    points: [
      'Staff get only the permissions they are given, and can never grant more than they hold.',
      'Invitation links are single-use and only work for the invited email address.',
      'An append-only audit log records sensitive actions, with platform admin actions audited separately.',
    ],
  },
  {
    icon: 'code',
    title: 'Safe integrations',
    points: [
      'API tokens are store-scoped, shown once and stored only as a hash.',
      'Outgoing webhooks are signed, never reach private networks and never follow redirects.',
      'Rate limits are shared across all API servers so no one can overwhelm a store.',
    ],
  },
];

export function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security"
        title="Your store’s data, protected in layers"
        subtitle="How Commerce Platform keeps stores apart, keeps card data off its servers and keeps accounts safe — in plain words."
        actions={
          <>
            <a href={signupUrl} className={buttonLight}>
              Start for free
            </a>
            <a href="/features/staff-security" className={buttonGhostDark}>
              Staff & security features
            </a>
          </>
        }
        aside={
          <div className="space-y-3" aria-hidden="true">
            {[
              ['Request', 'The server decides which store you are'],
              ['Application', 'Every query scoped to that store'],
              ['Database', 'Row-level security on every store table'],
            ].map(([layer, text], i) => (
              <div
                key={layer}
                className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
                style={{ marginLeft: `${i * 1.25}rem` }}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-sm font-bold text-indigo-200">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{layer}</p>
                  <p className="text-sm text-slate-300">{text}</p>
                </div>
              </div>
            ))}
          </div>
        }
      />
      <section aria-labelledby="layers" className="py-20 sm:py-28">
        <div className={container}>
          <SectionHeading
            id="layers"
            eyebrow="How we protect stores"
            title="Six areas, each with more than one safeguard"
          />
          <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SECURITY_AREAS.map((area) => (
              <li key={area.title} className="rounded-2xl bg-white p-7 ring-1 ring-slate-200">
                <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                  <Icon name={area.icon} />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">{area.title}</h3>
                <div className="mt-4 text-sm leading-6">
                  <CheckList items={area.points} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section aria-labelledby="ops" className="bg-slate-50 py-20 sm:py-28">
        <div className={`${container} grid gap-12 lg:grid-cols-2`}>
          <SectionHeading
            id="ops"
            eyebrow="Operations"
            title="Reviewed, tested and backed up"
            intro="Security is part of how the platform is built and run, not an afterthought."
          />
          <CheckList
            items={[
              'A security review of the whole platform, with every finding fixed and covered by regression tests.',
              'Database backups made with a verified script, with restores rehearsed and recorded.',
              'Customer data can be exported or redacted on request.',
              'Dependencies are pinned with a lockfile and audited before release.',
              'Two-factor authentication is mandatory for platform administrators in production.',
            ]}
          />
        </div>
      </section>
      <section className="py-16">
        <div className={`${container} text-center`}>
          <p className="text-slate-600">
            Found a security issue? Please tell us through our{' '}
            <a href="/contact" className={textLink}>
              contact page
            </a>
            .
          </p>
        </div>
      </section>
      <CtaBand />
    </>
  );
}

// ── /contact ────────────────────────────────────────────────────────────────────

export function ContactPage({ supportEmail }: { supportEmail: string | null }) {
  return (
    <>
      <PageHero
        center
        eyebrow="Contact"
        title="How can we help?"
        subtitle="Most questions are answered in our guides. If you can’t find what you need, email the support team."
      />
      <section className="py-20 sm:py-24">
        <div className={`${container} grid gap-6 lg:grid-cols-3`}>
          <div className="rounded-3xl bg-slate-950 p-8 text-white lg:col-span-1">
            <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
              <Icon name="mail" />
            </span>
            <h2 className="mt-5 text-xl font-semibold">Email support</h2>
            {supportEmail ? (
              <>
                <p className="mt-2 text-slate-300">
                  Write to us and include your store address so we can find your store quickly.
                </p>
                <a
                  href={`mailto:${supportEmail}`}
                  className="mt-6 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-semibold break-all text-slate-950 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {supportEmail}
                </a>
              </>
            ) : (
              <p className="mt-2 text-slate-300">
                Our support address is unavailable right now. Please try again shortly — or sign in
                to your admin, where the support contact is shown.
              </p>
            )}
          </div>
          {(
            [
              {
                icon: 'file',
                title: 'Guides',
                body: 'Step-by-step help for setting up and running your store.',
                href: '/guides',
                cta: 'Browse guides',
              },
              {
                icon: 'stack',
                title: 'FAQ',
                body: 'Answers about domains, payments, templates, fees and security.',
                href: '/pricing#faq',
                cta: 'Read the FAQ',
              },
            ] as const
          ).map((card) => (
            <a
              key={card.title}
              href={card.href}
              className={`group rounded-3xl bg-white p-8 ring-1 ring-slate-200 transition hover:shadow-lg hover:ring-indigo-200 ${focusRing}`}
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <Icon name={card.icon} />
              </span>
              <h2 className="mt-5 text-xl font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-slate-600">{card.body}</p>
              <span className="mt-6 inline-block text-sm font-semibold text-indigo-600 group-hover:text-indigo-500">
                {card.cta} <span aria-hidden="true">→</span>
              </span>
            </a>
          ))}
        </div>
        <div className={`${container} mt-12`}>
          <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-slate-50 p-8 ring-1 ring-slate-200 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Building an integration?</h2>
              <p className="mt-1 text-slate-600">
                The OpenAPI reference documents the REST API, and the{' '}
                <a href="/guides/api-and-webhooks" className={textLink}>
                  API tokens and webhooks guide
                </a>{' '}
                covers signed webhooks.
              </p>
            </div>
            <a href={apiDocsUrl} target="_blank" rel="noreferrer" className={buttonDark}>
              Open API docs<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

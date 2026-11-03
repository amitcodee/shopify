import { LEGAL_DOCS } from './legal-data';
import { Logo } from './logo';
import { apiDocsUrl, loginUrl, signupUrl } from './urls';

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'Platform',
    links: [
      { label: 'All features', href: '/features' },
      { label: 'Templates', href: '/templates' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Switch to us', href: '/switch' },
    ],
  },
  {
    title: 'Features',
    links: [
      { label: 'Online store', href: '/features/online-store' },
      { label: 'Checkout', href: '/features/checkout' },
      { label: 'Payments', href: '/features/payments' },
      { label: 'Products & inventory', href: '/features/inventory' },
      { label: 'Orders', href: '/features/orders' },
      { label: 'Marketing', href: '/features/marketing' },
      { label: 'Developers', href: '/features/developers' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Guides', href: '/guides' },
      { label: 'FAQ', href: '/pricing#faq' },
      { label: 'API docs', href: apiDocsUrl, external: true },
      { label: 'Log in', href: loginUrl },
      { label: 'Start for free', href: signupUrl },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Security', href: '/security' },
      { label: 'Legal', href: '/legal' },
    ],
  },
  {
    title: 'Legal',
    links: LEGAL_DOCS.map((d) => ({ label: d.title, href: `/legal/${d.slug}` })),
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-mk-bg text-mk-dim">
      <div className="mx-auto grid max-w-[90rem] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_3.4fr] lg:px-[5.5rem]">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-6">
            Everything you need to start, run and grow an online store.
          </p>
          <a
            href={signupUrl}
            className="mt-6 inline-flex rounded-full bg-mk-fg px-5 py-2.5 text-sm font-semibold text-mk-bg transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg"
          >
            Start for free
          </a>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-xs font-semibold tracking-[0.08em] text-mk-fg uppercase">
                {col.title}
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="rounded text-mk-dim hover:text-mk-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg"
                      {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    >
                      {l.label}
                      {l.external ? <span aria-label="(opens in a new tab)"> ↗</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-mk-line">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-2 px-5 py-6 text-xs text-mk-dim sm:flex-row sm:justify-between sm:px-8 lg:px-[5.5rem]">
          <p>© {new Date().getFullYear()} Commerce Platform</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {[
              ['Terms', '/legal/terms'],
              ['Privacy', '/legal/privacy'],
              ['Cookies', '/legal/cookies'],
            ].map(([label, href]) => (
              <li key={href}>
                <a
                  href={href}
                  className="rounded hover:text-mk-fg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg"
                >
                  {label}
                </a>
              </li>
            ))}
            <li>Plan prices are in US dollars.</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

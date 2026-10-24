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
      { label: 'Security', href: '/security' },
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
      { label: 'Contact', href: '/contact' },
      { label: 'API docs', href: apiDocsUrl, external: true },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', href: loginUrl },
      { label: 'Start for free', href: signupUrl },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-900/[0.08] bg-white text-slate-600">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_3fr] lg:px-8">
        <div>
          <Logo tone="light" />
          <p className="mt-5 max-w-xs text-sm leading-6">
            Everything you need to start, run and grow an online store.
          </p>
          <a
            href={signupUrl}
            className="mt-6 inline-flex rounded-md bg-azure-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-azure-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-600"
          >
            Start for free
          </a>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-xs font-semibold tracking-[0.08em] text-navy-900 uppercase">
                {col.title}
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="rounded text-azure-700 hover:text-azure-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-600"
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
      <div className="border-t border-slate-900/[0.08] bg-mist">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Commerce Platform</p>
          <p>Plan prices are in US dollars. Your store can sell in many currencies.</p>
        </div>
      </div>
    </footer>
  );
}

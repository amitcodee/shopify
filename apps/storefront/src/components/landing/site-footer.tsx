import { Logo } from './logo';
import { apiDocsUrl, loginUrl, signupUrl } from './urls';

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Templates', href: '/templates' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'API docs', href: apiDocsUrl, external: true },
      { label: 'Webhooks', href: '/#developers' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'FAQ', href: '/pricing#faq' },
      { label: 'Selling in many currencies', href: '/#sell-globally' },
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
    <footer className="bg-slate-950 text-slate-400">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_3fr]">
        <div>
          <Logo tone="dark" />
          <p className="mt-4 max-w-xs text-sm leading-6">
            Everything you need to start, run and grow an online store.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-white">{col.title}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="rounded hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
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
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Commerce Platform</p>
          <p>Plan prices are in US dollars. Your store can sell in many currencies.</p>
        </div>
      </div>
    </footer>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Can I use my own domain?',
    a: 'Yes. Every store gets its own address as soon as you create it, and you can connect a domain you own. You prove ownership with a DNS record, and HTTPS certificates are issued and renewed automatically.',
  },
  {
    q: 'How do I get paid?',
    a: 'Connect Stripe (via Stripe Connect) or Razorpay and payouts go to your own account. A built-in payment sandbox lets you place test orders before you go live.',
  },
  {
    q: 'Do I need to know how to code?',
    a: 'No. Pick one of 108 templates, then change colors, fonts, layout and wording from your admin. Templates are settings rather than code, so switching design never breaks your store.',
  },
  {
    q: 'Can I switch templates later?',
    a: 'Any time. Applying a new template keeps your products, pages and the headlines you have written — only the design changes.',
  },
  {
    q: 'Can shoppers pay in their own currency?',
    a: 'Yes. Enable the currencies you want with your own exchange rates and rounding. Shoppers pick a currency on your storefront and check out and pay in it, while your reports stay in your store currency.',
  },
  {
    q: 'What fees will I pay?',
    a: 'Your plan’s monthly price plus the platform fee on sales shown for your plan. Your payment provider charges its own card processing fees separately.',
  },
  {
    q: 'Can I bring my existing products?',
    a: 'Yes. Import products from a CSV file with familiar Shopify-style columns, one row per variant. You can export your catalog the same way.',
  },
  {
    q: 'How is my data kept secure?',
    a: 'Each store’s data is isolated at the database level, passwords are hashed with Argon2id, staff can protect sign-in with two-factor authentication, and webhooks are signed so you can verify them.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-indigo-600">FAQ</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <div className="mt-12 divide-y divide-slate-200 rounded-2xl bg-white ring-1 ring-slate-200">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group px-5 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded py-5 font-medium text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 [&::-webkit-details-marker]:hidden">
                {q}
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className="size-5 shrink-0 text-slate-400 transition group-open:rotate-45"
                >
                  <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
                </svg>
              </summary>
              <p className="-mt-1 pb-5 text-slate-600 leading-7">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

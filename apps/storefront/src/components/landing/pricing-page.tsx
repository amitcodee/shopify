import { Faq } from './faq';
import {
  buttonPrimary,
  CheckList,
  container,
  CtaBand,
  display,
  Eyebrow,
  lead,
  paper,
  PhotoPanel,
  SectionHeading,
} from './page-parts';
import { fetchPublicPlans, type PublicPlan } from './public-api';
import { signupUrl } from './urls';

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);

const hasIntro = (p: PublicPlan) =>
  p.introPrice !== null && p.introCycles > 0 && p.introPrice < p.priceMonthly;

const count = (value: number | null) =>
  value === null ? 'Unlimited' : value.toLocaleString('en-US');

const limit = (value: number | null, noun: string) =>
  value === null ? `Unlimited ${noun}` : `Up to ${value.toLocaleString('en-US')} ${noun}`;

const percent = (bps: number) =>
  `${(bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;

const fee = (bps: number) =>
  bps === 0 ? 'No platform fee on sales' : `${percent(bps)} platform fee on sales`;

const price = (p: PublicPlan) =>
  p.priceMonthly === 0 ? 'Free' : money(p.priceMonthly, p.currency);

/** Features with no plan limits: every plan gets them. */
const INCLUDED = [
  'Online store with 288 templates',
  'Custom domains with automatic HTTPS',
  'Multi-currency selling',
  'Discount codes and gift cards',
  'Abandoned checkout emails',
  'Customer accounts and segments',
  'Inventory across locations',
  'Draft orders, returns and packing slips',
  'Your own gateway: Razorpay, PayU, Cashfree, PhonePe, Stripe or PayPal',
  'Cash on delivery with fake-order protection',
  'Admin API tokens and webhooks',
  'Two-factor sign-in for staff',
];

function Check({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const featuredIndex = (plans: PublicPlan[]) =>
  plans.length > 2 ? Math.floor(plans.length / 2) : 0;

/** Trial → intro months → regular price, as three steps. */
function PriceTimeline({ plan }: { plan: PublicPlan }) {
  const steps = [
    plan.trialDays > 0
      ? { when: `First ${plan.trialDays} days`, what: 'Free', note: 'No card needed' }
      : null,
    hasIntro(plan) && plan.introPrice !== null
      ? {
          when: `Months 1–${plan.introCycles}`,
          what: `${money(plan.introPrice, plan.currency)}/mo`,
          note: 'Launch offer',
        }
      : null,
    {
      when: hasIntro(plan) ? 'After that' : 'Every month',
      what: `${money(plan.priceMonthly, plan.currency)}/mo`,
      note: 'Cancel any time',
    },
  ].filter((s) => s !== null);
  return (
    <ol className="mt-6 grid gap-2 sm:grid-cols-3">
      {steps.map((step) => (
        <li key={step.when} className="rounded-lg bg-mk-subtle px-3 py-3 ring-1 ring-mk-line">
          <p className="text-xs text-mk-dim">{step.when}</p>
          <p className="mt-1 font-semibold text-mk-fg">{step.what}</p>
          <p className="text-xs text-mk-dim">{step.note}</p>
        </li>
      ))}
    </ol>
  );
}

function PlanCards({ plans }: { plans: PublicPlan[] }) {
  const featured = featuredIndex(plans);
  return (
    <ul
      className={`mx-auto grid gap-6 ${plans.length >= 3 ? 'max-w-6xl lg:grid-cols-3' : plans.length === 2 ? 'max-w-4xl md:grid-cols-2' : 'max-w-xl'}`}
    >
      {plans.map((plan, i) => {
        const highlight = i === featured;
        return (
          <li
            key={plan.code}
            className={`relative flex flex-col rounded-xl p-8 sm:p-9 ${
              highlight
                ? 'mk-dark bg-navy-950 text-mk-fg shadow-[0_40px_80px_-30px_rgb(15_23_42/0.6)] ring-1 ring-mk-line'
                : 'bg-mk-surface text-mk-fg shadow-[0_20px_40px_-30px_rgb(15_23_42/0.35)] ring-1 ring-mk-line'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              {hasIntro(plan) ? (
                <p className="rounded-full bg-mk-accent-soft px-3 py-1 text-xs font-semibold text-mk-accent ring-1 ring-mk-accent/30">
                  Launch offer
                </p>
              ) : highlight && plans.length > 1 ? (
                <p className="rounded-full bg-mk-accent-soft px-3 py-1 text-xs font-semibold text-mk-accent ring-1 ring-mk-accent/30">
                  Recommended
                </p>
              ) : null}
            </div>
            {hasIntro(plan) && plan.introPrice !== null ? (
              <>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-5xl font-semibold tracking-[-0.03em]">
                    {money(plan.introPrice, plan.currency)}
                  </span>
                  <span className="text-mk-dim">/month</span>
                </p>
                <p className="mt-2 text-sm text-mk-muted">
                  for your first {plan.introCycles} months, then{' '}
                  <span className="font-semibold text-mk-fg">{price(plan)}/month</span>
                </p>
              </>
            ) : (
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="text-5xl font-semibold tracking-[-0.03em]">{price(plan)}</span>
                {plan.priceMonthly > 0 && <span className="text-mk-dim">/month</span>}
              </p>
            )}
            <PriceTimeline plan={plan} />
            <ul
              className={`mt-8 flex-1 space-y-3.5 border-t pt-8 text-sm ${highlight ? 'border-mk-line text-mk-muted' : 'border-mk-line text-mk-muted'}`}
            >
              {[
                limit(plan.maxProducts, 'products'),
                limit(plan.maxStaff, 'staff accounts'),
                limit(plan.maxOrdersPerMonth, 'orders a month'),
                fee(plan.transactionFeeBps),
                'Every feature and template included',
                'Pay by UPI AutoPay or card',
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span className={`mt-0.5 ${highlight ? 'text-mk-accent' : 'text-mk-accent'}`}>
                    <Check />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <a
              href={signupUrl}
              className={`mt-9 rounded-full px-4 py-3 text-center text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ${
                highlight
                  ? 'bg-mk-fg text-mk-bg hover:opacity-85 focus-visible:outline-mk-fg'
                  : 'text-mk-fg ring-2 ring-mk-fg/80 hover:bg-mk-surface-2 focus-visible:outline-mk-fg'
              }`}
            >
              {plan.trialDays > 0
                ? `Start your ${plan.trialDays}-day free trial`
                : `Start with ${plan.name}`}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function Comparison({ plans }: { plans: PublicPlan[] }) {
  const featured = featuredIndex(plans);
  const rows: { label: string; values: string[] }[] = [
    { label: 'Monthly price', values: plans.map((p) => price(p)) },
    { label: 'Products', values: plans.map((p) => count(p.maxProducts)) },
    { label: 'Staff accounts', values: plans.map((p) => count(p.maxStaff)) },
    { label: 'Orders per month', values: plans.map((p) => count(p.maxOrdersPerMonth)) },
    {
      label: 'Platform fee on sales',
      values: plans.map((p) => (p.transactionFeeBps === 0 ? 'None' : percent(p.transactionFeeBps))),
    },
  ];
  const cell = (i: number) => `px-4 py-4 text-center ${i === featured ? 'bg-mk-accent-soft' : ''}`;
  return (
    <section aria-labelledby="compare-title" className="bg-mk-surface py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading center id="compare-title" eyebrow="Side by side" title="Compare plans" />
        <div className="relative mt-12 overflow-x-auto rounded-xl bg-mk-surface ring-1 ring-mk-line">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Plan limits and included features</caption>
            <thead>
              <tr className="border-b border-mk-line bg-mk-subtle">
                <th scope="col" className="px-4 py-4 text-left font-semibold text-mk-fg">
                  <span className="sr-only">Feature</span>
                </th>
                {plans.map((p, i) => (
                  <th
                    key={p.code}
                    scope="col"
                    className={`${cell(i)} font-semibold text-mk-fg ${i === featured ? 'text-mk-accent' : ''}`}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-mk-line">
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-4 py-4 text-left font-medium text-mk-fg-soft">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={plans[i]?.code} className={`${cell(i)} text-mk-fg`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-mk-subtle">
                <th
                  scope="colgroup"
                  colSpan={plans.length + 1}
                  className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-mk-dim uppercase"
                >
                  Included in every plan
                </th>
              </tr>
              {INCLUDED.map((feature) => (
                <tr key={feature}>
                  <th scope="row" className="px-4 py-3.5 text-left font-normal text-mk-fg-soft">
                    {feature}
                  </th>
                  {plans.map((p, i) => (
                    <td key={p.code} className={cell(i).replace('py-4', 'py-3.5')}>
                      <span className="inline-flex text-mk-accent">
                        <Check className="size-5" />
                      </span>
                      <span className="sr-only">Included</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** The platform pricing page: plans from the API, what every plan includes, a comparison and FAQ. */
export async function PricingPage() {
  const plans = await fetchPublicPlans();
  return (
    <>
      <section
        className={`relative isolate overflow-hidden ${paper} pt-14 pb-20 sm:pt-20 sm:pb-24`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(46rem_26rem_at_50%_-10%,rgb(48_94_255/0.16),transparent)]"
        />
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Eyebrow className="justify-center">Pricing</Eyebrow>
          <h1 className={`mt-5 text-mk-fg ${display}`}>One simple price. Everything included.</h1>
          <p className={`mt-6 text-mk-muted ${lead}`}>
            Start free for 7 days — no card needed. Then ₹99 a month for your first 3 months, and
            ₹799 a month after that. No fee on your sales, whichever gateway you use or cash on
            delivery.
          </p>
        </div>
        <div className="mt-14 px-4 sm:px-6 lg:px-8">
          {plans ? (
            <PlanCards plans={plans} />
          ) : (
            <div className="mx-auto max-w-lg rounded-xl bg-mk-surface p-8 text-center ring-1 ring-mk-line">
              <p className="font-semibold text-mk-fg">Plan details are unavailable right now.</p>
              <p className="mt-2 text-sm text-mk-muted">
                Please check back shortly — or create your store now and choose a plan from your
                admin.
              </p>
              <a href={signupUrl} className={`${buttonPrimary} mt-6`}>
                Start your free trial
              </a>
            </div>
          )}
        </div>
        <p className="mt-10 px-4 text-center text-sm text-mk-dim">
          Prices in Indian rupees, including GST. Your payment gateway&rsquo;s own processing fees
          are separate.
        </p>
      </section>
      <section aria-labelledby="included-title" className={`${paper} pb-20 sm:pb-28`}>
        <div className={`${container} grid items-center gap-14 lg:grid-cols-2 lg:gap-20`}>
          <PhotoPanel photo="market-stall" ratio="aspect-[4/3]" />
          <div>
            <SectionHeading
              id="included-title"
              eyebrow="On every plan"
              title="Every feature, whichever plan you choose"
            />
            <div className="mt-8 grid gap-x-8 sm:grid-cols-2 [&_ul]:space-y-3">
              <CheckList items={INCLUDED.slice(0, 6)} />
              <div className="mt-3.5 sm:mt-0">
                <CheckList items={INCLUDED.slice(6)} />
              </div>
            </div>
          </div>
        </div>
      </section>
      {plans && plans.length > 1 ? <Comparison plans={plans} /> : null}
      <Faq />
      <CtaBand photo="packing-orders" />
    </>
  );
}

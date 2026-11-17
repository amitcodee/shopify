import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui';
import { getStore } from '@/lib/session';
import { guide } from '@/lib/storefront';
import { SectionIntro, type SectionIntroItem } from './section-intro';
import { SettingsTabs } from './tabs';

/** What each settings section is for, in plain words, keyed by its path. */
function sections(): Record<string, SectionIntroItem> {
  const help = (slug: Parameters<typeof guide>[0], label: string) => ({
    href: guide(slug).href,
    label,
  });
  return {
    '': {
      title: 'General',
      body: 'Your store name, contact email, currency and time zone, and when abandoned-checkout reminders are sent. You can also close the store here.',
    },
    '/domains': {
      title: 'Domains',
      body: 'Every store gets a free web address. To use a domain you own, add the DNS records shown here; HTTPS is set up for you.',
      help: help('connect-a-domain', 'How to connect a domain'),
    },
    '/locations': {
      title: 'Locations',
      body: 'Places where you keep stock, like a shop or a warehouse. Stock is counted separately at each location.',
    },
    '/staff': {
      title: 'Staff',
      body: 'Invite people to help run your store and choose what each person can see and change.',
      help: help('invite-staff', 'How staff access works'),
    },
    '/theme': {
      title: 'Theme',
      body: 'Choose a template and customize how your storefront looks. Edits in the editor stay a draft until you publish them.',
      help: help('apply-a-template', 'How templates work'),
    },
    '/currencies': {
      title: 'Currencies',
      body: 'Let shoppers see prices in their own currency, at exchange rates you set.',
      help: help('multi-currency', 'How multi-currency works'),
    },
    '/payments': {
      title: 'Payments',
      body: 'Choose how customers pay you: your own gateway account (Razorpay, PayU, Cashfree, PhonePe, Stripe or PayPal), payouts through the platform, or cash on delivery.',
      help: help('set-up-payments', 'How to set up payments'),
    },
    '/shipping': {
      title: 'Shipping',
      body: 'Where you deliver and what you charge. Group countries into zones and give each zone its own rates.',
      help: help('shipping-and-taxes', 'How shipping works'),
    },
    '/taxes': {
      title: 'Taxes',
      body: 'Tax rates added at checkout, by country or by region.',
      help: help('shipping-and-taxes', 'How taxes work'),
    },
    '/billing': {
      title: 'Plan & billing',
      body: 'Your plan, trial, payment method and invoices, plus any premium templates you bought.',
    },
    '/developer': {
      title: 'Developer',
      body: 'API access tokens and webhooks for connecting your store to other apps and services.',
      help: help('api-and-webhooks', 'How the API works'),
    },
    '/audit-log': {
      title: 'Audit log',
      body: 'A record of who changed what in your store, and when.',
    },
  };
}

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  return (
    <>
      <PageHeader title="Settings" description="Manage how your store looks, sells and ships." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-8">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <SettingsTabs storeId={store.id} permissions={store.permissions} />
        </div>
        <div className="min-w-0">
          <SectionIntro storeId={store.id} sections={sections()} />
          {children}
        </div>
      </div>
    </>
  );
}

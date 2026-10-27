import type { IconName } from './icons';

/** Which CSS illustration a feature page shows beside its showcase text (see mocks.tsx). */
export type MockKind =
  | 'storefront'
  | 'checkout'
  | 'payments'
  | 'inventory'
  | 'orders'
  | 'marketing'
  | 'analytics'
  | 'currencies'
  | 'staff'
  | 'code'
  | 'domains';

export interface FeatureArea {
  slug: string;
  /** Short name for menus and cards. */
  name: string;
  icon: IconName;
  /** One line for the hub and related cards. */
  summary: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  capabilities: { icon: IconName; title: string; body: string }[];
  showcase: { title: string; body: string; points: string[]; mock: MockKind };
  steps: { title: string; body: string }[];
  related: string[];
  /** Guides (slugs) that walk through this area. */
  guides: string[];
}

/**
 * Every feature area of the platform. Only capabilities that exist in the product belong here
 * (see docs/roadmap.md); the pages are generated from this list.
 */
export const FEATURE_AREAS: FeatureArea[] = [
  {
    slug: 'online-store',
    name: 'Online store',
    icon: 'layout',
    summary: 'Templates, pages, a blog, menus and a password page for launch day.',
    eyebrow: 'Online store',
    headline: 'A storefront that looks made for your brand',
    subhead:
      'Start from one of 168 templates built for 12 industries, then shape it with your colors, fonts and layout — no code involved.',
    capabilities: [
      {
        icon: 'layout',
        title: '168 templates',
        body: '12 industries in 14 design styles, from minimal and bento to dark “noir”. Switch whenever you like; your products and wording stay put.',
      },
      {
        icon: 'file',
        title: 'Pages and policies',
        body: 'Write About, FAQ or any other page, plus store policies that appear in your footer and at checkout.',
      },
      {
        icon: 'mail',
        title: 'Blog',
        body: 'Posts with drafts, scheduled publishing, authors, excerpts and tags, at /blog on your store.',
      },
      {
        icon: 'stack',
        title: 'Navigation menus',
        body: 'Main and footer menus with typed links to products, collections, pages, posts or anywhere else.',
      },
      {
        icon: 'lock',
        title: 'Password page',
        body: 'Keep the store private until launch. The API itself refuses catalog, cart and checkout without the password.',
      },
      {
        icon: 'globe',
        title: 'Search-engine basics',
        body: 'Each store gets a sitemap.xml and robots.txt, and product pages carry structured data.',
      },
    ],
    showcase: {
      title: 'Design with settings, not code',
      body: 'Templates are a set of validated design choices — colors, fonts, corners, card styles and layout — so applying one can never break your store, and nobody can slip scripts into your pages.',
      points: [
        '8 homepage layouts, from split hero to dense catalog',
        'System font stacks that load instantly',
        'Preview any template on a demo store before applying it',
      ],
      mock: 'storefront',
    },
    steps: [
      {
        title: 'Pick a template',
        body: 'Choose one for your industry when you create your store.',
      },
      {
        title: 'Make it yours',
        body: 'Adjust colors, fonts, layout and homepage wording from your admin.',
      },
      {
        title: 'Add pages and menus',
        body: 'Write pages, policies and posts and link them from your menus.',
      },
    ],
    related: ['domains', 'checkout', 'marketing'],
    guides: ['apply-a-template', 'create-your-store'],
  },
  {
    slug: 'checkout',
    name: 'Checkout',
    icon: 'card',
    summary: 'A one-page checkout with discounts, gift cards and multi-currency.',
    eyebrow: 'Checkout',
    headline: 'A checkout that gets every number right',
    subhead:
      'Shoppers go from cart to paid on a single page. Prices, stock, discounts, shipping and taxes are worked out on the server — never trusted from the browser.',
    capabilities: [
      {
        icon: 'card',
        title: 'One-page checkout',
        body: 'Contact, delivery address, shipping method and payment on a single page, as a guest or signed in.',
      },
      {
        icon: 'tag',
        title: 'Discounts and gift cards',
        body: 'Shoppers enter a discount code or gift card at checkout; a gift card can pay for part or all of an order.',
      },
      {
        icon: 'globe',
        title: 'Pay in their currency',
        body: 'When you enable more currencies, shoppers check out and pay in the one they picked.',
      },
      {
        icon: 'box',
        title: 'Stock held safely',
        body: 'Stock is reserved atomically when an order is placed, and released if it goes unpaid.',
      },
      {
        icon: 'truck',
        title: 'Order status page',
        body: 'Every order gets a status page and confirmation email showing payment and fulfilment progress.',
      },
      {
        icon: 'mail',
        title: 'Abandoned checkout emails',
        body: 'Shoppers who leave without paying get one reminder email with a link that rebuilds their cart.',
      },
    ],
    showcase: {
      title: 'Totals you can trust',
      body: 'Each checkout recalculates prices and availability from your catalog, applies discount limits atomically and uses idempotency keys, so a double click never creates a double order.',
      points: [
        'Shipping zones with price, weight and subtotal conditions',
        'Tax rates per country with regional overrides',
        'Links to your store policies right at checkout',
      ],
      mock: 'checkout',
    },
    steps: [
      {
        title: 'Set shipping and taxes',
        body: 'Add shipping zones and tax rates for where you sell.',
      },
      {
        title: 'Connect payments',
        body: 'Choose Stripe or Razorpay, or test with the sandbox first.',
      },
      { title: 'Take orders', body: 'Shoppers check out on one page and get a status page.' },
    ],
    related: ['payments', 'international', 'marketing'],
    guides: ['shipping-and-taxes', 'set-up-payments'],
  },
  {
    slug: 'payments',
    name: 'Payments',
    icon: 'lock',
    summary: 'Stripe Connect or Razorpay payouts, a sandbox, refunds and disputes.',
    eyebrow: 'Payments',
    headline: 'Get paid into your own account',
    subhead:
      'Connect Stripe or Razorpay and payouts go straight to you. Card details are entered on the provider’s secure page — never on our servers.',
    capabilities: [
      {
        icon: 'card',
        title: 'Stripe Connect',
        body: 'Onboard a Stripe Express account from your admin; payments settle to it as destination charges.',
      },
      {
        icon: 'globe',
        title: 'Razorpay',
        body: 'Selling in Indian rupees? Set up Razorpay instead and get paid through Razorpay Route.',
      },
      {
        icon: 'code',
        title: 'Payment sandbox',
        body: 'Place test orders end to end before you go live, with no real money involved.',
      },
      {
        icon: 'switch',
        title: 'Refunds',
        body: 'Refund all or part of an order, with optional restocking; the refund goes back through the gateway.',
      },
      {
        icon: 'shield',
        title: 'Chargebacks',
        body: 'Disputes raised with the provider appear on the order and you get an email about them.',
      },
      {
        icon: 'lock',
        title: 'Verified webhooks',
        body: 'Provider events are signature-checked, de-duplicated and their amounts confirmed before an order is marked paid.',
      },
    ],
    showcase: {
      title: 'Card data never touches the platform',
      body: 'Shoppers pay on Stripe’s or Razorpay’s hosted page, which keeps the platform within PCI SAQ-A. The platform fee for your plan is set on the server at checkout.',
      points: [
        'One gateway per store, chosen by you',
        'Amounts confirmed with the provider before fulfilment',
        'Refunds recorded on the order timeline',
      ],
      mock: 'payments',
    },
    steps: [
      { title: 'Open Payments settings', body: 'Pick Stripe or Razorpay as your gateway.' },
      { title: 'Finish onboarding', body: 'Complete the provider’s account set-up.' },
      { title: 'Test, then go live', body: 'Try a sandbox order, then start selling.' },
    ],
    related: ['checkout', 'orders', 'staff-security'],
    guides: ['set-up-payments', 'fulfil-and-refund'],
  },
  {
    slug: 'inventory',
    name: 'Products & inventory',
    icon: 'box',
    summary: 'Variants, collections, stock across locations and CSV import/export.',
    eyebrow: 'Products & inventory',
    headline: 'Know what you have, wherever it is',
    subhead:
      'Add products with up to three options, organise them into collections and track stock in every warehouse or shop you sell from.',
    capabilities: [
      {
        icon: 'box',
        title: 'Variants',
        body: 'Up to three options (like size, color, material) generate a variant matrix, each with its own price, SKU and stock.',
      },
      {
        icon: 'layout',
        title: 'Images and collections',
        body: 'Upload product images, then group products into manual collections or automatic ones by tag.',
      },
      {
        icon: 'stack',
        title: 'Multiple locations',
        body: 'Track stock per location. Orders take stock in your location priority order, and restocks return it.',
      },
      {
        icon: 'switch',
        title: 'Transfers and adjustments',
        body: 'Move stock between locations and adjust counts; every change goes into an append-only history.',
      },
      {
        icon: 'file',
        title: 'CSV import and export',
        body: 'Bring a catalog in or take it out with Shopify-style columns, one row per variant.',
      },
      {
        icon: 'shield',
        title: 'No overselling',
        body: 'Stock never goes negative unless you allow backorders for that product.',
      },
    ],
    showcase: {
      title: 'Every unit accounted for',
      body: 'Inventory changes are recorded as a ledger with row-locked adjustments, so busy days and simultaneous orders can’t corrupt your counts.',
      points: [
        'Filter the inventory list to low-stock items',
        'Duplicate a product to start the next one faster',
        'Plain-text descriptions that are safe to display anywhere',
      ],
      mock: 'inventory',
    },
    steps: [
      { title: 'Add or import products', body: 'Create them one by one or upload a CSV.' },
      { title: 'Set up locations', body: 'Add your warehouses or shops and their priority.' },
      { title: 'Keep stock current', body: 'Adjust and transfer as stock moves.' },
    ],
    related: ['orders', 'analytics', 'developers'],
    guides: ['add-products'],
  },
  {
    slug: 'orders',
    name: 'Orders',
    icon: 'truck',
    summary: 'Fulfilment with tracking, refunds, returns, draft orders and packing slips.',
    eyebrow: 'Orders',
    headline: 'From paid to delivered, in one place',
    subhead:
      'Fulfil with tracking numbers, print packing slips, handle returns and refunds, and create orders yourself for phone or wholesale customers.',
    capabilities: [
      {
        icon: 'truck',
        title: 'Fulfilment with tracking',
        body: 'Mark orders fulfilled with a carrier and tracking number; customers see it on their order status page.',
      },
      {
        icon: 'file',
        title: 'Packing slips',
        body: 'Print a packing slip for any order straight from the order page.',
      },
      {
        icon: 'switch',
        title: 'Returns',
        body: 'Customers request returns from their account within 30 days; you approve, receive and refund, with optional restock.',
      },
      {
        icon: 'card',
        title: 'Refunds and cancellations',
        body: 'Refund fully or partly, or cancel unfulfilled orders and release their stock.',
      },
      {
        icon: 'mail',
        title: 'Draft orders and invoices',
        body: 'Build an order with catalog or custom items and prices, then email an invoice to pay online — or mark it paid.',
      },
      {
        icon: 'stack',
        title: 'Order export',
        body: 'Download your orders as CSV for accounting or analysis.',
      },
    ],
    showcase: {
      title: 'A clear timeline for every order',
      body: 'Payment, fulfilment, refunds, returns and disputes all land on the order, so anyone on your team can pick it up.',
      points: [
        'Superseded and expired checkouts release their stock',
        'Refunds can restock items to the location they shipped from',
        'Staff permissions decide who can refund',
      ],
      mock: 'orders',
    },
    steps: [
      { title: 'An order is paid', body: 'It appears in Orders with the customer’s details.' },
      { title: 'Pack and ship', body: 'Print the packing slip and add tracking.' },
      { title: 'Handle what follows', body: 'Approve returns and issue refunds when needed.' },
    ],
    related: ['payments', 'inventory', 'analytics'],
    guides: ['fulfil-and-refund'],
  },
  {
    slug: 'marketing',
    name: 'Marketing',
    icon: 'tag',
    summary: 'Discount codes, gift cards, customer segments and checkout recovery.',
    eyebrow: 'Marketing',
    headline: 'Bring shoppers in, and bring them back',
    subhead:
      'Run discount codes, sell and issue gift cards, recover abandoned checkouts and group customers into segments you can act on.',
    capabilities: [
      {
        icon: 'tag',
        title: 'Discount codes',
        body: 'Percentage, fixed amount or free shipping, with start and end dates, minimums and usage limits.',
      },
      {
        icon: 'card',
        title: 'Gift cards',
        body: 'Issue gift cards yourself or sell them as products; each paid unit emails a card to the buyer.',
      },
      {
        icon: 'users',
        title: 'Customer segments',
        body: 'Save filters like spend, number of paid orders, last order date or marketing consent, with live counts and CSV export.',
      },
      {
        icon: 'mail',
        title: 'Abandoned checkout recovery',
        body: 'One reminder email after a delay you choose, with a link that rebuilds the cart. See which orders it recovered.',
      },
      {
        icon: 'rocket',
        title: 'Newsletter sign-ups',
        body: 'Shoppers can subscribe from your storefront; their marketing consent is stored on the customer.',
      },
      {
        icon: 'chart',
        title: 'Know what works',
        body: 'Watch net sales, orders and top products on your dashboard after every campaign.',
      },
    ],
    showcase: {
      title: 'Limits that hold under pressure',
      body: 'Discount usage is counted when an order is paid, atomically, so a popular code never goes over its limit — and unpaid checkouts can’t use it up.',
      points: [
        'Gift cards are never discounted, shipped or taxed',
        'Gift card balances return when unpaid orders expire',
        'Segment exports are recorded in the audit log',
      ],
      mock: 'marketing',
    },
    steps: [
      { title: 'Create an offer', body: 'Set up a discount code or issue a gift card.' },
      { title: 'Target customers', body: 'Build a segment and export it for your email tool.' },
      { title: 'Recover sales', body: 'Turn on abandoned checkout emails.' },
    ],
    related: ['analytics', 'checkout', 'online-store'],
    guides: ['run-a-discount'],
  },
  {
    slug: 'analytics',
    name: 'Analytics',
    icon: 'chart',
    summary: 'Net sales, orders, average order value and top products.',
    eyebrow: 'Analytics',
    headline: 'See how your store is doing at a glance',
    subhead:
      'Your dashboard shows sales, orders and what is selling best, over the period you choose.',
    capabilities: [
      {
        icon: 'chart',
        title: 'Net sales',
        body: 'Paid order totals minus refunds, alongside gross sales and the amount refunded.',
      },
      {
        icon: 'truck',
        title: 'Orders and AOV',
        body: 'How many orders you took and their average value in your store currency.',
      },
      {
        icon: 'stack',
        title: 'Sales by day',
        body: 'A daily chart of sales and orders across the period.',
      },
      {
        icon: 'box',
        title: 'Top products',
        body: 'Your best sellers by units and revenue.',
      },
      {
        icon: 'shield',
        title: 'Low stock and to-do',
        body: 'See how many orders are waiting to be fulfilled and how many variants are running low.',
      },
      {
        icon: 'file',
        title: 'Exports',
        body: 'Take orders, products and customer segments out as CSV for deeper analysis.',
      },
    ],
    showcase: {
      title: 'Numbers in your currency',
      body: 'Even when shoppers pay in other currencies, reports stay in your store currency so totals always add up.',
      points: [
        'Switch between 7, 30 and 90 days',
        'Refunds reduce net sales automatically',
        'Only paid orders count',
      ],
      mock: 'analytics',
    },
    steps: [
      { title: 'Open Overview', body: 'It is the first page you see in your admin.' },
      { title: 'Pick a period', body: 'Look at the last 7, 30 or 90 days.' },
      { title: 'Dig deeper', body: 'Export orders or products as CSV.' },
    ],
    related: ['marketing', 'orders', 'inventory'],
    guides: [],
  },
  {
    slug: 'international',
    name: 'International',
    icon: 'globe',
    summary: 'Sell in many currencies with your own rates and rounding.',
    eyebrow: 'International',
    headline: 'Sell in your shoppers’ currency',
    subhead:
      'Enable the currencies you want, set exchange rates and rounding, and shoppers browse, check out and pay in the one they choose.',
    capabilities: [
      {
        icon: 'globe',
        title: 'Presentment currencies',
        body: 'Add the currencies you want to offer alongside your store currency.',
      },
      {
        icon: 'switch',
        title: 'Your own rates',
        body: 'You set each exchange rate, so prices never shift by surprise.',
      },
      {
        icon: 'tag',
        title: 'Rounding',
        body: 'Keep exact conversions, round to whole units, or use charm pricing ending in .99.',
      },
      {
        icon: 'card',
        title: 'Pay in that currency',
        body: 'The shopper’s chosen currency carries through checkout and payment.',
      },
      {
        icon: 'chart',
        title: 'Reports stay consistent',
        body: 'Your dashboard and reports stay in your store currency.',
      },
      {
        icon: 'layout',
        title: 'A switcher on your store',
        body: 'A currency switcher appears in your storefront header once more than one currency is on.',
      },
    ],
    showcase: {
      title: 'One catalog, many currencies',
      body: 'You keep one set of prices. Converted prices are calculated from your rates and rounding wherever shoppers see them.',
      points: [
        'Shipping zones and taxes per country',
        'Full country names on addresses',
        'Turn a currency off at any time',
      ],
      mock: 'currencies',
    },
    steps: [
      { title: 'Add a currency', body: 'Pick it from the currency settings.' },
      { title: 'Set rate and rounding', body: 'Decide how converted prices look.' },
      { title: 'Shoppers switch', body: 'They pick a currency in your store header.' },
    ],
    related: ['checkout', 'payments', 'analytics'],
    guides: ['multi-currency'],
  },
  {
    slug: 'staff-security',
    name: 'Staff & security',
    icon: 'shield',
    summary: 'Roles and permissions, two-factor sign-in, audit logs and lockout.',
    eyebrow: 'Staff & security',
    headline: 'Give your team access, not the keys to everything',
    subhead:
      'Invite staff with exactly the permissions they need, protect sign-in with two-factor authentication and keep a record of who changed what.',
    capabilities: [
      {
        icon: 'users',
        title: 'Roles and permissions',
        body: 'Invite staff by email and grant only the areas they work in. Nobody can give themselves more access.',
      },
      {
        icon: 'lock',
        title: 'Two-factor sign-in',
        body: 'Authenticator-app codes on top of passwords; changing 2FA signs out other sessions.',
      },
      {
        icon: 'file',
        title: 'Audit log',
        body: 'Sensitive actions are recorded with who did them and when.',
      },
      {
        icon: 'shield',
        title: 'Account lockout',
        body: 'Repeated failed sign-ins lock the account for a while and email an unlock link.',
      },
      {
        icon: 'stack',
        title: 'Store isolation',
        body: 'Every store’s data is separated in the database itself with row-level security.',
      },
      {
        icon: 'mail',
        title: 'Verified sign-ups',
        body: 'Email addresses are verified before a store can be created.',
      },
    ],
    showcase: {
      title: 'Security in layers',
      body: 'The server decides which store a request belongs to, every query is scoped to it, and PostgreSQL row-level security enforces the same rule again underneath.',
      points: [
        'Passwords hashed with Argon2id',
        'Strict content security policy on every page',
        'Invitation links are single-use and tied to the invited email',
      ],
      mock: 'staff',
    },
    steps: [
      { title: 'Invite your team', body: 'Send an invitation to each staff email.' },
      { title: 'Choose permissions', body: 'Grant only the areas each person needs.' },
      { title: 'Turn on 2FA', body: 'Add an authenticator app to your account.' },
    ],
    related: ['developers', 'payments', 'orders'],
    guides: ['invite-staff'],
  },
  {
    slug: 'developers',
    name: 'Developers',
    icon: 'code',
    summary: 'Admin API tokens, signed webhooks and OpenAPI docs.',
    eyebrow: 'Developers',
    headline: 'Connect the tools you already use',
    subhead:
      'A documented REST API with store-scoped access tokens, and signed webhooks to keep other systems in sync.',
    capabilities: [
      {
        icon: 'code',
        title: 'Admin API tokens',
        body: 'Create tokens for one store with only the permissions an integration needs; revoke them any time.',
      },
      {
        icon: 'link',
        title: 'Signed webhooks',
        body: 'Order, refund and product events delivered with a signature you can verify, retried automatically on failure.',
      },
      {
        icon: 'file',
        title: 'OpenAPI docs',
        body: 'The REST API is described in an OpenAPI document you can browse in your browser.',
      },
      {
        icon: 'switch',
        title: 'CSV import and export',
        body: 'Move products in and out with Shopify-style columns when an API is overkill.',
      },
      {
        icon: 'shield',
        title: 'Safe delivery',
        body: 'Webhook deliveries never reach private networks, never follow redirects and time out quickly.',
      },
      {
        icon: 'stack',
        title: 'Rate limits',
        body: 'Fair per-client limits shared across API instances keep every store responsive.',
      },
    ],
    showcase: {
      title: 'Built for integrations',
      body: 'Subscribe to topics like orders/paid, orders/fulfilled or products/updated and your endpoint receives a signed JSON payload as soon as it happens.',
      points: [
        'Tokens are shown once and stored only as a hash',
        'Permissions use the same model as staff accounts',
        'Recent deliveries shown for each webhook',
      ],
      mock: 'code',
    },
    steps: [
      { title: 'Create a token', body: 'Choose the permissions it needs.' },
      { title: 'Add a webhook', body: 'Enter your endpoint URL and topics.' },
      { title: 'Verify and build', body: 'Check signatures and call the API.' },
    ],
    related: ['inventory', 'orders', 'staff-security'],
    guides: ['api-and-webhooks'],
  },
  {
    slug: 'domains',
    name: 'Domains',
    icon: 'link',
    summary: 'Your own domain with automatic HTTPS.',
    eyebrow: 'Domains',
    headline: 'Your store, at your own address',
    subhead:
      'Every store gets its own address the moment you create it. Connect a domain you own and HTTPS is set up automatically.',
    capabilities: [
      {
        icon: 'link',
        title: 'Instant store address',
        body: 'A subdomain for your store from day one — share it straight away.',
      },
      {
        icon: 'globe',
        title: 'Custom domains',
        body: 'Connect a domain you already own and choose which one is primary.',
      },
      {
        icon: 'shield',
        title: 'Ownership check',
        body: 'You prove you own the domain with a DNS TXT record before it goes live, so nobody can claim it.',
      },
      {
        icon: 'lock',
        title: 'Automatic HTTPS',
        body: 'Certificates are issued and renewed for you.',
      },
      {
        icon: 'mail',
        title: 'Primary domain in emails',
        body: 'Customer emails link to your primary domain.',
      },
      {
        icon: 'stack',
        title: 'One claim per hostname',
        body: 'Only one verified store can hold a hostname, and unverified claims never route traffic.',
      },
    ],
    showcase: {
      title: 'Two DNS records away',
      body: 'Add the domain in your admin, then create the two records it shows you at your DNS provider: a TXT record that proves ownership and a CNAME that points the domain at the platform. Then click Verify.',
      points: [
        'Keep your store address as a fallback',
        'Change your primary domain at any time',
        'Works with any DNS provider',
      ],
      mock: 'domains',
    },
    steps: [
      { title: 'Add your domain', body: 'Enter it in your domain settings.' },
      { title: 'Verify ownership', body: 'Create the TXT record at your DNS provider.' },
      { title: 'Make it primary', body: 'Shoppers and emails use it from then on.' },
    ],
    related: ['online-store', 'staff-security', 'checkout'],
    guides: ['connect-a-domain'],
  },
];

export function findFeatureArea(slug: string): FeatureArea | undefined {
  return FEATURE_AREAS.find((a) => a.slug === slug);
}

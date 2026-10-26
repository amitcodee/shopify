import type { IconName } from './icons';

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  icon: IconName;
  category: 'Getting started' | 'Selling' | 'Running your store' | 'Advanced';
  intro: string;
  /** Where in the admin this happens, e.g. "Settings → Payments". */
  where: string;
  steps: { title: string; body: string }[];
  tips?: string[];
  /** Feature pages (slugs) that describe this area. */
  features: string[];
}

/**
 * Step-by-step guides. Labels in quotes are the exact labels used in the merchant admin, so keep
 * them in step with apps/admin when the UI changes.
 */
export const GUIDES: Guide[] = [
  {
    slug: 'create-your-store',
    title: 'Create your store',
    summary: 'Sign up, confirm your email and set up your first store.',
    icon: 'rocket',
    category: 'Getting started',
    intro:
      'It takes a few minutes to go from sign-up to a working store with its own address and a template that suits what you sell.',
    where: 'Sign-up page',
    steps: [
      {
        title: 'Create your account',
        body: 'Open the sign-up page and fill in “Your name”, “Email” and “Password” (at least 12 characters), then click “Create account”. If you chose a template on our Templates page first, the sign-up page shows which one your store will start with.',
      },
      {
        title: 'Confirm your email',
        body: 'We send a confirmation link that is valid for 24 hours. Open it and click “Confirm email”. Nothing arrived? Check your spam folder or click “Send a new link”.',
      },
      {
        title: 'Name your store',
        body: 'On “Create your store”, enter the “Store name”, choose your “Store address” (this becomes your store’s web address and is the one thing you cannot change later), and add a “Contact email”.',
      },
      {
        title: 'Choose currency and industry',
        body: 'Pick your store “Currency” and answer “What will you sell?”. We start your storefront with a matching template — you can change it any time.',
      },
      {
        title: 'Open your admin',
        body: 'Click “Create store”. You land on Overview, where a notice reminds you to set up payments before you can take orders.',
      },
    ],
    tips: [
      'Every new store starts with a 14-day trial.',
      'Your store address keeps working even after you connect your own domain.',
    ],
    features: ['online-store', 'domains'],
  },
  {
    slug: 'add-products',
    title: 'Add products and collections',
    summary: 'Create products with variants, add images and group them into collections.',
    icon: 'box',
    category: 'Getting started',
    intro:
      'Products can have up to three options, like size and color, with a price, SKU and starting stock for each variant.',
    where: 'Products',
    steps: [
      {
        title: 'Start a product',
        body: 'Go to “Products” and click “Add product”. In “Details”, enter the “Title” and “Description”, and leave “Status” on “Draft” until it is ready to sell.',
      },
      {
        title: 'Add options and variants',
        body: 'In “Options”, click “Add option”, give it an “Option name” (for example Size) and “Values (comma separated)” (for example S, M, L). The “Variants” table then lists every combination, with “Price”, “SKU”, “Weight (g)” and starting “Stock”.',
      },
      {
        title: 'Save, then add images',
        body: 'Click “Create product”. On the product’s page, use “Media” → “Upload image” (JPEG, PNG, WebP, GIF or AVIF up to 5 MB), add “Alt text” and click “Upload”.',
      },
      {
        title: 'Publish it',
        body: 'Set “Status” to “Active” and click “Save product”. Active products appear on your storefront.',
      },
      {
        title: 'Group products into a collection',
        body: 'Go to “Collections” → “Create collection”. Leave “Automated: include products tagged” empty for a manual collection and pick products on its page with “Save products”, or enter a tag to include matching products automatically.',
      },
    ],
    tips: [
      'Moving from another platform? Use “Import” on the Products page to upload a CSV.',
      'After a product is created, change stock on the “Inventory” page.',
      'Use “Duplicate product” to start a similar product quickly.',
    ],
    features: ['inventory'],
  },
  {
    slug: 'set-up-payments',
    title: 'Set up payments',
    summary: 'Connect Stripe or Razorpay, or try the sandbox first.',
    icon: 'card',
    category: 'Getting started',
    intro:
      'Your store needs a payouts account before it can take orders. Payments settle to your own account with the provider.',
    where: 'Settings → Payments',
    steps: [
      {
        title: 'Open Payments',
        body: 'Go to “Settings” and choose the “Payments” tab. The “Payouts account” card shows “Not set up” until you connect a provider.',
      },
      {
        title: 'Connect Stripe',
        body: 'On the “Stripe” card, choose your “Country of your business” (this can’t be changed later) and click “Set up Stripe”. Complete Stripe’s onboarding and you come back to your admin.',
      },
      {
        title: 'Or connect Razorpay',
        body: 'Stores selling in Indian rupees can use the “Razorpay” card instead: fill in your business, PAN and bank details and click “Set up Razorpay”.',
      },
      {
        title: 'Check the status',
        body: 'Once the provider has reviewed your details the badge changes to “Active”. If it says “Action required”, click “Continue setup”.',
      },
    ],
    tips: [
      'On a development platform the “Sandbox” card simulates onboarding and payments — no money moves.',
      'The Payments tab also shows gross sales, platform fees, refunds and chargebacks for recent days.',
    ],
    features: ['payments', 'checkout'],
  },
  {
    slug: 'shipping-and-taxes',
    title: 'Set up shipping and taxes',
    summary: 'Create shipping zones and rates, and add tax rates by country.',
    icon: 'truck',
    category: 'Selling',
    intro:
      'Until you add a shipping zone, customers get free standard shipping everywhere and no tax is charged.',
    where: 'Settings → Shipping and Taxes',
    steps: [
      {
        title: 'Create a shipping zone',
        body: 'In “Settings” → “Shipping”, fill in “Create shipping zone”: a “Zone name” and its “Countries” as 2-letter codes (use * for the rest of the world). Click “Create zone”.',
      },
      {
        title: 'Add rates',
        body: 'On the zone, open “Add rate”, enter a “Name” and “Price”, and optionally minimum or maximum order value or weight. Click “Add rate”. Add as many as you like, such as Standard and Express.',
      },
      {
        title: 'Add tax rates',
        body: 'In “Settings” → “Taxes”, use “Add or update a rate”: “Country”, an optional “Region”, a “Name” and “Rate %”. Tick “Also tax shipping” if shipping is taxable, then click “Save rate”.',
      },
    ],
    tips: ['A region-specific rate overrides the country rate for addresses in that region.'],
    features: ['checkout', 'international'],
  },
  {
    slug: 'apply-a-template',
    title: 'Apply a template and customize it',
    summary: 'Choose from 108 templates, then adjust colors, fonts and layout.',
    icon: 'layout',
    category: 'Selling',
    intro:
      'Templates change how your store looks, never your products or content. Headlines you have written are kept when you switch.',
    where: 'Settings → Theme',
    steps: [
      {
        title: 'Open the template store',
        body: 'Go to “Settings” → “Theme” (also reachable from “Online store” → “Theme”). The “Templates” tab lists every template with industry chips, a “Style” filter and “Search templates”.',
      },
      {
        title: 'Preview before applying',
        body: 'Click “Preview” to see your own store in that template in a new tab. Nothing changes for shoppers yet.',
      },
      {
        title: 'Apply it',
        body: 'Click “Apply”. Your storefront updates within 30 seconds and the template shows a “Current” badge.',
      },
      {
        title: 'Customize',
        body: 'Switch to the “Customize” tab to change “Colors”, “Typography”, “Page structure”, homepage “Content” and “Homepage sections”, then click “Save theme”.',
      },
    ],
    tips: ['Browse every template on our public Templates page before you sign up.'],
    features: ['online-store'],
  },
  {
    slug: 'connect-a-domain',
    title: 'Connect your own domain',
    summary: 'Add a domain, verify it with DNS and make it primary.',
    icon: 'link',
    category: 'Selling',
    intro:
      'Your store address always works. Adding a custom domain gives shoppers an address that matches your brand, with HTTPS set up for you.',
    where: 'Settings → Domains',
    steps: [
      {
        title: 'Add the domain',
        body: 'In “Settings” → “Domains”, enter it under “Custom domains” → “Domain” (for example shop.example.com) and click “Add domain”.',
      },
      {
        title: 'Create the DNS records',
        body: 'Your admin lists the records to “Add these records at your DNS provider”: a TXT record that proves you own the domain, and a CNAME record that points it at the platform. Create both at your DNS provider.',
      },
      {
        title: 'Verify',
        body: 'Click “Verify”. DNS changes can take a while to spread; if the record isn’t found yet, try again later. The badge then changes from “Pending verification” to “Verified”.',
      },
      {
        title: 'Make it primary',
        body: 'Click “Make primary” so emails and links use your domain.',
      },
    ],
    features: ['domains'],
  },
  {
    slug: 'run-a-discount',
    title: 'Run a discount and issue gift cards',
    summary: 'Create discount codes with limits and dates, and issue gift cards.',
    icon: 'tag',
    category: 'Selling',
    intro:
      'Customers enter discount codes and gift cards at checkout. Discount usage counts only when an order is paid.',
    where: 'Discounts and Gift cards',
    steps: [
      {
        title: 'Create a discount code',
        body: 'Go to “Discounts” and fill in “Create discount code”: a “Code” (for example SUMMER20) and a “Type” — “Percentage off”, “Fixed amount off” or “Free shipping” — with its “Value”.',
      },
      {
        title: 'Set limits and dates',
        body: 'Optionally add a “Minimum order”, a “Usage limit”, and “Starts” and “Ends” dates. Click “Create discount”. Its status shows as Active, Scheduled, Expired or Used up.',
      },
      {
        title: 'Issue a gift card',
        body: 'Go to “Gift cards” and use “Issue gift card”: a “Value”, an optional “Customer email” (tick “Email the gift card to the customer”), and an optional expiry date. Click “Issue gift card”.',
      },
      {
        title: 'Or sell gift cards',
        body: 'Create a product, tick “Sell as a gift card” and add a variant per amount. Each paid unit emails a new gift card to the buyer.',
      },
    ],
    tips: [
      'Use “Deactivate” to pause a code without deleting it.',
      'Customers → Segments lets you export a list of customers who accept email marketing.',
    ],
    features: ['marketing'],
  },
  {
    slug: 'fulfil-and-refund',
    title: 'Fulfil, refund and handle returns',
    summary: 'Ship orders with tracking, print packing slips, refund and process returns.',
    icon: 'truck',
    category: 'Running your store',
    intro:
      'Everything about an order happens on its page, and every step is added to its timeline.',
    where: 'Orders',
    steps: [
      {
        title: 'Find orders to ship',
        body: 'Go to “Orders” and choose the “Unfulfilled” view. Open an order and click “Print packing slip” to pack it.',
      },
      {
        title: 'Mark as fulfilled',
        body: 'In “Fulfill order”, enter the “Carrier”, “Tracking number” and “Tracking URL”. Keep “Email the customer” ticked and click “Mark as fulfilled”.',
      },
      {
        title: 'Refund',
        body: 'In “Refund”, enter the “Amount”, an optional “Reason”, and choose which items to “Return items to stock”. Click “Refund”.',
      },
      {
        title: 'Process returns',
        body: 'Customers request returns from their account. Review them under “Orders” → “Returns”: “Approve return” (or decline with a reason), then once the items arrive use “Receive and refund”.',
      },
      {
        title: 'Create orders yourself',
        body: 'Use “Draft orders” → “Create order” for phone or wholesale sales, then “Send invoice” for the customer to pay online, or “Mark as paid”.',
      },
    ],
    tips: ['“Export” on the Orders page downloads the current view as CSV.'],
    features: ['orders', 'payments'],
  },
  {
    slug: 'multi-currency',
    title: 'Sell in more currencies',
    summary: 'Enable currencies with your own exchange rates and rounding.',
    icon: 'globe',
    category: 'Running your store',
    intro:
      'Shoppers can switch currency on your storefront and pay in it. Your reports stay in your store currency.',
    where: 'Settings → Currencies',
    steps: [
      {
        title: 'Open Currencies',
        body: 'Go to “Settings” → “Currencies”. The “Selling in other currencies” card lists the currencies you can add.',
      },
      {
        title: 'Enable a currency and set its rate',
        body: 'Tick the currency and enter its “Rate” per 1 unit of your store currency (for example 0.92).',
      },
      {
        title: 'Choose rounding',
        body: 'Pick “Price rounding”: “Exact”, “Whole units” or “Charm” (prices ending in .99). Click “Save currencies”.',
      },
    ],
    tips: [
      'Gift cards and draft orders always use your store currency.',
      'Currencies your payment gateway cannot charge are refused when you save.',
    ],
    features: ['international'],
  },
  {
    slug: 'invite-staff',
    title: 'Invite staff and turn on 2FA',
    summary: 'Give your team the access they need and protect your sign-in.',
    icon: 'users',
    category: 'Running your store',
    intro:
      'Admins can do everything except manage staff and billing; staff get only the permissions you tick.',
    where: 'Settings → Staff and Account security',
    steps: [
      {
        title: 'Send an invitation',
        body: 'In “Settings” → “Staff”, use “Invite staff”: enter the “Email”, choose a “Role” and, for staff, tick their permissions (for example orders:read and orders:write). Click “Send invitation”.',
      },
      {
        title: 'Adjust access later',
        body: 'Under “Members”, change a person’s role or permissions and click “Update access”, or remove them from the store. Revoke unused invitations under “Pending invitations”.',
      },
      {
        title: 'Turn on two-factor authentication',
        body: 'Click your email in the top bar to open “Account security”. Click “Set up two-factor authentication”, add the key to your authenticator app, enter the “6-digit code” and click “Turn on”.',
      },
    ],
    tips: [
      'Staff can never grant more access than they hold themselves.',
      'Settings → “Audit log” shows who changed what.',
    ],
    features: ['staff-security'],
  },
  {
    slug: 'api-and-webhooks',
    title: 'Create API tokens and webhooks',
    summary: 'Connect other systems with Admin API tokens and signed webhooks.',
    icon: 'code',
    category: 'Advanced',
    intro:
      'Tokens give an integration access to one store with the permissions you choose. Webhooks notify your systems when things happen.',
    where: 'Settings → Developer',
    steps: [
      {
        title: 'Create an access token',
        body: 'In “Settings” → “Developer”, under “Admin API access tokens”, enter a “Token name”, tick its “Permissions” and click “Create token”. Copy the token now — it is shown only once.',
      },
      {
        title: 'Add a webhook',
        body: 'Under “Webhooks”, choose an “Event” (such as orders/paid, orders/fulfilled, refunds/created or products/updated), enter your endpoint “URL” and click “Add webhook”. Store the signing secret now — it is shown only once.',
      },
      {
        title: 'Verify deliveries',
        body: 'Check the x-commerce-hmac-sha256 header on each request: a base64 HMAC-SHA256 of the body using your signing secret. Each webhook shows its last five deliveries.',
      },
      {
        title: 'Explore the API',
        body: 'Browse the OpenAPI documentation for every endpoint, then call the API with your token.',
      },
    ],
    tips: [
      'A token can only hold permissions you have yourself.',
      'Failed deliveries are retried; a webhook that keeps failing is disabled until you click “Enable”.',
    ],
    features: ['developers'],
  },
];

export function findGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

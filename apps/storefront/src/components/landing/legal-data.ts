/**
 * The platform's legal documents. Written to describe what the software actually does (cookies,
 * data, payment providers); the operator should have them reviewed for their jurisdiction and add
 * their legal entity details before launch.
 */

export type LegalBlock =
  string | { list: string[] } | { table: { head: string[]; rows: string[][] } } | { note: string };

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  /** One line for the legal hub and the page description. */
  summary: string;
  updated: string;
  sections: LegalSection[];
}

export const LEGAL_UPDATED = '24 October 2026';

const terms: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  summary: 'The agreement between you and Commerce Platform when you create and run a store.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'agreement',
      title: 'About these terms',
      blocks: [
        'These Terms of Service (“Terms”) govern your use of Commerce Platform — the website, the merchant admin, the storefronts we host for you and the API (together, the “Service”). By creating an account or using the Service you agree to these Terms. If you use the Service on behalf of a business, you confirm you are authorised to accept them for that business.',
        'Our Privacy Policy, Cookie Policy, Acceptable Use Policy, Billing & Refund Policy and Data Processing terms form part of these Terms.',
      ],
    },
    {
      id: 'account',
      title: 'Your account',
      blocks: [
        'You must be at least 18 years old and give accurate information when you sign up. You are responsible for everything done with your account and for keeping your password and any two-factor authentication device safe. Tell us straight away if you think someone else has accessed your account.',
        {
          list: [
            'Each store has an owner, who can invite staff and choose what each staff member may do.',
            'API access tokens act on your behalf; keep them secret and revoke any you no longer need.',
            'We may suspend sign-in after repeated failed attempts to protect your account.',
          ],
        },
      ],
    },
    {
      id: 'your-store',
      title: 'Your store and your content',
      blocks: [
        'You own the products, images, pages, customer lists and other content you put into the Service (“Your Content”). You give us a licence to host, copy, display and process Your Content only as needed to run the Service for you — for example to show your storefront, resize your images and send your order emails.',
        'You are the seller to your customers. You are responsible for your products, prices, taxes, shipping, refunds, the policies shown on your store, and for complying with the laws that apply to your business, including consumer, tax and data-protection laws.',
      ],
    },
    {
      id: 'payments',
      title: 'Payments from your customers',
      blocks: [
        'Card payments from your customers are processed by the payment provider you connect (Stripe or Razorpay) under your own agreement with that provider. Card details are entered on the provider’s hosted page and never pass through or are stored on our servers. Payouts go from the provider to your own account; we do not hold your funds.',
        'Disputes, chargebacks and provider fees are between you and your payment provider. We show their status in your admin where the provider tells us about them.',
      ],
    },
    {
      id: 'plans',
      title: 'Plans, fees and trials',
      blocks: [
        'Plans, their limits and the platform fee on sales are shown on our pricing page. New stores start with a 14-day trial. Prices may change; we will tell you in advance and the new price applies from your next billing period. See the Billing & Refund Policy for details.',
      ],
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      blocks: [
        'You must follow our Acceptable Use Policy. In short: do not sell illegal or dangerous goods, mislead customers, infringe others’ rights, send spam, or attack or overload the Service.',
      ],
    },
    {
      id: 'availability',
      title: 'Availability and changes',
      blocks: [
        'We work to keep the Service available and secure, but we do not promise it will be uninterrupted or error-free. We may improve, change or remove features. If we remove something significant that you rely on, we will tell you in advance where we reasonably can.',
      ],
    },
    {
      id: 'suspension',
      title: 'Suspension and closing your store',
      blocks: [
        'You can close your store at any time. We may suspend or close a store that breaks these Terms or the Acceptable Use Policy, that puts customers or the Service at risk, or when the law requires it. Where it is safe and lawful to do so, we will explain why and give you a chance to fix the problem.',
        'Before you close your store you can export your catalog as CSV and download your data. After closing, we delete store data within a reasonable period, except where we must keep records by law (for example invoices).',
      ],
    },
    {
      id: 'ip',
      title: 'Our intellectual property',
      blocks: [
        'The Service, its software, templates and branding belong to us or our licensors. You may use the templates to build and run your store on the Service. You may not copy, resell or reverse-engineer the Service except where the law allows it.',
      ],
    },
    {
      id: 'liability',
      title: 'Disclaimers and liability',
      blocks: [
        'The Service is provided “as is”. To the extent the law allows, we are not liable for indirect or consequential losses, lost profits or lost data, and our total liability for any claim is limited to the fees you paid us in the 12 months before the claim. Nothing in these Terms limits liability that cannot be limited by law.',
        'You agree to cover our reasonable costs if a third party makes a claim against us because of Your Content, your products or your breach of these Terms.',
      ],
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      blocks: [
        'We may update these Terms. We will post the new version here with a new “last updated” date and, for material changes, tell store owners by email or in the admin before they take effect. Continuing to use the Service after that means you accept the updated Terms.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: ['Questions about these Terms? Contact us using the details below.'],
    },
  ],
};

const privacy: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  summary: 'What personal data we collect, why, how long we keep it and the choices you have.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'scope',
      title: 'Who this policy covers',
      blocks: [
        'This policy explains how Commerce Platform (“we”) handles personal data about merchants and their staff who use our admin, and about visitors to this website.',
        {
          note: 'Shoppers on a store: the merchant who runs the store decides how your data is used and is responsible for it. We process it on their behalf, as described in our Data Processing terms. Contact the store directly about your data; we will help them respond.',
        },
      ],
    },
    {
      id: 'collect',
      title: 'What we collect',
      blocks: [
        {
          table: {
            head: ['Data', 'Examples', 'Why'],
            rows: [
              [
                'Account details',
                'Name, email address, password (stored only as an Argon2id hash)',
                'To create your account, sign you in and contact you about it',
              ],
              [
                'Security data',
                'Encrypted two-factor secret, failed sign-in count, session IP address and browser',
                'To protect your account and show you your active sessions',
              ],
              [
                'Store data',
                'Store name, settings, products, pages, staff and invitations',
                'To run your store',
              ],
              [
                'Billing data',
                'Plan, subscription status and platform invoices',
                'To charge for your plan and keep financial records',
              ],
              [
                'Activity logs',
                'Audit entries of changes made in the admin',
                'To show you who changed what, and to investigate abuse',
              ],
              ['Messages', 'Emails you send to support', 'To answer you'],
            ],
          },
        },
        'We do not receive or store payment card numbers: they are entered on Stripe’s or Razorpay’s hosted page. We do not use advertising or cross-site tracking cookies.',
      ],
    },
    {
      id: 'legal-bases',
      title: 'Why we may use it',
      blocks: [
        {
          list: [
            'To provide the Service you signed up for (performance of our contract with you).',
            'To keep the Service secure and prevent fraud and abuse (our legitimate interests).',
            'To meet legal obligations, such as keeping invoices and responding to lawful requests.',
            'Where you have given consent — for example to a product newsletter — you can withdraw it at any time.',
          ],
        },
      ],
    },
    {
      id: 'sharing',
      title: 'Who we share it with',
      blocks: [
        'We do not sell personal data. We share it only with service providers who help us run the Service, under contracts that require them to protect it:',
        {
          list: [
            'Hosting and database providers that store the Service’s data.',
            'An email delivery provider that sends account, order and notification emails.',
            'Stripe or Razorpay, when you connect them to take payments or pay for your plan.',
            'Professional advisers, and authorities where the law requires it.',
          ],
        },
      ],
    },
    {
      id: 'retention',
      title: 'How long we keep it',
      blocks: [
        'We keep account and store data for as long as your account is open. Sessions expire automatically and single-use links (password reset, email verification) expire after a short time. When you close your store we delete its data within a reasonable period, except records we must keep by law, such as invoices.',
      ],
    },
    {
      id: 'security',
      title: 'How we protect it',
      blocks: [
        {
          list: [
            'Each store’s data is isolated at the database level with row-level security.',
            'Passwords are hashed with Argon2id; two-factor secrets and payment credentials are encrypted.',
            'Connections use HTTPS, and pages send a strict Content Security Policy.',
            'Staff only get the permissions their store owner grants them.',
          ],
        },
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      blocks: [
        'Depending on where you live (for example under the GDPR, the UK GDPR, India’s Digital Personal Data Protection Act or US state privacy laws) you may have the right to access, correct, delete or export your personal data, to object to or restrict some uses, and to withdraw consent. You can update most details yourself in the admin. For anything else, contact us; we will respond within the time the law requires. You can also complain to your local data-protection authority.',
      ],
    },
    {
      id: 'transfers',
      title: 'International transfers',
      blocks: [
        'Our providers may process data in countries other than yours. Where the law requires it we use appropriate safeguards, such as standard contractual clauses.',
      ],
    },
    {
      id: 'children',
      title: 'Children',
      blocks: [
        'The merchant admin is for people aged 18 and over. We do not knowingly collect personal data from children.',
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      blocks: [
        'We will post any changes here with a new “last updated” date, and tell store owners about significant changes.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: [
        'To ask about your data or exercise your rights, contact us using the details below.',
      ],
    },
  ],
};

const cookies: LegalDoc = {
  slug: 'cookies',
  title: 'Cookie Policy',
  summary:
    'The small number of essential cookies we use, what each one does and how long it lasts.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'summary',
      title: 'The short version',
      blocks: [
        'We only use cookies that are strictly necessary for the Service to work — to keep you signed in, remember your cart and currency, and protect password-protected stores. We do not use analytics, advertising or cross-site tracking cookies, so we do not ask for consent to them.',
      ],
    },
    {
      id: 'admin',
      title: 'Cookies in the merchant admin',
      blocks: [
        {
          table: {
            head: ['Name', 'Purpose', 'Lasts'],
            rows: [
              [
                'admin_session',
                'Keeps you signed in to your admin',
                'Until you sign out or the session expires',
              ],
              [
                'start_template',
                'Remembers the template you picked before signing up',
                '7 days, or until your store is created',
              ],
            ],
          },
        },
      ],
    },
    {
      id: 'stores',
      title: 'Cookies on stores we host',
      blocks: [
        {
          table: {
            head: ['Name', 'Purpose', 'Lasts'],
            rows: [
              ['cart_token', 'Remembers the shopper’s cart', '30 days'],
              [
                'customer_session',
                'Keeps a customer signed in to their account',
                'Until they sign out or the session expires',
              ],
              ['currency', 'Remembers the currency the shopper chose', '1 year'],
              ['storefront_access', 'Lets a visitor into a password-protected store', '30 days'],
              [
                'theme_preview',
                'Shows a template preview the visitor asked for',
                'Until the browser is closed',
              ],
            ],
          },
        },
        'Stores cannot load third-party scripts: every store page sends a Content Security Policy that only allows our own code, so no tracking cookies can be added to them.',
      ],
    },
    {
      id: 'local-storage',
      title: 'Local storage',
      blocks: [
        'This website stores one value in your browser’s local storage to remember that you have dismissed the cookie notice. It is never sent to our servers.',
      ],
    },
    {
      id: 'control',
      title: 'Controlling cookies',
      blocks: [
        'You can block or delete cookies in your browser settings. Because ours are essential, blocking them will stop sign-in, carts and currency selection from working.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: ['Questions about cookies? Contact us using the details below.'],
    },
  ],
};

const acceptableUse: LegalDoc = {
  slug: 'acceptable-use',
  title: 'Acceptable Use Policy',
  summary: 'What you may not sell or do on Commerce Platform, and what happens if you do.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'prohibited-goods',
      title: 'Goods and services you may not sell',
      blocks: [
        {
          list: [
            'Anything illegal where you or your customers are, or goods that need a licence you do not hold.',
            'Weapons, explosives, illegal drugs and drug paraphernalia, and prescription medicines without authorisation.',
            'Counterfeit or stolen goods, or goods that infringe someone else’s trademark, copyright or other rights.',
            'Content that sexually exploits children, promotes violence or hatred, or harasses people.',
            'Unlicensed gambling, pyramid schemes and other deceptive money-making offers.',
          ],
        },
        'Your payment provider may restrict further categories; you must also follow their rules.',
      ],
    },
    {
      id: 'conduct',
      title: 'How you may not use the Service',
      blocks: [
        {
          list: [
            'Misleading customers about products, prices, delivery or refunds.',
            'Sending spam, or emailing people who have not agreed to hear from you.',
            'Collecting card details or passwords outside the checkout the Service provides.',
            'Probing, scanning or testing the Service’s security without our written permission, or trying to access other stores’ data.',
            'Overloading the Service, or using the API in ways that get around rate limits.',
          ],
        },
      ],
    },
    {
      id: 'enforcement',
      title: 'What we do about breaches',
      blocks: [
        'We may remove content, limit features, or suspend or close a store that breaks this policy. Where it is safe and lawful, we will tell you what is wrong and how to fix it.',
      ],
    },
    {
      id: 'report',
      title: 'Reporting a problem',
      blocks: [
        'To report a store that breaks this policy, or a security issue, contact us using the details below with the store address and what you found.',
      ],
    },
  ],
};

const billing: LegalDoc = {
  slug: 'billing',
  title: 'Billing & Refund Policy',
  summary: 'How plans are charged, the platform fee on sales, trials, cancellations and refunds.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'plans',
      title: 'Plans and the platform fee',
      blocks: [
        'Each plan has a monthly price and a platform fee on sales, both shown on the pricing page in US dollars. Every feature is included on every plan; plans differ in their limits and fee. Payment providers charge their own processing fees separately.',
      ],
    },
    {
      id: 'trial',
      title: 'Free trial',
      blocks: [
        'New stores start with a 14-day trial. Choose a plan before the trial ends to keep selling.',
      ],
    },
    {
      id: 'charges',
      title: 'Invoices and payment',
      blocks: [
        'Plan charges are billed in advance for each billing period and appear as platform invoices in your admin. If a payment fails we will let you know; a store with unpaid invoices may be limited until they are paid.',
      ],
    },
    {
      id: 'changes',
      title: 'Changing or cancelling your plan',
      blocks: [
        'You can change plan at any time from your admin; the new plan applies from your next billing period. You can cancel at any time and your store keeps working until the end of the period you have paid for.',
      ],
    },
    {
      id: 'refunds',
      title: 'Refunds',
      blocks: [
        'Plan charges are not refundable for partly used periods, except where the law requires a refund or where we charged you in error. Platform fees on sales are not refunded when you refund an order, unless the law requires it.',
        {
          note: 'Refunds to your customers for their orders are handled by you from your admin and paid back through your payment provider.',
        },
      ],
    },
    {
      id: 'taxes',
      title: 'Taxes',
      blocks: [
        'Prices do not include taxes such as VAT or GST unless shown otherwise; we add them where the law requires.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: ['Questions about a charge? Contact us using the details below.'],
    },
  ],
};

const dpa: LegalDoc = {
  slug: 'data-processing',
  title: 'Data Processing Terms',
  summary: 'How we process your customers’ personal data on your behalf as your processor.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'roles',
      title: 'Roles',
      blocks: [
        'For the personal data of your customers (shoppers) that you collect through your store, you are the controller and we are your processor. These terms apply to that data and form part of our Terms of Service.',
      ],
    },
    {
      id: 'instructions',
      title: 'Processing on your instructions',
      blocks: [
        'We process customer data only to provide the Service as you configure it — for example to take orders, send order and account emails, run discounts and segments, and show reports — and as the law requires.',
        {
          table: {
            head: ['Data subjects', 'Data', 'Purpose'],
            rows: [
              [
                'Your customers',
                'Name, email, addresses, phone, order history, marketing preference, account password (hashed)',
                'Orders, delivery, customer accounts, returns and marketing you choose to send',
              ],
              [
                'Your staff',
                'Name, email, permissions, activity log entries',
                'Admin access and audit trail',
              ],
            ],
          },
        },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      blocks: [
        'We protect customer data with database-level isolation between stores, encryption of secrets, hashed passwords, HTTPS and access limited to what is needed to run and support the Service.',
      ],
    },
    {
      id: 'subprocessors',
      title: 'Sub-processors',
      blocks: [
        'We use hosting, database and email-delivery providers to run the Service, and the payment provider you connect. We require them to protect the data to the same standard and will tell you before adding new sub-processors.',
      ],
    },
    {
      id: 'assistance',
      title: 'Helping you meet your obligations',
      blocks: [
        'You can view, edit, export and delete customer records from your admin. We will help you respond to requests from your customers and to regulators, and tell you without undue delay if we become aware of a personal-data breach affecting your store.',
      ],
    },
    {
      id: 'deletion',
      title: 'Deletion',
      blocks: [
        'When you close your store we delete its customer data within a reasonable period, unless the law requires us to keep it.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: ['For data-protection questions, contact us using the details below.'],
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [terms, privacy, cookies, acceptableUse, billing, dpa];

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

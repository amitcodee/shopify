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

export const LEGAL_UPDATED = '17 November 2026';

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
        'Our Privacy Policy, Cookie Policy, Acceptable Use Policy, Billing & Refund Policy, Service Delivery Policy, Data Processing Terms, Intellectual Property Policy and Grievance Redressal Policy form part of these Terms.',
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
        'Plans and their prices are shown on our pricing page. New stores start with a 7-day free trial and we take no fee on your sales. Prices may change; we will tell you in advance and the new price applies from your next billing period. See the Billing & Refund Policy for details.',
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
        'Before you close your store you can export your catalog as CSV and download your data. Closing takes the storefront offline and stops your subscription. For 30 days you can reopen the store from your admin; after that we permanently delete its data, except records we must keep by law (for example our invoices to you).',
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
            'Razorpay, which collects plan payments, and the payment gateway you choose for your store.',
            'An AI provider, only when you ask the theme assistant for a design change (it receives your store name, theme settings and request, never customer data).',
            'Professional advisers, and authorities where the law requires it.',
          ],
        },
        'The current list of providers, what each receives and where, is on our Sub-processors page.',
      ],
    },
    {
      id: 'retention',
      title: 'How long we keep it',
      blocks: [
        'We keep account and store data for as long as your account is open. Sessions expire automatically and single-use links (password reset, email verification) expire after a short time. When you close your store we permanently delete its data 30 days later, except records we must keep by law, such as invoices.',
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
              [
                'theme_draft',
                'Shows unpublished theme changes inside the store owner’s theme editor only (a partitioned cookie that does not exist outside the editor)',
                '2 hours',
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
        'This website and the merchant admin use your browser’s local storage for two small preferences: whether you have dismissed the cookie notice, and whether you chose the light or dark theme. They are never sent to our servers.',
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
  summary:
    'How plans are charged, trials, the introductory price, failed payments, cancellations and refunds.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'plans',
      title: 'Plans and prices',
      blocks: [
        'Each plan has a monthly price, shown on the pricing page in Indian rupees. We take no fee on your sales, whichever payment gateway you connect and including cash on delivery. Payment providers charge their own processing fees separately.',
        'Where a plan has an introductory price (for example ₹99 a month for the first 3 months, then ₹799 a month), it applies once per store, to its first paid months.',
      ],
    },
    {
      id: 'trial',
      title: 'Free trial',
      blocks: [
        'New stores start with a 7-day free trial; no card or UPI mandate is needed to start. You can subscribe at any time during the trial and the first charge happens when the trial ends. If the trial ends without a subscription, the storefront goes offline and the admin shows only billing until you subscribe; your data is kept.',
      ],
    },
    {
      id: 'charges',
      title: 'Invoices and payment',
      blocks: [
        'Plans are charged monthly in advance through a UPI AutoPay or card mandate you authorise with our payment provider (Razorpay). Every charge appears as an invoice in your admin.',
        'If a payment fails, the provider retries it and your store keeps working for a grace period of 7 days. If it is still unpaid after that, the storefront goes offline until the payment is made or the payment method is updated.',
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
        'Plan charges are not refundable for partly used periods, except where the law requires a refund or where we charged you in error.',
        {
          note: 'Refunds to your customers for their orders are handled by you from your admin and paid back through your payment provider.',
        },
      ],
    },
    {
      id: 'taxes',
      title: 'Taxes',
      blocks: ['Prices are shown in Indian rupees and are inclusive of all taxes.'],
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
        'We use hosting, database and email-delivery providers to run the Service, and the payment provider you connect. We require them to protect the data to the same standard and will tell you before adding new sub-processors. The current list is on our Sub-processors page.',
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

const serviceDelivery: LegalDoc = {
  slug: 'service-delivery',
  title: 'Service Delivery Policy',
  summary:
    'How and when the Service is delivered. We sell software online; nothing is shipped to you.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'digital',
      title: 'A digital service',
      blocks: [
        'Commerce Platform is software provided online. We do not ship any physical goods to merchants, so there are no shipping charges, couriers or delivery addresses involved in buying a plan.',
      ],
    },
    {
      id: 'when',
      title: 'When you get access',
      blocks: [
        {
          list: [
            'Your store and admin are ready as soon as you verify your email address, usually within a minute of signing up.',
            'A plan you subscribe to is active as soon as the payment provider confirms your mandate or first payment. Confirmation is shown in your admin and an invoice appears under Billing.',
            'If access does not start within 24 hours of a successful payment, contact us and we will activate it or refund the charge.',
          ],
        },
      ],
    },
    {
      id: 'store-orders',
      title: 'Orders placed on your store',
      blocks: [
        'Shipping and delivery of the products you sell are between you and your customers. Each store publishes its own shipping policy, which store owners set in their admin.',
      ],
    },
    {
      id: 'availability',
      title: 'Availability',
      blocks: [
        'We aim to keep the Service available at all times, apart from planned maintenance that we announce in the admin in advance. Availability is described further in our Terms of Service.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: ['Questions about access to your plan? Contact us using the details below.'],
    },
  ],
};

const subprocessors: LegalDoc = {
  slug: 'subprocessors',
  title: 'Sub-processors',
  summary: 'The service providers that process personal data for us, what they receive and why.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'about',
      title: 'About this list',
      blocks: [
        'To run the Service we use a small number of third-party providers. Each is bound by a contract requiring it to protect personal data and use it only to provide its service to us. Payment gateways that you connect to your store (Razorpay, PayU, Cashfree, PhonePe, Stripe or PayPal) are your own providers, chosen and contracted by you, and are not listed here.',
      ],
    },
    {
      id: 'list',
      title: 'Current sub-processors',
      blocks: [
        {
          table: {
            head: ['Provider', 'What it does', 'Data it receives'],
            rows: [
              [
                'Cloud hosting provider',
                'Runs the servers, database and file storage for the Service',
                'All Service data, encrypted in transit',
              ],
              [
                'Razorpay Software Pvt Ltd (India)',
                'Collects plan payments and UPI AutoPay or card mandates',
                'Store owner name, email, phone and the payment details entered at Razorpay checkout',
              ],
              [
                'Postmark by ActiveCampaign (USA)',
                'Delivers account, order and notification emails',
                'Recipient name and email address, email content',
              ],
              [
                'Anthropic PBC (USA)',
                'Powers the optional AI theme assistant',
                'Store name, theme settings and the request the merchant types; never customer data',
              ],
              [
                'Sentry, Functional Software Inc (USA)',
                'Error monitoring, when enabled',
                'Technical error details; personal data is minimised and not intentionally sent',
              ],
            ],
          },
        },
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this list',
      blocks: [
        'We update this page before a new sub-processor starts handling personal data, and tell store owners about significant changes by email or in the admin. If you object to a new sub-processor on reasonable data-protection grounds, contact us and we will work with you to address it; if we cannot, you may close your store.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: ['Questions about sub-processors? Contact us using the details below.'],
    },
  ],
};

const intellectualProperty: LegalDoc = {
  slug: 'intellectual-property',
  title: 'Intellectual Property Policy',
  summary:
    'How to report a store that infringes your copyright or trademark, and how merchants can respond.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'approach',
      title: 'Our approach',
      blocks: [
        'Merchants must only sell goods and use images, text, names and logos they have the right to use. We act on valid reports of infringement under the Copyright Act, 1957, the Trade Marks Act, 1999 and the IT Rules, 2021. We host stores; we do not decide disputes between rights holders and merchants, and a court order prevails over this process.',
      ],
    },
    {
      id: 'report',
      title: 'Reporting infringement',
      blocks: [
        'Email the Grievance Officer (details below) with:',
        {
          list: [
            'Your name and contact details, and whether you are the rights holder or act for them.',
            'The work or trademark you own, with a registration number or other proof where you have it.',
            'The exact store pages (URLs) that infringe it.',
            'A statement that you believe in good faith the use is not authorised, and that the information in your report is accurate.',
          ],
        },
        'Incomplete reports may delay action. Knowingly false reports can make you liable for the harm they cause.',
      ],
    },
    {
      id: 'action',
      title: 'What we do',
      blocks: [
        'When a report is complete we may remove or disable the reported content and tell the merchant, sharing your report (including your contact details, so the two of you can resolve it directly). Stores that repeatedly infringe may be suspended or closed under our Acceptable Use Policy.',
      ],
    },
    {
      id: 'counter',
      title: 'If your content was removed',
      blocks: [
        'If you are a merchant and believe content was removed by mistake, or that you are authorised to use it, reply to our notice with your explanation and evidence. We will pass it to the person who reported it and may restore the content unless they tell us they have started legal proceedings.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      blocks: ['Send reports to the Grievance Officer using the details below.'],
    },
  ],
};

const grievance: LegalDoc = {
  slug: 'grievance',
  title: 'Grievance Redressal Policy',
  summary:
    'How to raise a complaint with our Grievance Officer, and how quickly we acknowledge and resolve it.',
  updated: LEGAL_UPDATED,
  sections: [
    {
      id: 'scope',
      title: 'What this covers',
      blocks: [
        'This policy explains how merchants, shoppers and anyone else can raise a complaint about the Service, content hosted on it, or how we handle personal data. It is published under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the Consumer Protection (E-Commerce) Rules, 2020 and the Digital Personal Data Protection Act, 2023.',
        {
          note: 'A complaint about an order (delivery, a refund, a faulty product) should go first to the store you bought from. Every store lists its contact details and policies on its pages. Escalate to us if the store does not respond.',
        },
      ],
    },
    {
      id: 'how',
      title: 'How to complain',
      blocks: [
        'Email our Grievance Officer (details below) with:',
        {
          list: [
            'Your name and a way to reach you.',
            'The store address or page the complaint is about, if any.',
            'What happened, with dates, order numbers and screenshots where useful.',
            'What you would like us to do.',
          ],
        },
      ],
    },
    {
      id: 'timelines',
      title: 'Our timelines',
      blocks: [
        {
          table: {
            head: ['Step', 'When'],
            rows: [
              ['We acknowledge your complaint', 'Within 24 hours'],
              ['We resolve it, or explain what we will do', 'Within 15 days of receipt'],
              [
                'Removal of content that exposes someone’s private areas or impersonates them',
                'Within 24 hours of the complaint, as the IT Rules require',
              ],
            ],
          },
        },
        'Our acknowledgement gives your complaint a reference number. If you are not satisfied with the outcome, you may approach the appropriate authority, such as the National Consumer Helpline (dial 1915, or consumerhelpline.gov.in) or the Data Protection Board of India.',
      ],
    },
    {
      id: 'contact',
      title: 'Grievance Officer',
      blocks: ['The Grievance Officer’s name and contact details are below.'],
    },
  ],
};

export const LEGAL_DOCS: LegalDoc[] = [
  terms,
  privacy,
  cookies,
  acceptableUse,
  billing,
  serviceDelivery,
  dpa,
  subprocessors,
  intellectualProperty,
  grievance,
];

export function findLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

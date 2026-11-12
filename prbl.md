# Project audit: limitations aur improvement plan

**Date:** 2026-11-04. Yeh read-only audit hai: code, docs aur data model padhe gaye, koi code nahi badla.

**Verdict:** engineering base strong hai, lekin product abhi real SaaS business ke roop mein launch-ready
nahi hai. Sabse badi kami feature ki nahi hai: paisa kamane ka model, production infrastructure aur India
ke operations abhi adhure hain.

Table ke facts code se confirm kiye hain. Timelines mere andaze hain, aur market aur priority ki baatein
meri rai hain.

## Launch se pehle zaroori

| #   | Problem                                       | Evidence                                                                                                                    | Kyun serious hai                                                                               |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Platform ki kamai ka rasta band ho sakta hai  | Starter plan $0 hai; apne gateway par fee 0 hai                                                                             | Free plan + apna gateway ya COD = merchant kabhi kuch nahi deta. Yeh hole gateway kaam se aaya |
| 2   | COD plan limit se bach jaata hai              | Monthly quota sirf `paidAt` wale orders ginta hai                                                                           | "Cash received" na dabane par order limit mein nahi ginta                                      |
| 3   | COD par fake orders ka risk                   | Pending-order cap COD par lagta nahi, OTP nahi hai                                                                          | Fake orders stock ko bina time limit ke rok sakte hain                                         |
| 4   | Billing adhuri hai                            | Real billing sirf Stripe par hai, failed-payment event hi nahi; mock provider trial khatam hone par plan chalu kar deta hai | Payment fail hone par koi dunning nahi; Indian merchants ke liye Razorpay billing bhi nahi     |
| 5   | Legal page jo kehta hai, woh feature nahi hai | Terms mein "close your store" aur data delete likha hai, par code mein store delete nahi hai                                | Yeh legal aur compliance risk hai                                                              |
| 6   | Images sirf local disk par                    | Sirf `LocalDiskStorage` hai, S3 ya CDN nahi                                                                                 | Doosra server add nahi ho sakta                                                                |
| 7   | Ek hi server par sab kuch                     | Compose mein Postgres, API aur Caddy ek host par hain                                                                       | Server gira to saare stores band                                                               |
| 8   | Errors aur metrics ka tool nahi               | Sentry ya metrics kahin nahi; runbook alerts sirf list karta hai                                                            | Production bug ka pata customer se chalega                                                     |
| 9   | 2 high security advisories                    | Express ke zariye `body-parser` aur `multer`                                                                                | CI ka `pnpm audit --audit-level high` fail hona chahiye                                        |
| 10  | Key rotation runbook purana hai               | Runbook sirf 2FA secrets ka zikr karta hai                                                                                  | Key badalne se saare connected gateways toot jayenge                                           |

Ek aur chhoti cheez: marketing site par PayU, PhonePe aur COD ka zikr hi nahi hai.

## Feature gaps

### India mein bechne ke liye (sabse zaroori)

- GST invoice, GSTIN aur HSN nahi hain.
- Shiprocket ya Delhivery jaisa courier integration, AWB aur live tracking nahi hai.
- COD ke liye OTP, RTO tracking aur extra charge nahi hai.
- WhatsApp aur SMS order updates nahi hain; WhatsApp abhi sirf chat button hai.
- Pricing sirf USD mein hai.

### Sales badhane ke liye

- Product reviews aur wishlist nahi hain.
- Meta Pixel aur GA4 nahi hain. Visitor ya conversion analytics bhi nahi hai, isliye merchant ko conversion
  rate nahi dikhta.
- Discounts sirf 3 type ke hain: automatic, BOGO aur product-specific nahi hain.
- Product description sirf plain text hai.
- Email campaigns, loyalty aur referral nahi hain.
- URL redirects aur search suggestions nahi hain.
- Storefront ek hi language mein hai.

### Platform aur scale ke liye

- Asli app marketplace nahi hai; abhi sirf 5 built-in apps hain.
- Migration sirf product CSV se hoti hai; customers aur orders import nahi hote.
- Support impersonation, POS, subscription products, B2B aur digital products nahi hain.
- Storefront API calls `no-store` hain, aur rate limit har request par database mein likhta hai. Traffic
  badhne par yeh bottleneck ban sakte hain.

## Jo pehle se strong hai

- Tenant isolation (RLS), hosted checkout aur security review
- Inventory, returns aur multi-location
- 41 API test files aur browser tests
- Templates aur admin UI

Inhe abhi dobara banane ki zaroorat nahi hai.

## Roadmap (suggestion)

### Phase 0: launch blockers (1–2 hafte)

1. Monetization fix: free plan ki limits aur own-gateway ka plan rule
2. COD: quota mein ginna, per-phone limit, auto-expiry
3. Close store aur data delete
4. S3 + CDN, Sentry, managed Postgres
5. Advisories aur runbook fix

### Phase 1: India wedge (4–6 hafte)

1. INR pricing aur Razorpay subscription billing, dunning ke saath
2. GST invoices
3. Shiprocket integration
4. COD OTP aur WhatsApp updates
5. Live gateway rehearsal

### Phase 2: merchants ki sales badhana (4–6 hafte)

1. Pixels aur conversion analytics
2. Reviews
3. Rich text editor
4. Automatic discounts
5. Shopify se poora import

### Phase 3: moat

1. Third-party app platform
2. AI product copy aur store setup
3. POS aur subscription products

## Pehle din se track karne wale metrics

- Signup se first sale ka time
- Trial se paid conversion
- Churn
- Har store ka GMV

Platform console abhi MRR aur GMV to dikhata hai, par activation funnel nahi. Fake reviews ya bade numbers
marketing mein mat dalna; asli merchants ke case studies zyada kaam aayenge.

## Decisions baaki hain

1. **Target market:** kya focus India ke chhote D2C sellers par rakhein? Suggestion: haan. Shopify se seedha
   global takkar mushkil hai, aur GST, COD, Shiprocket aur WhatsApp yahan asli fark banayenge. Global rakhne
   par Phase 1 badal jayega.
2. **Revenue model:** free plan par kya rule rahe? Suggestion: free plan sirf trial ya chhoti limit ke liye
   ho, aur apna gateway paid plan par mile. Isse signups thode ghat sakte hain, par kamai ka hole band hoga.
   test key - rzp_test_TzCvEgDgNcfhxf
   test key secrate - CqFsT9MHnET7qudavTVrOUpf

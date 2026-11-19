# ADR 0016: Product reviews

## Context

Shoppers expect star ratings and reviews on product pages, and search engines show ratings from
`AggregateRating` markup. Review widgets are easy to fill with fake or unverifiable reviews, which
misleads shoppers and breaks consumer-protection rules (India's 2022 standard on online reviews,
the FTC rule in the US). The platform must not invent reviews, and merchants should not be able to
post them as customers.

## Decision

- A first-party store app, **Product reviews** (`apps.productReviews`: `enabled`, `autoPublish`),
  off by default. With it off, the review endpoints return 404 and no rating is shown anywhere.
- Only a signed-in customer with a paid, not cancelled order holding the product can review it
  (`ProductReview`, RLS, unique per store + product + customer, tied to that order). Every review is
  shown as "Verified buyer". There is no anonymous or staff-written review.
- One review per customer and product; editing replaces it and sends it back to `PENDING`, unless
  the store publishes automatically. A rejected review cannot be resubmitted.
- Merchants publish, reject (or unpublish), reply in public and delete under **Reviews** in the
  admin. Every change is audited. The page asks merchants not to remove reviews only for being
  negative.
- Published counts are cached on `Product.reviewCount` / `ratingSum` (recounted on every change,
  with a check constraint) so product cards and the product page read them without a join. The
  product page shows stars under the title, a breakdown by stars, the reviews (10 per page) and
  `aggregateRating` in its JSON-LD. Product cards show stars and the count.
- Signing in from the review section returns the shopper to it (`/account/login?next=`; only
  same-store paths are followed).
- Demo data has no reviews: seeding them would be exactly the fake content this avoids.

## Not done

- Photos in reviews, "helpful" votes, sorting and filtering by stars.
- Emailing buyers to ask for a review after delivery.
- Importing reviews from another platform (they could not be verified against orders here).

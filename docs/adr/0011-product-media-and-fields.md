# ADR 0011 — Product media, custom fields and scheduled publishing

- Status: Accepted
- Date: 2026-10-22

## Context

Merchants coming from Shopify expect a richer product model than titles, variants and a single
image upload: galleries uploaded in bulk or pulled from a URL, per-variant images, responsive
image sizes, unit cost and margin, customs data for cross-border shipping, typed custom fields
("metafields") and launches scheduled ahead of time. All of it has to keep the existing
guarantees: tenant isolation (RLS + scoped queries), no merchant HTML or script reaching
shoppers, and no admin-only data (cost) leaking to the storefront.

## Decision

### Images and renditions

- Every image is decoded with sharp (JPEG, PNG, WebP, GIF, AVIF; SVG and anything else is
  refused), up to 20 MB and 50 megapixels. It is rotated by its EXIF orientation, scaled down to
  fit 5000 × 5000 and re-encoded as WebP (quality 82), which also strips EXIF/GPS metadata and
  neutralizes polyglot files. Decode failures are `422`, unsupported formats `415`.
- **Renditions** are generated at upload time at fixed widths (200, 600, 1200, 2048 px; only
  those narrower than the image) and stored next to the original as `<key>_w<width>.webp`. The
  row only records `renditionWidths`; URLs are derived. Fixed widths keep storage bounded and
  make CDN caching trivial (every URL is immutable); on-the-fly resizing would need a resize
  service and cache. Images uploaded before this change simply have no renditions (`[]`).
- Uploads accept up to 10 files per request (`files`), alongside the original single `file`
  field. A request is all-or-nothing: files are processed, stored, then inserted in one
  transaction; on failure the stored objects are deleted again.
- Deleting an image or a product deletes the original and every rendition (after the
  transaction commits; storage failures are logged, never block the delete).
- At most 50 images per product (`409`), checked before any decoding or download and again in
  the inserting transaction.

### Import by URL (SSRF)

- `POST …/images/import` downloads with the same SSRF-safe client as outbound webhooks
  (`safe-http.ts`): https only, no credentials in the URL, every hop's host resolved once and
  refused if any address is loopback, private, link-local, CGNAT, multicast or metadata; the
  connection uses the vetted address (no DNS rebinding). At most 3 redirects, each re-checked.
  15 s for the whole download, 20 MB (declared and actual), and an `image/*` content type (not
  SVG). The bytes then go through the normal image pipeline, so a lying content type is caught
  by the decoder.
- The fetcher is its own provider (`RemoteImageFetcher`) so tests replace the network without
  weakening the guard. CSV `Image Src` columns use the same path.

### Variant images

- `ProductVariant.imageId` is a single-column FK with `ON DELETE SET NULL` (a composite
  `(storeId, imageId)` FK would null `storeId` too). The guarantee composite keys give elsewhere
  is kept by a trigger: a variant may only reference an image of **its own product** (and so its
  own store). The API checks the same rule first to return a clean `400`.

### Cost, customs

- `costPerItem` (minor units, nullable) is admin-only: the admin DTO adds `profit` and `margin`
  (percent of price, one decimal); storefront DTOs, carts and product webhooks are built field by
  field and never include it. `countryOfOrigin` (ISO alpha-2) and `hsCode` (6–10 digits; dots and
  spaces stripped) have CHECK constraints as well as zod validation.
- On product update, omitting `costPerItem`, `countryOfOrigin`, `hsCode` or `imageId` keeps the
  stored value and `null` clears it, so older clients that do not know the fields cannot wipe
  them.

### Metafields

- Typed, not free-form JSON: `single_line_text`, `multi_line_text`, `number_integer`,
  `number_decimal`, `boolean`, `url` (https only), `date`. Values are validated by one shared
  function (`normalizeMetafieldValue` in contracts) and stored as a canonical string ("007" →
  "7", "TRUE" → "true"), so they sort, compare and render predictably and the UI and API agree on
  the rules. Keys are `[a-z0-9_]{1,40}`, unique per product + namespace (default `custom`);
  30 per product.
- Set through the product input with replace semantics (omitted = unchanged). Only fields with
  `showOnStorefront` reach shoppers, as `specs` with a humanized label; values are plain text
  (the storefront escapes them like every other merchant string).

### Scheduled publishing

- `Product.publishedAt` is the go-live time. A product is **live** when it is `ACTIVE` and
  `publishedAt` is null or in the past (`liveProductWhere` / `LIVE_PRODUCT_SQL` /
  `isProductLive`). Every shopper-facing path uses that rule: product page, listings, search,
  collections, sitemap, menu links, adding to carts, cart availability (so checkout refuses the
  line) and abandoned-checkout emails. No background job is needed: visibility is evaluated at
  read time, like scheduled blog posts.
- Input `publishAt`: a time schedules (or backdates), `null` publishes now (clearing a
  schedule), omitted keeps the current time or publishes now when an unpublished product becomes
  `ACTIVE`. The migration back-fills `publishedAt = createdAt` for active products that had none.

### List, facets, bulk

- The admin list is one SQL query (filters: status, vendor, type, tag, collection, text over
  title/vendor/SKU prefix/tag with LIKE wildcards escaped; sorts: updated, created, title, lowest
  price, tracked inventory) followed by a scoped hydration query.
- Bulk actions (≤ 100 products: activate, draft, archive, delete, add/remove tags) run in one
  transaction: all products must belong to the store or nothing changes. Each product gets the
  same audit entry and webhook as the single-item path. None of the actions can create products,
  so product-count plan limits do not apply.

## Consequences

- Storage grows by roughly 1.3× per image for renditions; widths can change later without a
  migration (new uploads only; old images keep their recorded widths).
- The variant limit rose from 100 to 250 (nothing else depended on 100).
- Storefront contract fields added here (`images[].id`, `images[].renditions`,
  `variants[].imageId`, `specs`, card `imageRenditions`) are optional in the schema so older
  storefront builds keep compiling; the API always sends them.

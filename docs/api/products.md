# Products API (admin + storefront)

Reference for UI work on the product editor, product list and storefront product pages. All
admin paths are under `/api/v1/admin/stores/:storeId` and need a session (or Admin API token)
with `products:read` (GET) or `products:write` (everything else). Schemas live in
`@repo/contracts` (`packages/contracts/src/products.ts`, `storefront.ts`); prefer importing
them over re-declaring types.

Errors use RFC 7807 problem details: `{ type, title, status, detail }`, plus `errors[]`
(`{ path, message }`) for validation failures (`400`). Another store's ids are `404` in the
URL and `400` inside a body.

Money is in **minor units** of the store currency (`1999` = 19.99).

## Contents

- [Product object](#product-object)
- [List, filters and facets](#list-filters-and-facets)
- [Create / update](#create--update)
- [Images](#images)
- [Variant image](#variant-image)
- [Bulk actions](#bulk-actions)
- [CSV](#csv)
- [Storefront](#storefront)

## Product object

`GET /products/:productId` → `Product` (also returned by create, update and every image or
variant endpoint, so the editor can replace its state with the response).

```json
{
  "id": "0199…",
  "title": "Linen Shirt",
  "handle": "linen-shirt",
  "description": "Breathable linen.",
  "status": "ACTIVE",
  "vendor": "Atelier",
  "productType": "Shirts",
  "tags": ["summer", "linen"],
  "seoTitle": null,
  "seoDescription": null,
  "isGiftCard": false,
  "options": [{ "name": "Size", "values": ["S", "M"] }],
  "variants": [
    {
      "id": "0199…",
      "title": "S",
      "options": ["S"],
      "sku": "LS-S",
      "barcode": null,
      "price": 4900,
      "compareAtPrice": null,
      "costPerItem": 2100,
      "profit": 2800,
      "margin": 57.1,
      "weightGrams": 250,
      "requiresShipping": true,
      "countryOfOrigin": "PT",
      "hsCode": "620520",
      "taxable": true,
      "trackInventory": true,
      "allowBackorder": false,
      "inventoryQuantity": 12,
      "position": 0,
      "imageId": "0199…image-1"
    }
  ],
  "images": [
    {
      "id": "0199…image-1",
      "url": "https://api.example.com/api/v1/media/stores/…/products/….webp",
      "alt": "Front",
      "width": 1600,
      "height": 2000,
      "position": 0,
      "renditions": [
        { "width": 200, "url": "…_w200.webp" },
        { "width": 600, "url": "…_w600.webp" },
        { "width": 1200, "url": "…_w1200.webp" }
      ]
    }
  ],
  "collectionIds": [],
  "metafields": [
    {
      "id": "0199…",
      "namespace": "custom",
      "key": "material",
      "type": "single_line_text",
      "value": "100% linen",
      "showOnStorefront": true
    }
  ],
  "publishedAt": "2026-11-01T09:00:00.000Z",
  "scheduled": true,
  "createdAt": "2026-10-22T10:00:00.000Z",
  "updatedAt": "2026-10-22T10:05:00.000Z"
}
```

Notes for the UI:

- `profit` = `price - costPerItem`; `margin` = profit as a percentage of price, one decimal.
  Both are `null` without a cost (`margin` is also `null` when the price is 0). Show them next
  to the cost field; they are recomputed on every response.
- `scheduled` is true for `ACTIVE` products whose `publishedAt` is in the future; they are
  invisible to shoppers until then. Show it as a "Scheduled for …" badge.
- `renditions` lists only widths smaller than the image (narrowest first) and is `[]` for
  images uploaded before renditions existed. Build `srcset` from `renditions` plus `url` at
  `width`:
  `srcset="…_w200.webp 200w, …_w600.webp 600w, <url> 1600w"`.

## List, filters and facets

`GET /products` → `{ items: ProductListItem[], page, pageSize, total }`

| Query          | Values                                                                | Notes                                                                      |
| -------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `q`            | text ≤ 100                                                            | Title or vendor contains, SKU starts with, or exact tag; case-insensitive. |
| `status`       | `DRAFT` \| `ACTIVE` \| `ARCHIVED`                                     |                                                                            |
| `vendor`       | text                                                                  | Exact match, case-insensitive (use values from facets).                    |
| `productType`  | text                                                                  | Exact match, case-insensitive.                                             |
| `tag`          | text                                                                  | Exact tag (tags are stored lowercase).                                     |
| `collectionId` | uuid                                                                  | Manual members, or ACTIVE products with a rule collection's tag.           |
| `sort`         | `updated` (default) \| `created` \| `title` \| `price` \| `inventory` | `price` = lowest variant price; `inventory` = sum of tracked variants.     |
| `direction`    | `asc` \| `desc`                                                       | Default: `desc` for updated/created, `asc` otherwise.                      |
| `page`         | ≥ 1 (default 1)                                                       |                                                                            |
| `pageSize`     | 1–100 (default 25)                                                    |                                                                            |

Empty query values (`?vendor=`) are ignored, so a form can submit every filter.

```json
{
  "items": [
    {
      "id": "0199…",
      "title": "Linen Shirt",
      "handle": "linen-shirt",
      "status": "ACTIVE",
      "vendor": "Atelier",
      "productType": "Shirts",
      "tags": ["summer", "linen"],
      "variantCount": 2,
      "totalInventory": 20,
      "minPrice": 4900,
      "maxPrice": 5200,
      "imageUrl": "…/….webp",
      "thumbnailUrl": "…/…_w200.webp",
      "publishedAt": "2026-11-01T09:00:00.000Z",
      "scheduled": true,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "page": 1,
  "pageSize": 25,
  "total": 1
}
```

Use `thumbnailUrl` for list rows (200 px when available, otherwise the full image).

`GET /products/facets` → distinct values for filter dropdowns (sorted, ≤ 500 each):

```json
{ "vendors": ["Atelier", "Peak"], "productTypes": ["Shirts", "Shoes"], "tags": ["linen", "summer"] }
```

## Create / update

`POST /products` (201) and `PUT /products/:productId` (200) take the same body
(`productInputSchema`) and return the `Product`. `PUT` replaces the product, except for the
fields marked "omit = keep" below, so older forms do not wipe data they do not know about.

```json
{
  "title": "Linen Shirt",
  "status": "ACTIVE",
  "publishAt": "2026-11-01T09:00:00Z",
  "options": [{ "name": "Size", "values": ["S", "M"] }],
  "variants": [
    {
      "id": "0199…",
      "options": ["S"],
      "price": 4900,
      "costPerItem": 2100,
      "countryOfOrigin": "pt",
      "hsCode": "6205.20",
      "imageId": "0199…image-1"
    },
    { "options": ["M"], "price": 4900 }
  ],
  "metafields": [
    {
      "key": "material",
      "type": "single_line_text",
      "value": "100% linen",
      "showOnStorefront": true
    },
    { "key": "care", "type": "multi_line_text", "value": "Wash cold\nLine dry" },
    { "namespace": "erp", "key": "supplier_code", "type": "number_integer", "value": "4411" }
  ]
}
```

New fields:

| Field                        | Rules                                                                                                    | Omit on update |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | -------------- |
| `variants[].costPerItem`     | integer 0–100,000,000 or `null`                                                                          | keeps          |
| `variants[].countryOfOrigin` | two letters (normalized to uppercase), `""`/`null` clears                                                | keeps          |
| `variants[].hsCode`          | 6–10 digits; dots/spaces are dropped (`"6205.20"` → `"620520"`), `""`/`null` clears                      | keeps          |
| `variants[].imageId`         | an image of **this** product (`400` otherwise; on create there are no images yet), `null` clears         | keeps          |
| `publishAt`                  | ISO datetime with offset. Future = scheduled, past = backdated, `null` = publish now (clears a schedule) | keeps          |
| `metafields`                 | ≤ 30, unique `namespace.key`; **replaces** all metafields when present                                   | keeps all      |
| `variants`                   | now up to 250 (was 100)                                                                                  | —              |

`publishAt` only matters while `status` is `ACTIVE`: a product becoming `ACTIVE` without a
publish time is published now.

### Metafield types

`namespace` defaults to `custom` (`[a-z0-9_]{1,20}`); `key` is `[a-z0-9_]{1,40}`. `value` may be
sent as a string, number or boolean; it is validated and stored as a canonical string (the
response shows what was stored).

| `type`             | Accepts                                 | Stored as              |
| ------------------ | --------------------------------------- | ---------------------- |
| `single_line_text` | 1–255 chars, no line breaks             | trimmed                |
| `multi_line_text`  | 1–5000 chars                            | trimmed, `\r\n` → `\n` |
| `number_integer`   | `-123`, `+7`, `007` (safe integers)     | `"-123"`, `"7"`, `"7"` |
| `number_decimal`   | `12.50`, `-0.5` (≤ 15 + 9 digits)       | `"12.5"`, `"-0.5"`     |
| `boolean`          | `true`/`false` (any case)               | `"true"` / `"false"`   |
| `url`              | `https://` only, no credentials, ≤ 2048 | normalized URL         |
| `date`             | `YYYY-MM-DD`, a real date               | as given               |

Validation errors point at the field, e.g. `errors: [{ path: "metafields.2.value", message:
"Only https:// links are allowed" }]`. The same validator is exported as
`normalizeMetafieldValue(type, value)` for inline form validation.

## Images

Every image endpoint returns the full `Product`.

### Upload — `POST /products/:productId/images` (201)

`multipart/form-data`:

- `files`: up to 10 images (JPEG, PNG, WebP, GIF, AVIF; ≤ 20 MB each). The original single
  `file` field still works and may be combined.
- `alt` (optional): alt text applied to every image in the request (≤ 512).

All-or-nothing: if one file fails, none are added. New images go to the end of the gallery.

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| 400    | No file, or more than 10 files                                |
| 409    | The product would exceed 50 images (`detail` says how many)   |
| 413    | A file is over 20 MB or 50 megapixels                         |
| 415    | Not a supported image (SVG, PDF, …)                           |
| 422    | Looks like an image but cannot be decoded (damaged/truncated) |

Images are auto-rotated (EXIF), stripped of metadata, scaled to fit 5000 × 5000 and stored as
WebP with 200/600/1200/2048 px renditions.

```js
const form = new FormData();
for (const file of input.files) form.append('files', file);
form.append('alt', 'Linen shirt');
await fetch(`/api/v1/admin/stores/${storeId}/products/${productId}/images`, {
  method: 'POST',
  body: form,
});
```

### Import from URL — `POST /products/:productId/images/import` (201)

```json
{ "url": "https://cdn.example.com/shirt.jpg", "alt": "Front" }
```

`https://` only. The server downloads it (≤ 20 MB, 15 s, ≤ 3 redirects, must answer with an
`image/*` type) and processes it like an upload. Private, loopback, link-local and metadata
addresses are refused (`400`, `detail`: "That URL cannot be imported: use a public https://
address."); download problems are `400` with the reason ("The image could not be downloaded:
The server answered 404."). `409`/`413`/`415`/`422` as for uploads.

### Reorder — `PUT /products/:productId/images/order` (200)

```json
{ "imageIds": ["0199…c", "0199…a", "0199…b"] }
```

Must list every image of the product exactly once (`400` otherwise). Positions become 0…n-1.
Ideal for drag-and-drop: send the new order after the drop.

### Edit alt text / move one image — `PATCH /products/:productId/images/:imageId` (200)

```json
{ "alt": "Back view", "position": 0 }
```

Both optional. `alt` ≤ 512 chars; `position` moves the image to that index and shifts the
others. Audited as `product.image_updated`.

### Delete — `DELETE /products/:productId/images/:imageId` (200)

Removes the image and its files; remaining positions are compacted, and variants that showed
it get `imageId: null`.

## Variant image

`PATCH /products/:productId/variants/:variantId` (200)

```json
{ "imageId": "0199…image-2" }
```

`null` clears. The image must belong to the same product (`400`); an unknown variant is `404`.
The same can be done through `variants[].imageId` in the product update.

## Bulk actions

`POST /products/bulk` (200) → `{ "action": "archive", "count": 3 }`

```json
{ "productIds": ["0199…", "0199…"], "action": "add_tags", "tags": ["sale"] }
```

| `action`                   | Effect                                                                            |
| -------------------------- | --------------------------------------------------------------------------------- |
| `activate`                 | status `ACTIVE`; unpublished products are published now (schedules are kept)      |
| `draft` / `archive`        | status `DRAFT` / `ARCHIVED`                                                       |
| `delete`                   | deletes products and their image files                                            |
| `add_tags` / `remove_tags` | `tags` required (1–50); a product may not exceed 50 tags (`400`, nothing changes) |

1–100 ids (duplicates ignored). One transaction: if any id is not a product of this store,
nothing changes (`400`). Each product gets the usual audit entry and `products/updated` /
`products/deleted` webhook. Requires `products:write` (`403` for read-only staff).

## CSV

`GET /product-csv/export` and `POST /product-csv/import` (multipart `file`) gained columns:

| Column              | Meaning                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `Cost per item`     | decimal in the store currency (`4.50`)                            |
| `Country of origin` | two-letter code                                                   |
| `HS code`           | 6–10 digits                                                       |
| `Image Src`         | public https URL; imported through the same SSRF-guarded importer |
| `Image Position`    | 1-based gallery order (optional)                                  |
| `Image Alt Text`    | alt text                                                          |

Like Shopify, images ride one per row; a product with more images than variants gets extra rows
with only `Handle` and the image columns. An image that cannot be imported is reported in
`errors` (the product is still created). At most 100 images are downloaded per import.

## Storefront

`GET /api/v1/storefront/products/:handle` adds (all optional in the schema, always sent):

```json
{
  "images": [
    {
      "id": "0199…image-1",
      "url": "…",
      "alt": "Front",
      "width": 1600,
      "height": 2000,
      "renditions": [{ "width": 600, "url": "…_w600.webp" }]
    }
  ],
  "variants": [
    { "id": "…", "title": "S", "price": 4900, "available": true, "imageId": "0199…image-1" }
  ],
  "specs": [
    { "key": "material", "label": "Material", "type": "single_line_text", "value": "100% linen" }
  ]
}
```

- When a variant is selected, show the image whose `id` equals `variant.imageId` (or keep the
  current one when it is `null`).
- `specs` are the metafields marked `showOnStorefront`, in their order, with a humanized label
  (`fabric_weight` → "Fabric weight"). Render values as plain text; for `boolean` show Yes/No,
  for `url` a link.
- Product cards (`GET /storefront/products`) add `imageRenditions` and `secondImageRenditions`.
- Cart lines show the variant's image when it has one.
- Cost, profit, margin, HS code and country of origin are never sent to the storefront.
- Scheduled products (and their variants) are absent from every storefront endpoint until their
  publish time: product page `404`, not listed or searchable, not in collections or the
  sitemap, cannot be added to carts, and an existing cart line becomes `available: false`.

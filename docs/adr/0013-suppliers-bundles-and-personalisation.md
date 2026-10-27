# ADR 0013 — Suppliers and purchase orders, bundles, option styles and personalisation

- Status: Accepted
- Date: 2026-10-26

## Context

Merchants asked for a deeper catalog: knowing who they buy from and restocking against what
they ordered, selling combos (gift sets) without counting their stock by hand, showing colour
options as swatches, and taking shopper input such as engraving text or gift wrap at a price.
The existing guarantees still apply: tenant isolation (RLS on every new table, store-scoped
queries, same-store triggers for single-column foreign keys), concurrent checkouts never
oversell, `ProductVariant.inventoryQuantity` stays the sum of its location levels for stocked
variants, and no admin-only data (cost, supplier) reaches shoppers.

## Decision

### Suppliers and purchase orders

- `Supplier` (unique name per store, contact details, lead time, notes, active flag). Products
  may name one (`Product.supplierId`, `ON DELETE SET NULL`; a trigger enforces the same store).
  A supplier with purchase orders cannot be deleted (`409`): it is marked inactive instead.
- `PurchaseOrder` numbered `#PO<n>` per store (counter in `OrderCounter.nextPurchaseOrder`),
  with a destination location, expected date, supplier reference, shipping cost and notes.
  `PurchaseOrderLine` snapshots the product/variant titles and SKU and keeps working when the
  variant is deleted (`variantId` set null).
- Lifecycle: `DRAFT` (editable, replaced as a whole) → `ORDERED` (items fixed) →
  `PARTIALLY_RECEIVED` → `RECEIVED`; `CANCELLED` from draft or ordered only. "Close" ends an
  order that will not be delivered in full. Only drafts and cancelled orders can be deleted.
- Receiving locks the order row, refuses more than is still expected, and for tracked,
  non-bundle variants adds the units to the order's location and the variant total in the same
  transaction, writing `PURCHASE_ORDER` ledger entries (`referenceId` = the order). Optionally it
  sets the variant's cost per item to the order's unit cost.
- Reorder suggestions: a supplier's tracked variants at or below `LOW_STOCK_THRESHOLD`, minus
  units already on open orders, topped up to `REORDER_TARGET` (4× the threshold). The
  purchase-order form can add them in one click.

### Bundles (combos)

- `Product.isBundle`, fixed at creation (turning a stocked product into a bundle, or back, would
  break the level/total invariant). Each bundle variant lists `BundleComponent`s (other
  variants, 1–100 units each, at most 10). Components cannot be bundles, gift cards or variants
  of the bundle itself.
- A bundle holds no stock. Its `trackInventory`, `allowBackorder` and `inventoryQuantity` are
  **derived** from its components (`catalog/bundles.ts`) and recomputed in the same
  transaction as every change to a component's stock or stock settings (adjustments, orders,
  restocks, receiving, product edits and deletes). Keeping them on the variant row means the
  storefront listing SQL, cart limits and checkout treat a bundle like any other variant with no
  extra queries. Recomputation updates bundle rows in id order to keep lock order stable.
- Selling a bundle takes each tracked component's stock with the same conditional decrement as
  a normal line (so oversell protection is per component) and records what it took on
  `OrderLine.components` (variant, units per bundle, location). Cancellations and returns put
  exactly that back. Inventory adjustments and purchase orders refuse bundle variants.
- The storefront shows "What's inside" and the saving against the items' own prices.

### Option display styles

- `ProductOption.style` is `buttons` (default), `dropdown` or `swatches`; `swatches` holds one
  `#rrggbb` per value (validated, normalized, dropped when none is set). Only the style changes;
  variants are unaffected.

### Personalisation (shopper customizations)

- `Product.customizations` (JSON, validated by `customizationInputSchema`): up to 10 fields of
  type text, paragraph, dropdown (2–30 priced choices) or checkbox, each optionally required and
  priced. Field ids are stable across edits so carts keep referring to them.
- The cart stores the shopper's answers by field id (`CartLine.customization`) plus a canonical
  key; the unique key becomes `(cart, variant, customKey)`, so different answers are separate
  lines and equal answers merge. Stock limits apply to the sum of a variant's lines.
- Answers are always re-validated and re-priced against the product's **current** fields
  (`resolveCustomization`, shared by API and storefront). A line whose answers no longer fit is
  unavailable with a warning rather than silently changed.
- At checkout the add-on prices are folded into the line's unit price (so discounts, tax and
  refunds work unchanged) and the answers are snapshotted on `OrderLine.properties`
  (`[{ label, value, price }]`, in the order currency), shown in the admin, order emails, the
  order status page and customer accounts. Answers are plain text and always rendered escaped.

## Consequences

- One migration (`20261026090000_suppliers_bundles_customizations`) adds the tables (RLS
  enabled), columns with safe defaults, check constraints and two same-store triggers.
  Existing carts, orders and products are unaffected.
- CSV import/export does not carry bundle components or personalisation; importing over a
  bundle fails for that row (a bundle cannot become a regular product).
- Covered by `apps/api/test/purchasing-bundles.e2e.test.ts` (receiving, ledger, isolation,
  bundle stock through sale and expiry, personalisation pricing and line splitting) and
  `e2e/purchasing-bundles.spec.ts`.

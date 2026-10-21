# Data model (draft)

Conventions: UUID primary keys; `store_id uuid not null` on every tenant table (indexed, part of composite FKs and unique keys); `created_at`/`updated_at` timestamptz; money as `bigint` minor units + `currency char(3)`; soft-delete only where business requires (`archived_at`).

## Platform (global, not tenant-scoped)

| Entity                               | Key fields                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `User`                               | id, email (unique, citext), name, email_verified_at, platform_role (`NONE`/`SUPPORT`/`SUPER_ADMIN`)      |
| `Session`, `Account`, `Verification` | owned by the auth library (Phase 2)                                                                      |
| `Merchant`                           | id, legal_name, owner_user_id, status (`ACTIVE`/`SUSPENDED`)                                             |
| `Plan`                               | id, code, name, price, interval, limits (json: max_products, max_staff, max_stores, transaction_fee_bps) |
| `Subscription`                       | id, merchant_id, plan_id, status, current_period_end, provider_ref                                       |
| `PlatformSetting`                    | key, value json                                                                                          |
| `PlatformAuditLog`                   | actor_user_id, action, target, metadata, ip, created_at                                                  |

## Store & access

| Entity         | Key fields                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `Store`        | id, merchant_id, name, subdomain (unique), currency, timezone, status, theme_id                |
| `Domain`       | id, store_id, hostname (unique), verified_at, verification_token, is_primary                   |
| `StoreMember`  | store_id, user_id, role (`OWNER`/`ADMIN`/`STAFF`), permissions[] — unique(store_id, user_id)   |
| `StoreSetting` | store_id, checkout/notification/branding settings                                              |
| `AuditLog`     | store_id, actor_user_id, action, entity_type, entity_id, diff json, ip, user_agent, created_at |
| `UsageCounter` | store_id, metric, period, value                                                                |

## Catalog & inventory

| Entity                        | Key fields                                                                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Product`                     | store_id, id, title, handle (unique per store), description_html (sanitized), status (`DRAFT`/`ACTIVE`/`ARCHIVED`), vendor, product_type, tags[], search_vector |
| `ProductOption`               | store_id, product_id, name, position, values[]                                                                                                                  |
| `ProductVariant`              | store_id, id, product_id, sku (unique per store), option_values json, price, compare_at_price, weight_grams, requires_shipping, taxable                         |
| `ProductImage` / `MediaAsset` | store_id, product_id?, storage_key, alt, width, height, position                                                                                                |
| `Collection`                  | store_id, id, title, handle, type (`MANUAL`/`SMART`), rules json                                                                                                |
| `CollectionProduct`           | store_id, collection_id, product_id, position                                                                                                                   |
| `Page`                        | store_id, id, title, handle (unique per store), body (plain text), published                                                                                    |
| `StorePolicy`                 | store_id + kind (`REFUND`/`PRIVACY`/`TERMS`/`SHIPPING`/`CONTACT`), body                                                                                         |
| `Menu`                        | store_id + handle (`main`/`footer`), items json (typed links validated on write and read)                                                                       |
| `InventoryLocation`           | store_id, id, name, address                                                                                                                                     |
| `InventoryLevel`              | store_id, variant_id, location_id, available, reserved — unique(variant_id, location_id)                                                                        |
| `InventoryAdjustment`         | store_id, variant_id, location_id, delta, reason, ref, actor                                                                                                    |

## Customers, carts, orders

| Entity                | Key fields                                                                                                                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Customer`            | store_id, id, email (unique per store), name, accepts_marketing, password_hash? (customer accounts are per store)                                                                                                                                                                                         |
| `Address`             | store_id, customer_id, fields…                                                                                                                                                                                                                                                                            |
| `Cart`                | store_id, id, token (opaque), customer_id?, currency, expires_at                                                                                                                                                                                                                                          |
| `CartLine`            | store_id, cart_id, variant_id, quantity                                                                                                                                                                                                                                                                   |
| `Order`               | store_id, id, number (sequential per store), customer_id?, email, status, financial_status, fulfillment_status, subtotal, discount_total, shipping_total, tax_total, total, currency, shipping/billing address snapshots, idempotency_key, recovery_status + recovery_email_sent_at (abandoned checkouts) |
| `DraftOrder`          | store_id, id, number (per store, #D1…), status (`OPEN`/`INVOICE_SENT`/`COMPLETED`), email, lines json (price snapshots), address, shipping, discount, totals, order_id (latest order created from it)                                                                                                     |
| `GiftCard`            | store_id, id, code_hash (HMAC, unique per store), last_characters, initial_value, balance, currency, customer_id?, expires_at, disabled_at                                                                                                                                                                |
| `GiftCardTransaction` | store_id, gift_card_id, kind (`ISSUED`/`REDEEMED`/`RESTORED`/`REFUNDED`/`ADJUSTED`), signed amount, balance_after, order_id? — append-only                                                                                                                                                                |
| `OrderLine`           | store_id, order_id, variant_id, title/sku/price **snapshots**, quantity                                                                                                                                                                                                                                   |
| `Payment`             | store_id, order_id, provider, provider_ref, amount, application_fee, destination_account_id, status — **no card data, only provider tokens/refs**                                                                                                                                                         |
| `PaymentAccount`      | store_id (unique), provider, account_id (Stripe `acct_…` / Razorpay `acc_…`), provider_data (ids only), status, charges/payouts enabled, requirements due — **no identity or bank data**                                                                                                                  |
| `Dispute`             | store_id, order_id, payment_id, provider_dispute_id (unique per provider), amount, reason, status, evidence_due_by                                                                                                                                                                                        |
| `Refund`              | store_id, order_id, payment_id, amount, reason, provider_ref                                                                                                                                                                                                                                              |
| `Fulfillment`         | store_id, order_id, tracking_number, carrier, status                                                                                                                                                                                                                                                      |
| `OrderEvent`          | store_id, order_id, type, data — timeline                                                                                                                                                                                                                                                                 |

## Commerce configuration

| Entity                          | Key fields                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ShippingZone` / `ShippingRate` | store_id, countries[], rate type (flat/weight/price), amount                                                                                              |
| `TaxRate`                       | store_id, country, region, rate_bps, applies_to_shipping                                                                                                  |
| `DiscountCode`                  | store_id, code (unique per store, case-insensitive), type (percent/fixed/free_shipping), value, min_subtotal, usage_limit, used_count, starts_at, ends_at |
| `Theme` / `ThemeSetting`        | store_id, theme template, settings json (validated schema, no raw script)                                                                                 |
| `NotificationTemplate`          | store_id, event, subject, body (safe templating)                                                                                                          |
| `WebhookEvent` (inbound)        | provider, event_id (unique), processed_at — idempotent webhook processing                                                                                 |
| `OutboxEvent`                   | reliable job/email dispatch                                                                                                                               |

The Prisma schema and migrations land in `packages/db` in Phase 2, starting with the Platform + Store & access groups only.

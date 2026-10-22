# ADR 0010 — Storefront templates

- Status: Accepted
- Date: 2026-10-22

## Context

Merchants want a storefront that looks like their kind of business without designing it. The
theme was a choice of three hero layouts, two colors and a font. Shopify-style theme files
(arbitrary Liquid/HTML/CSS) would let a merchant inject script into shoppers' pages and break
our CSP and tenant-isolation guarantees.

## Decision

- A theme stays **data only**: a homepage layout (`preset`) plus `themeSettingsSchema`
  — validated hex colors (brand, accent, background, surface, text), enums for fonts (system
  font stacks only, so no third-party font requests), heading case, corner radius, button,
  header, product card, image shape, spacing and footer styles, a 2–5 column grid, and short
  plain-text copy. Every field has a default, so themes saved before a field existed still parse.
- **Templates** are named bundles of those settings, generated in `@repo/contracts`
  (`THEME_TEMPLATES`): 12 industries (palettes, fonts, safe default copy) × 9 design styles
  (layout tokens) = 108 templates. Applying one is an ordinary theme save; the merchant's own
  headline, tagline, button label, section title and announcement are kept when set
  (`applyThemeTemplate`). Templates never set an announcement, since it would make promises
  (free shipping, warranties) the merchant has not made.
- The storefront renders tokens as CSS custom properties and `data-*` attributes on `<body>`;
  layouts that change markup (header, hero, footer) switch on the enum values.
- **Preview** without saving: `?theme_preview=<template id>` sets a session cookie for that
  visitor only and the storefront swaps the theme in memory; unknown ids are ignored and
  `off` ends the preview. Password-protected stores stay locked.
- New stores can pick an industry during onboarding and start with its Minimal template.
- **Sections and merchant content** live in the same validated settings: sticky header, cart
  drawer or page, homepage sections (trust bar, featured collections, collection carousels,
  brand story, latest blog posts, newsletter) with their text, and https-only social links.
  Templates only change _design_ fields; applying one keeps the merchant's sections, words and
  links.
- The newsletter section records marketing consent on the store's customer for that email
  (`POST /storefront/newsletter`, throttled, same response whether or not the customer
  existed).

## Consequences

- No merchant-supplied CSS or markup reaches shoppers; the CSP and XSS posture is unchanged.
- Templates are code: adding or changing one ships with a release, and a test checks every
  template parses and meets contrast minimums (text 7:1, text on surfaces 4.5:1, brand 4.5:1).
- Template variety comes from combining layouts and tokens, not bespoke designs per template;
  a merchant who wants a truly custom design needs a future theme-code feature with sandboxing.

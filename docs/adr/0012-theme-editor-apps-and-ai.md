# 0012 — Visual theme editor, store apps and the AI design assistant

Status: accepted (2026-10-24)

## Context

Merchants customised their storefront through a long form with no preview, and homepage
sections were in a fixed order. Shopify-style editing needs four things: a draft separate from
the live theme, a live preview of that draft, sections that can be reordered and hidden, and
small installable features ("apps"). Merchants also asked for an AI assistant that restyles the
theme from a plain-language request.

## Decision

**Drafts.** `Store.themeDraft` (JSON `{preset, settings}`) and `themeDraftUpdatedAt` hold an
unpublished theme. The editor autosaves every change there (`PUT /theme/draft`); shoppers keep
seeing the live theme until `POST /theme/draft/publish` copies the draft over it and clears it
(audited as `theme.published`). `DELETE /theme/draft` discards it.

**Preview.** `POST /theme/preview-token` returns a two-hour HMAC token (`signToken`, purpose
`theme-preview`, bound to the store id). The editor frames the storefront with
`?theme_draft=<token>`. The storefront proxy forwards the token to the API (`x-theme-draft`),
stores it in a **partitioned** (CHIPS), `SameSite=None; Secure` cookie for later navigations in
the frame, and only then allows framing by the admin origin (`frame-ancestors`); otherwise pages
keep `frame-ancestors 'none'` and `X-Frame-Options: DENY`. The API checks the token per request
(`ThemePreviewService`), so a forged or another store's token shows the live theme. Because the
cookie is partitioned under the admin, opening the store in a normal tab never shows the draft.
The admin CSP adds `frame-src` for store subdomains. A small client bridge in the storefront talks
to the editor over `postMessage` (origin-checked both ways): refresh after a save, highlight a
section, and report clicks so the editor selects the clicked section.

**Sections.** `themeSettings.sectionOrder` lists the homepage sections after the hero; the
schema keeps each known id once and appends missing ones, so older themes still parse. A new
`showFeatured` flag makes the latest-products grid optional. Each rendered section carries
`data-section` for the editor.

**Apps.** `Store.apps` (validated by `storeAppsSchema`) holds first-party apps: free-shipping bar,
New arrival badges, WhatsApp chat, share buttons and a store cookie notice. They are data only —
the storefront renders them, no merchant code runs, and the storefront CSP still forbids
third-party scripts. "New" badges are computed by the API from `publishedAt`.

**AI.** `POST /theme/ai` sends the request and current theme to Claude
(`claude-opus-5-5`, structured output via `betaZodOutputFormat`, server-side fallbacks on a
refusal) and gets back a summary plus nullable values for each editable setting. Every value is
re-validated with `themeSettingsSchema` and invalid ones are dropped; nothing is saved — the
editor applies the result as one undoable edit. The model sits behind an injectable
`THEME_AI_CLIENT`, so tests use a fake. Without `ANTHROPIC_API_KEY` the feature reports itself as
off (`GET /theme/ai`) and the endpoint returns 503. Requests are throttled to 10 a minute.

## Consequences

- Live theme reads are unchanged (cached per host); draft previews bypass that cache.
- Apps take effect on the live store immediately (no draft), which the editor says.
- AI calls cost money per request on the operator's Anthropic account.

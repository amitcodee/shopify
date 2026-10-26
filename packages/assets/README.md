# @repo/assets: shared photo library

Stock photos (Unsplash License, see [CREDITS.md](./CREDITS.md)) used by the storefront and admin
UIs. Everything is WebP, re-encoded with metadata stripped.

| Folder                  | Contents                                                                                         | Copied to (served at)                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `templates/<industry>/` | `hero.webp` (lifestyle, up to 1600×1000, aspect kept) and `p1`–`p4.webp` (600×600 product shots) | `apps/storefront/public/media/templates/` and `apps/admin/public/media/templates/` (`/media/templates/<industry>/<file>`) |
| `marketing/`            | Lifestyle/business photos for the marketing site (up to 1600×1000, aspect kept)                  | `apps/storefront/public/media/marketing/` (`/media/marketing/<name>.webp`)                                                |

Industries match `THEME_INDUSTRIES` in `packages/contracts/src/themes.ts`: fashion, electronics,
beauty, home, food, jewelry, sports, kids, books, pets, wellness, art.

The demo-store product photos live next to the seed instead, in `apps/api/seed-assets/products/`
(`<handle>-1..3.webp`, 900×900), because the API seed reads them from disk.

## Editing

This folder is the source of truth. After adding, replacing or removing files here, run:

```sh
node scripts/sync-assets.mjs
```

It replaces the app copies wholesale (so deletions propagate). Add a row to `CREDITS.md` for
every new photo.

Static files live under `/media/…` rather than `/templates/…` because the storefront already has
a `/templates` marketing route (`src/app/templates`).

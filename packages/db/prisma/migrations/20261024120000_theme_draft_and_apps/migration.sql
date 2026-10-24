-- Theme editor drafts and per-store apps.
ALTER TABLE "Store" ADD COLUMN     "apps" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "themeDraft" JSONB,
ADD COLUMN     "themeDraftUpdatedAt" TIMESTAMP(3);

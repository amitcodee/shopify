-- AlterEnum
ALTER TYPE "StoreStatus" ADD VALUE 'CLOSED';

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "currency" CHAR(3) NOT NULL DEFAULT 'INR',
ADD COLUMN     "introCycles" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "introPrice" INTEGER,
ADD COLUMN     "providerPlans" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "razorpayOfferId" TEXT,
ADD COLUMN     "trialDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "billingLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "codRequireConfirmation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "graceEndsAt" TIMESTAMP(3),
ADD COLUMN     "introUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "providerPhase" TEXT;

ALTER TABLE "Subscription" ALTER COLUMN "provider" SET DEFAULT 'none';

-- CreateIndex
CREATE UNIQUE INDEX "PlatformInvoice_providerRef_key" ON "PlatformInvoice"("providerRef");


-- Pricing moves to one INR plan: 7-day free trial, ₹99/month for the first 3 months, then ₹799.
-- The old USD plans stay for history but are hidden and no longer the default.
UPDATE "Plan" SET "active" = false, "isDefault" = false, "currency" = 'USD'
  WHERE "code" IN ('starter', 'growth', 'pro');

INSERT INTO "Plan" ("id", "code", "name", "priceMonthly", "currency", "trialDays", "introPrice",
  "introCycles", "maxProducts", "maxStaff", "maxOrdersPerMonth", "transactionFeeBps", "active",
  "isDefault", "sortOrder", "updatedAt")
VALUES (gen_random_uuid(), 'standard', 'Standard', 79900, 'INR', 7, 9900, 3, NULL, 5, NULL, 0,
  true, true, 1, (now() AT TIME ZONE 'UTC'))
ON CONFLICT ("code") DO NOTHING;

-- Stores that were on the free plan (or a mock-billed plan) start a fresh 7-day trial on the
-- new plan. Stores a platform admin put on a plan by hand ("manual") keep their plan.
UPDATE "Subscription" s
SET "planId" = (SELECT "id" FROM "Plan" WHERE "code" = 'standard'),
    "status" = 'TRIALING',
    "currentPeriodStart" = (now() AT TIME ZONE 'UTC'),
    "currentPeriodEnd" = (now() AT TIME ZONE 'UTC') + interval '7 days',
    "trialEndsAt" = (now() AT TIME ZONE 'UTC') + interval '7 days',
    "pendingPlanId" = NULL,
    "provider" = 'none',
    "providerRef" = NULL
WHERE s."provider" <> 'manual';

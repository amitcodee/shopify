-- Stripe Connect: per-store payout accounts and platform fees on payments (ADR 0006).

-- CreateEnum
CREATE TYPE "PaymentAccountStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'RESTRICTED', 'DISCONNECTED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "applicationFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "destinationAccountId" TEXT;

-- CreateTable
CREATE TABLE "PaymentAccount" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" "PaymentAccountStatus" NOT NULL DEFAULT 'ONBOARDING',
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "requirementsDue" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disabledReason" TEXT,
    "country" CHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAccount_storeId_key" ON "PaymentAccount"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAccount_provider_accountId_key" ON "PaymentAccount"("provider", "accountId");

-- AddForeignKey
ALTER TABLE "PaymentAccount" ADD CONSTRAINT "PaymentAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Store-owned: same tenant isolation as every other store table (docs/tenant-isolation.md).
SELECT app_enable_tenant_rls('"PaymentAccount"');

-- The platform fee can never exceed the charge.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_applicationFee_valid"
  CHECK ("applicationFee" >= 0 AND "applicationFee" <= "amount");

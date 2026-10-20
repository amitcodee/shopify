-- Multiple payment gateways (Stripe, Razorpay): provider-specific account ids.

-- AlterTable
ALTER TABLE "PaymentAccount" ADD COLUMN     "providerData" JSONB NOT NULL DEFAULT '{}';

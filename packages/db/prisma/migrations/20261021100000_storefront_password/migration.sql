-- Pre-launch storefront password page.

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "passwordMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "passwordProtected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storefrontPasswordChangedAt" TIMESTAMP(3),
ADD COLUMN     "storefrontPasswordEncrypted" TEXT;


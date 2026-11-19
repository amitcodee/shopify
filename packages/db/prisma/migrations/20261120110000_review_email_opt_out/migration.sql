-- Customers can stop review request emails from the link in them.

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "reviewEmailsOptOutAt" TIMESTAMP(3);


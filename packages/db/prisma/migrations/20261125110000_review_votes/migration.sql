-- "Helpful" votes on product reviews, one per signed-in customer.
-- AlterTable
ALTER TABLE "ProductReview" ADD COLUMN     "helpfulCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProductReviewVote" (
    "storeId" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductReviewVote_pkey" PRIMARY KEY ("reviewId","customerId")
);

-- CreateIndex
CREATE INDEX "ProductReviewVote_storeId_idx" ON "ProductReviewVote"("storeId");

-- CreateIndex
CREATE INDEX "ProductReviewVote_customerId_idx" ON "ProductReviewVote"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_storeId_id_key" ON "ProductReview"("storeId", "id");

-- AddForeignKey
ALTER TABLE "ProductReviewVote" ADD CONSTRAINT "ProductReviewVote_storeId_reviewId_fkey" FOREIGN KEY ("storeId", "reviewId") REFERENCES "ProductReview"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReviewVote" ADD CONSTRAINT "ProductReviewVote_storeId_customerId_fkey" FOREIGN KEY ("storeId", "customerId") REFERENCES "Customer"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_helpfulCount_check" CHECK ("helpfulCount" >= 0);
SELECT app_enable_tenant_rls('"ProductReviewVote"');

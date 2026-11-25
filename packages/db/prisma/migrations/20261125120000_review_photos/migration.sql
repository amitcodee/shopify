-- Photos on product reviews (at most 3 each), moderated with the review.
-- CreateTable
CREATE TABLE "ProductReviewPhoto" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "renditionWidths" INTEGER[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductReviewPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductReviewPhoto_reviewId_position_idx" ON "ProductReviewPhoto"("reviewId", "position");

-- CreateIndex
CREATE INDEX "ProductReviewPhoto_storeId_idx" ON "ProductReviewPhoto"("storeId");

-- AddForeignKey
ALTER TABLE "ProductReviewPhoto" ADD CONSTRAINT "ProductReviewPhoto_storeId_reviewId_fkey" FOREIGN KEY ("storeId", "reviewId") REFERENCES "ProductReview"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "ProductReviewPhoto" ADD CONSTRAINT "ProductReviewPhoto_position_check" CHECK ("position" BETWEEN 0 AND 2);
SELECT app_enable_tenant_rls('"ProductReviewPhoto"');

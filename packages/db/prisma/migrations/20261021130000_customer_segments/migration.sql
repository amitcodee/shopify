-- Customer segments.

-- CreateTable
CREATE TABLE "CustomerSegment" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSegment_storeId_name_idx" ON "CustomerSegment"("storeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSegment_storeId_id_key" ON "CustomerSegment"("storeId", "id");

-- AddForeignKey
ALTER TABLE "CustomerSegment" ADD CONSTRAINT "CustomerSegment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


SELECT app_enable_tenant_rls('"CustomerSegment"');
ALTER TABLE "CustomerSegment" ADD CONSTRAINT "CustomerSegment_conditions_array" CHECK (jsonb_typeof("conditions") = 'array');

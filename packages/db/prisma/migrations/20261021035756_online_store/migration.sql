-- Online store content: pages, policies, navigation menus.

-- CreateEnum
CREATE TYPE "PolicyKind" AS ENUM ('REFUND', 'PRIVACY', 'TERMS', 'SHIPPING', 'CONTACT');

-- CreateTable
CREATE TABLE "Page" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePolicy" (
    "storeId" UUID NOT NULL,
    "kind" "PolicyKind" NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePolicy_pkey" PRIMARY KEY ("storeId","kind")
);

-- CreateTable
CREATE TABLE "Menu" (
    "storeId" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("storeId","handle")
);

-- CreateIndex
CREATE UNIQUE INDEX "Page_storeId_id_key" ON "Page"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Page_storeId_handle_key" ON "Page"("storeId", "handle");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePolicy" ADD CONSTRAINT "StorePolicy_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

SELECT app_enable_tenant_rls('"Page"');
SELECT app_enable_tenant_rls('"StorePolicy"');
SELECT app_enable_tenant_rls('"Menu"');
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_handle_known" CHECK ("handle" IN ('main', 'footer'));
ALTER TABLE "Menu" ADD CONSTRAINT "Menu_items_array" CHECK (jsonb_typeof("items") = 'array');

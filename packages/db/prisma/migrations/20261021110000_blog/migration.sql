-- Store blog.

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlogPost_storeId_publishedAt_idx" ON "BlogPost"("storeId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_storeId_id_key" ON "BlogPost"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_storeId_handle_key" ON "BlogPost"("storeId", "handle");

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


SELECT app_enable_tenant_rls('"BlogPost"');

-- CreateEnum
CREATE TYPE "SyncBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_FAILED');

-- CreateTable
CREATE TABLE "ingestion_batches" (
    "id" UUID NOT NULL,
    "sync_batch_id" VARCHAR(255) NOT NULL,
    "data_source_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "SyncBatchStatus" NOT NULL DEFAULT 'PENDING',
    "received_counts" JSONB NOT NULL DEFAULT '{}',
    "applied_counts" JSONB NOT NULL DEFAULT '{}',
    "rejected_counts" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "error_message" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "source_table" VARCHAR(255) NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(255),
    "unit" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "raw_payload" JSONB,
    "provenance" JSONB NOT NULL,
    "extracted_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_batches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "source_table" VARCHAR(255) NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "product_source_id" VARCHAR(255) NOT NULL,
    "product_id" UUID,
    "batch_number" VARCHAR(255) NOT NULL,
    "expiry_date" VARCHAR(50),
    "manufacturing_date" VARCHAR(50),
    "raw_payload" JSONB,
    "provenance" JSONB NOT NULL,
    "extracted_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_inventories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "source_table" VARCHAR(255) NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "product_source_id" VARCHAR(255) NOT NULL,
    "product_id" UUID,
    "batch_source_id" VARCHAR(255),
    "batch_id" UUID,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION,
    "location" VARCHAR(255),
    "raw_payload" JSONB,
    "provenance" JSONB NOT NULL,
    "extracted_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "source_table" VARCHAR(255) NOT NULL,
    "source_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "contact" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "raw_payload" JSONB,
    "provenance" JSONB NOT NULL,
    "extracted_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_batches_data_source_id_sync_batch_id_key" ON "ingestion_batches"("data_source_id", "sync_batch_id");
CREATE INDEX "ingestion_batches_sync_batch_id_idx" ON "ingestion_batches"("sync_batch_id");
CREATE INDEX "ingestion_batches_data_source_id_idx" ON "ingestion_batches"("data_source_id");
CREATE INDEX "ingestion_batches_device_id_idx" ON "ingestion_batches"("device_id");
CREATE INDEX "ingestion_batches_tenant_id_idx" ON "ingestion_batches"("tenant_id");
CREATE INDEX "ingestion_batches_status_idx" ON "ingestion_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_products_tenant_id_data_source_id_source_table_source_id_key" ON "canonical_products"("tenant_id", "data_source_id", "source_table", "source_id");
CREATE INDEX "canonical_products_tenant_id_idx" ON "canonical_products"("tenant_id");
CREATE INDEX "canonical_products_data_source_id_idx" ON "canonical_products"("data_source_id");
CREATE INDEX "canonical_products_code_idx" ON "canonical_products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_batches_tenant_id_data_source_id_source_table_source_id_key" ON "canonical_batches"("tenant_id", "data_source_id", "source_table", "source_id");
CREATE INDEX "canonical_batches_tenant_id_idx" ON "canonical_batches"("tenant_id");
CREATE INDEX "canonical_batches_data_source_id_idx" ON "canonical_batches"("data_source_id");
CREATE INDEX "canonical_batches_batch_number_idx" ON "canonical_batches"("batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_inventories_tenant_id_data_source_id_source_table_source_id_key" ON "canonical_inventories"("tenant_id", "data_source_id", "source_table", "source_id");
CREATE INDEX "canonical_inventories_tenant_id_idx" ON "canonical_inventories"("tenant_id");
CREATE INDEX "canonical_inventories_data_source_id_idx" ON "canonical_inventories"("data_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_suppliers_tenant_id_data_source_id_source_table_source_id_key" ON "canonical_suppliers"("tenant_id", "data_source_id", "source_table", "source_id");
CREATE INDEX "canonical_suppliers_tenant_id_idx" ON "canonical_suppliers"("tenant_id");
CREATE INDEX "canonical_suppliers_data_source_id_idx" ON "canonical_suppliers"("data_source_id");

-- AddForeignKey
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_products" ADD CONSTRAINT "canonical_products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canonical_products" ADD CONSTRAINT "canonical_products_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_batches" ADD CONSTRAINT "canonical_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canonical_batches" ADD CONSTRAINT "canonical_batches_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canonical_batches" ADD CONSTRAINT "canonical_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "canonical_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_inventories" ADD CONSTRAINT "canonical_inventories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canonical_inventories" ADD CONSTRAINT "canonical_inventories_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canonical_inventories" ADD CONSTRAINT "canonical_inventories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "canonical_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "canonical_inventories" ADD CONSTRAINT "canonical_inventories_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "canonical_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_suppliers" ADD CONSTRAINT "canonical_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canonical_suppliers" ADD CONSTRAINT "canonical_suppliers_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

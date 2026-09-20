-- CreateTable
CREATE TABLE "schema_snapshots" (
    "id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "schema_fingerprint" VARCHAR(64) NOT NULL,
    "tables" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schema_snapshots_data_source_id_idx" ON "schema_snapshots"("data_source_id");

-- CreateIndex
CREATE INDEX "schema_snapshots_schema_fingerprint_idx" ON "schema_snapshots"("schema_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "schema_snapshots_data_source_id_schema_fingerprint_key" ON "schema_snapshots"("data_source_id", "schema_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "schema_snapshots_data_source_id_version_key" ON "schema_snapshots"("data_source_id", "version");

-- AddForeignKey
ALTER TABLE "schema_snapshots" ADD CONSTRAINT "schema_snapshots_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

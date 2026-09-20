-- CreateEnum
CREATE TYPE "DatabaseClassification" AS ENUM ('ORACLE', 'SQLSERVER', 'POSTGRESQL', 'MYSQL', 'SQLITE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "profile_snapshots" (
    "id" UUID NOT NULL,
    "data_source_id" UUID NOT NULL,
    "schema_fingerprint" VARCHAR(64) NOT NULL,
    "classification" "DatabaseClassification" NOT NULL DEFAULT 'UNKNOWN',
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profile_snapshots_data_source_id_idx" ON "profile_snapshots"("data_source_id");

-- CreateIndex
CREATE INDEX "profile_snapshots_schema_fingerprint_idx" ON "profile_snapshots"("schema_fingerprint");

-- AddForeignKey
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_data_source_id_fkey" FOREIGN KEY ("data_source_id") REFERENCES "data_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ONBOARDED', 'RESEARCH_READY', 'READY_TO_GENERATE', 'LIVE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "smartlead_api_key" TEXT,
    "airtable_config" JSONB,
    "notion_config" JSONB,
    "status" "TenantStatus" NOT NULL DEFAULT 'ONBOARDED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_reports" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "transcript_text" TEXT NOT NULL,
    "report_json" JSONB NOT NULL DEFAULT '{}',
    "report_text" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "title" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "chunk_text" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "retrieved_chunk_ids" JSONB NOT NULL DEFAULT '[]',
    "output_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smartlead_campaigns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "smartlead_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smartlead_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smartlead_replies" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "lead_email" TEXT NOT NULL,
    "reply_type" TEXT,
    "thread_url" TEXT,
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smartlead_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smartlead_stats" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "reply_count" INTEGER NOT NULL DEFAULT 0,
    "interested_count" INTEGER NOT NULL DEFAULT 0,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smartlead_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "smartlead_campaigns_tenant_id_smartlead_id_key" ON "smartlead_campaigns"("tenant_id", "smartlead_id");

-- AddForeignKey
ALTER TABLE "research_reports" ADD CONSTRAINT "research_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "kb_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_chunks" ADD CONSTRAINT "kb_chunks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smartlead_campaigns" ADD CONSTRAINT "smartlead_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smartlead_replies" ADD CONSTRAINT "smartlead_replies_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "smartlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smartlead_stats" ADD CONSTRAINT "smartlead_stats_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "smartlead_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

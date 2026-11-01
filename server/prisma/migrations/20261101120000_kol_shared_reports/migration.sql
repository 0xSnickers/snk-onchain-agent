ALTER TABLE "Kol"
  ADD COLUMN "profileUrl" TEXT,
  ADD COLUMN "projects" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "summary" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sharedAt" TIMESTAMP(3);

CREATE TABLE "KolSharedReport" (
  "id" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "schemaName" TEXT NOT NULL,
  "reportDate" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3),
  "fileUpdatedAt" TIMESTAMP(3),
  "summary" TEXT NOT NULL DEFAULT '',
  "version" TEXT,
  "owner" TEXT,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KolSharedReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KolSharedReport_contentHash_key" ON "KolSharedReport"("contentHash");
CREATE INDEX "KolSharedReport_reportDate_ingestedAt_idx" ON "KolSharedReport"("reportDate", "ingestedAt");

CREATE TABLE "KolSharedSection" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "summary" TEXT NOT NULL DEFAULT '',
  "highlights" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "KolSharedSection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KolSharedSection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "KolSharedReport"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KolSharedSection_reportId_category_key" ON "KolSharedSection"("reportId", "category");

CREATE TABLE "KolSharedEntry" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "kolId" TEXT,
  "handle" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "summary" TEXT NOT NULL DEFAULT '',
  "profileUrl" TEXT,
  "projects" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tweetUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reportedAt" TIMESTAMP(3),
  CONSTRAINT "KolSharedEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KolSharedEntry_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "KolSharedReport"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "KolSharedEntry_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "Kol"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KolSharedEntry_reportId_handle_key" ON "KolSharedEntry"("reportId", "handle");
CREATE INDEX "KolSharedEntry_handle_idx" ON "KolSharedEntry"("handle");

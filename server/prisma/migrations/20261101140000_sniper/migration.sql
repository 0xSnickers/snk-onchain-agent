CREATE TABLE "SniperControl" (
  "id" TEXT NOT NULL,
  "armed" BOOLEAN NOT NULL DEFAULT false,
  "minProgress" INTEGER NOT NULL DEFAULT 65,
  "minAgentWallets" INTEGER NOT NULL DEFAULT 115,
  "maxUsd" INTEGER NOT NULL DEFAULT 20,
  "dailyUsdCap" INTEGER NOT NULL DEFAULT 60,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SniperControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SniperTarget" (
  "id" TEXT NOT NULL,
  "chainId" TEXT NOT NULL DEFAULT '56',
  "contractAddress" TEXT NOT NULL,
  "symbol" TEXT NOT NULL DEFAULT '',
  "name" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "kind" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "status" TEXT NOT NULL DEFAULT 'WATCHING',
  "progress" DOUBLE PRECISION,
  "holders" INTEGER,
  "agentWallets" INTEGER,
  "reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "evidenceJson" JSONB NOT NULL DEFAULT '{}',
  "imageUrl" TEXT,
  "platform" TEXT NOT NULL DEFAULT '',
  "url" TEXT NOT NULL DEFAULT '',
  "armedAt" TIMESTAMP(3),
  "previewJson" JSONB,
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SniperTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SniperTarget_chainId_contractAddress_key" ON "SniperTarget"("chainId", "contractAddress");
CREATE INDEX "SniperTarget_status_updatedAt_idx" ON "SniperTarget"("status", "updatedAt");

CREATE TABLE "SniperIntent" (
  "id" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "amount" TEXT NOT NULL,
  "asset" TEXT NOT NULL,
  "confirmationText" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "broadcast" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SniperIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SniperIntent_targetId_createdAt_idx" ON "SniperIntent"("targetId", "createdAt");
CREATE INDEX "SniperIntent_createdAt_idx" ON "SniperIntent"("createdAt");

ALTER TABLE "SniperIntent" ADD CONSTRAINT "SniperIntent_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "SniperTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

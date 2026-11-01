-- CreateTable
CREATE TABLE "MintCandidate" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL DEFAULT '56',
    "contractAddress" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "class" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "inputData" TEXT NOT NULL DEFAULT '0x',
    "autoExecute" BOOLEAN NOT NULL DEFAULT false,
    "lastRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MintCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'USER',
    "summary" TEXT NOT NULL DEFAULT '',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "candidateId" TEXT,
    "contextJson" JSONB NOT NULL DEFAULT '{}',
    "actionSeq" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "requestId" TEXT,
    "txHash" TEXT,
    "riskSummary" TEXT NOT NULL DEFAULT '',
    "detailJson" JSONB NOT NULL DEFAULT '{}',
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchBrief" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "symbol" TEXT,
    "riskLevel" TEXT,
    "liquidityUsd" DECIMAL(38,18),
    "top10Percent" DECIMAL(10,4),
    "auditAvailable" BOOLEAN NOT NULL DEFAULT false,
    "dynamicAvailable" BOOLEAN NOT NULL DEFAULT false,
    "bodyMd" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSpendConfirm" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "fromToken" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "slippage" TEXT NOT NULL DEFAULT 'auto',
    "confirmationText" TEXT NOT NULL,
    "quoteJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "UserSpendConfirm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentNotification" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "AgentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLease" (
    "key" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentLease_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "MintCandidate_status_updatedAt_idx" ON "MintCandidate"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MintCandidate_chainId_contractAddress_key" ON "MintCandidate"("chainId", "contractAddress");

-- CreateIndex
CREATE INDEX "AgentRun_startedAt_id_idx" ON "AgentRun"("startedAt", "id");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");

-- CreateIndex
CREATE INDEX "AgentAction_txHash_idx" ON "AgentAction"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAction_runId_seq_key" ON "AgentAction"("runId", "seq");

-- CreateIndex
CREATE INDEX "ResearchBrief_chainId_contractAddress_createdAt_idx" ON "ResearchBrief"("chainId", "contractAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSpendConfirm_runId_key" ON "UserSpendConfirm"("runId");

-- CreateIndex
CREATE INDEX "AgentNotification_createdAt_idx" ON "AgentNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "MintCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchBrief" ADD CONSTRAINT "ResearchBrief_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchBrief" ADD CONSTRAINT "ResearchBrief_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "MintCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSpendConfirm" ADD CONSTRAINT "UserSpendConfirm_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSpendConfirm" ADD CONSTRAINT "UserSpendConfirm_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "ResearchBrief"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


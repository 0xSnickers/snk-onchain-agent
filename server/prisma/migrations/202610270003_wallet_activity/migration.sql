-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "walletScope" TEXT;

-- CreateTable
CREATE TABLE "WalletActivity" (
    "id" TEXT NOT NULL,
    "walletScope" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "txTime" TIMESTAMP(3),
    "movements" JSONB NOT NULL DEFAULT '[]',
    "networkFee" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'BINANCE_AGENTIC_WALLET',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletActivity_walletScope_txTime_id_idx" ON "WalletActivity"("walletScope", "txTime", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WalletActivity_walletScope_chainId_txHash_key" ON "WalletActivity"("walletScope", "chainId", "txHash");

-- CreateIndex
CREATE INDEX "AgentRun_walletScope_startedAt_idx" ON "AgentRun"("walletScope", "startedAt");


CREATE TABLE "ExecutorSession" (
 "id" TEXT PRIMARY KEY CHECK ("id" IN ('w1','w2')),
 "walletScope" TEXT NOT NULL UNIQUE,
 "state" TEXT NOT NULL DEFAULT 'UNCONNECTED', "paused" BOOLEAN NOT NULL DEFAULT false,
 "heartbeatAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "CandidateOutbox" (
 "id" TEXT PRIMARY KEY, "candidateId" TEXT NOT NULL REFERENCES "MintCandidate"("id"),
 "kind" TEXT NOT NULL, "provider" TEXT NOT NULL, "walletScope" TEXT NOT NULL,
 "executorId" TEXT NOT NULL REFERENCES "ExecutorSession"("id"),
 "status" TEXT NOT NULL DEFAULT 'PENDING', "payload" JSONB NOT NULL, "confirmation" JSONB,
 "claimToken" TEXT UNIQUE, "claimedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3) NOT NULL,
 "txHash" TEXT, "runId" TEXT UNIQUE REFERENCES "AgentRun"("id"),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE ("candidateId", "kind", "walletScope")
);
CREATE INDEX "CandidateOutbox_executorId_status_createdAt_idx" ON "CandidateOutbox"("executorId","status","createdAt");

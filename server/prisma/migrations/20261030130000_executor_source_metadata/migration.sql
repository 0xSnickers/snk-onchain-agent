ALTER TABLE "ExecutorSession" ADD COLUMN "sourceRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "agentId" TEXT;
ALTER TABLE "ExecutorSession" ADD CONSTRAINT "ExecutorSession_source_roles_check" CHECK ("sourceRoles" <@ ARRAY['MONITOR','FREE_MINT','PAID','STANDBY','COLLAB']::TEXT[]);

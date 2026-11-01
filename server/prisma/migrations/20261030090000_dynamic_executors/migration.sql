ALTER TABLE "ExecutorSession" DROP CONSTRAINT IF EXISTS "ExecutorSession_id_check";
ALTER TABLE "ExecutorSession" ADD COLUMN "label" TEXT NOT NULL DEFAULT '', ADD COLUMN "role" TEXT NOT NULL DEFAULT 'MONITOR', ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
UPDATE "ExecutorSession" SET "label" = "id", "role" = CASE WHEN "id"='w1' THEN 'FREE_MINT' WHEN "id"='w2' THEN 'PAID' ELSE 'MONITOR' END, "isDefault" = "id" IN ('w1','w2');
ALTER TABLE "ExecutorSession" ADD CONSTRAINT "ExecutorSession_role_check" CHECK ("role" IN ('MONITOR','FREE_MINT','PAID'));
ALTER TABLE "ExecutorSession" ADD CONSTRAINT "ExecutorSession_dynamic_id_check" CHECK ("id" ~ '^[a-z][a-z0-9_-]{0,31}$');
ALTER TABLE "ExecutorSession" ADD CONSTRAINT "ExecutorSession_default_role_check" CHECK (NOT "isDefault" OR "role" <> 'MONITOR');
CREATE UNIQUE INDEX "ExecutorSession_default_role_key" ON "ExecutorSession"("role") WHERE "isDefault";

ALTER TABLE "Kol" ADD COLUMN "xUserId" TEXT, ADD COLUMN "lastSyncedAt" TIMESTAMP(3), ADD COLUMN "syncError" TEXT, ADD COLUMN "nextCursor" TEXT;
CREATE TABLE "KolPost" (
  "id" TEXT NOT NULL, "kolId" TEXT NOT NULL, "postId" TEXT NOT NULL,
  "text" TEXT NOT NULL, "authorId" TEXT NOT NULL, "authorHandle" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3), "likes" INTEGER, "reposts" INTEGER, "replies" INTEGER,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KolPost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KolPost_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "Kol"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KolPost_kolId_postId_key" ON "KolPost"("kolId", "postId");
CREATE INDEX "KolPost_kolId_postedAt_idx" ON "KolPost"("kolId", "postedAt");

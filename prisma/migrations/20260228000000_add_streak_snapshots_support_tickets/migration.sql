-- CreateTable
CREATE TABLE "StreakSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotDate" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streak" INTEGER NOT NULL,
    "lastDevotionalDateCompleted" TEXT,
    "totalDevotionalsCompleted" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "claimedStreak" INTEGER NOT NULL,
    "claimedDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolutionNote" TEXT,
    "beforeState" TEXT NOT NULL DEFAULT '{}',
    "afterState" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "StreakSnapshot_snapshotDate_idx" ON "StreakSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "StreakSnapshot_userId_idx" ON "StreakSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StreakSnapshot_snapshotDate_userId_key" ON "StreakSnapshot"("snapshotDate", "userId");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

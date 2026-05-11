/**
 * db-init.ts
 * Creates all tables with CREATE TABLE IF NOT EXISTS so the server can
 * self-initialize a fresh SQLite database without needing prisma migrate.
 * Also handles additive migrations (ALTER TABLE ADD COLUMN IF NOT EXISTS via check).
 */

import { prisma } from "./prisma";
import { normalizeNickname } from "./lib/nickname-safety";

const DDL = `
CREATE TABLE IF NOT EXISTS "Devotional" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "bibleVerse" TEXT NOT NULL,
  "bibleReference" TEXT NOT NULL,
  "reflection" TEXT NOT NULL,
  "story" TEXT NOT NULL,
  "biblicalCharacter" TEXT NOT NULL,
  "application" TEXT NOT NULL,
  "prayer" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "titleEs" TEXT NOT NULL,
  "bibleVerseEs" TEXT NOT NULL,
  "bibleReferenceEs" TEXT NOT NULL DEFAULT '',
  "reflectionEs" TEXT NOT NULL,
  "storyEs" TEXT NOT NULL,
  "biblicalCharacterEs" TEXT NOT NULL,
  "applicationEs" TEXT NOT NULL,
  "prayerEs" TEXT NOT NULL,
  "topicEs" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Devotional_date_key" ON "Devotional"("date");

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nickname" TEXT NOT NULL,
  "nicknameLower" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "avatarId" TEXT NOT NULL DEFAULT 'avatar_dove',
  "frameId" TEXT,
  "titleId" TEXT,
  "themeId" TEXT NOT NULL DEFAULT 'theme_amanecer',
  "selectedMusicId" TEXT NOT NULL DEFAULT 'music_free_1',
  "points" INTEGER NOT NULL DEFAULT 0,
  "streakCurrent" INTEGER NOT NULL DEFAULT 0,
  "streakBest" INTEGER NOT NULL DEFAULT 0,
  "devotionalsCompleted" INTEGER NOT NULL DEFAULT 0,
  "totalTimeSeconds" INTEGER NOT NULL DEFAULT 0,
  "lastActiveAt" DATETIME,
  "dailyActions" TEXT NOT NULL DEFAULT '{}',
  "deviceId" TEXT,
  "migratedFromUserId" TEXT,
  "communityOptIn" BOOLEAN NOT NULL DEFAULT false,
  "prayerDisplayOptIn" BOOLEAN NOT NULL DEFAULT true,
  "supportCount" INTEGER NOT NULL DEFAULT 0,
  "countryCode" TEXT,
  "showCountry" BOOLEAN NOT NULL DEFAULT true,
  "activeBadgeId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_nickname_key" ON "User"("nickname");
CREATE UNIQUE INDEX IF NOT EXISTS "User_nicknameLower_key" ON "User"("nicknameLower");

CREATE TABLE IF NOT EXISTS "StoreItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameEs" TEXT NOT NULL,
  "descriptionEn" TEXT NOT NULL DEFAULT '',
  "descriptionEs" TEXT NOT NULL DEFAULT '',
  "pricePoints" INTEGER NOT NULL,
  "assetRef" TEXT NOT NULL DEFAULT '',
  "rarity" TEXT NOT NULL DEFAULT 'common',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "UserInventory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'store'
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserInventory_userId_itemId_key" ON "UserInventory"("userId", "itemId");

CREATE TABLE IF NOT EXISTS "WeeklyChallenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "weekId" TEXT NOT NULL,
  "challengeIndex" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "goalCount" INTEGER NOT NULL,
  "rewardPoints" INTEGER NOT NULL,
  "rewardItemId" TEXT,
  "titleEn" TEXT NOT NULL,
  "titleEs" TEXT NOT NULL,
  "descriptionEn" TEXT NOT NULL,
  "descriptionEs" TEXT NOT NULL,
  "startDate" DATETIME NOT NULL,
  "endDate" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyChallenge_weekId_challengeIndex_key" ON "WeeklyChallenge"("weekId", "challengeIndex");

CREATE TABLE IF NOT EXISTS "WeeklyProgress" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "currentCount" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "claimed" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyProgress_userId_challengeId_key" ON "WeeklyProgress"("userId", "challengeId");

CREATE TABLE IF NOT EXISTS "UserFavorite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "devotionalDate" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserFavorite_userId_devotionalDate_key" ON "UserFavorite"("userId", "devotionalDate");

CREATE TABLE IF NOT EXISTS "BiblePassage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "refKey" TEXT NOT NULL,
  "lang" TEXT NOT NULL,
  "book" TEXT NOT NULL,
  "chapterStart" INTEGER NOT NULL,
  "verseStart" INTEGER NOT NULL,
  "chapterEnd" INTEGER,
  "verseEnd" INTEGER,
  "referenceDisplay" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'api',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "BiblePassage_refKey_lang_key" ON "BiblePassage"("refKey", "lang");
CREATE INDEX IF NOT EXISTS "BiblePassage_lang_idx" ON "BiblePassage"("lang");

CREATE TABLE IF NOT EXISTS "PointLedger" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "ledgerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "dateId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PointLedger_userId_ledgerId_key" ON "PointLedger"("userId", "ledgerId");
CREATE INDEX IF NOT EXISTS "PointLedger_userId_idx" ON "PointLedger"("userId");

CREATE TABLE IF NOT EXISTS "TransferCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "sourceUserId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "usedByUserId" TEXT,
  "usedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TransferCode_code_key" ON "TransferCode"("code");

CREATE TABLE IF NOT EXISTS "PromoCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayCode" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "maxUses" INTEGER,
  "totalUses" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PromoRedemption" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "codeId" TEXT NOT NULL,
  "pointsAwarded" INTEGER NOT NULL,
  "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromoRedemption_userId_codeId_key" ON "PromoRedemption"("userId", "codeId");

CREATE TABLE IF NOT EXISTS "PrayerRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "categoryKey" TEXT NOT NULL,
  "nickname" TEXT,
  "avatarId" TEXT,
  "frameId" TEXT,
  "titleId" TEXT,
  "displayNameOptIn" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "PrayerRequest_userId_periodId_mode_key" ON "PrayerRequest"("userId", "periodId", "mode");
CREATE INDEX IF NOT EXISTS "PrayerRequest_periodId_mode_idx" ON "PrayerRequest"("periodId", "mode");
CREATE INDEX IF NOT EXISTS "PrayerRequest_expiresAt_idx" ON "PrayerRequest"("expiresAt");

CREATE TABLE IF NOT EXISTS "DailyPrayer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "prayerText" TEXT NOT NULL,
  "includedCategories" TEXT NOT NULL DEFAULT '[]',
  "titleEs" TEXT NOT NULL,
  "prayerTextEs" TEXT NOT NULL,
  "totalRequests" INTEGER NOT NULL DEFAULT 0,
  "categoryStats" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DailyPrayer_dateId_key" ON "DailyPrayer"("dateId");

CREATE TABLE IF NOT EXISTS "AppBranding" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'app',
  "appName" TEXT NOT NULL DEFAULT 'Luz Diaria',
  "taglineEs" TEXT NOT NULL DEFAULT 'Tu devocional diario',
  "taglineEn" TEXT NOT NULL DEFAULT 'Your daily devotional',
  "shareWatermarkEnabled" BOOLEAN NOT NULL DEFAULT true,
  "shareWatermarkPosition" TEXT NOT NULL DEFAULT 'bottom-left',
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "CollectionClaim" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "pointsAwarded" INTEGER NOT NULL,
  "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CollectionClaim_userId_collectionId_key" ON "CollectionClaim"("userId", "collectionId");
CREATE INDEX IF NOT EXISTS "CollectionClaim_userId_idx" ON "CollectionClaim"("userId");

CREATE TABLE IF NOT EXISTS "UserChapterProgress" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "claimedChapterIds" TEXT NOT NULL DEFAULT '[]',
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserChapterProgress_userId_collectionId_key" ON "UserChapterProgress"("userId", "collectionId");
CREATE INDEX IF NOT EXISTS "UserChapterProgress_userId_idx" ON "UserChapterProgress"("userId");

CREATE TABLE IF NOT EXISTS "DevotionalCompletion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "devotionalDate" TEXT NOT NULL,
  "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "DevotionalCompletion_userId_devotionalDate_key" ON "DevotionalCompletion"("userId", "devotionalDate");
CREATE INDEX IF NOT EXISTS "DevotionalCompletion_userId_idx" ON "DevotionalCompletion"("userId");

CREATE TABLE IF NOT EXISTS "UserSupport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "dateId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserSupport_fromUserId_toUserId_dateId_key" ON "UserSupport"("fromUserId", "toUserId", "dateId");
CREATE INDEX IF NOT EXISTS "UserSupport_toUserId_idx" ON "UserSupport"("toUserId");
CREATE INDEX IF NOT EXISTS "UserSupport_fromUserId_idx" ON "UserSupport"("fromUserId");

CREATE TABLE IF NOT EXISTS "StreakSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "snapshotDate" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "streak" INTEGER NOT NULL,
  "lastDevotionalDateCompleted" TEXT,
  "totalDevotionalsCompleted" INTEGER NOT NULL,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "StreakSnapshot_snapshotDate_userId_key" ON "StreakSnapshot"("snapshotDate", "userId");
CREATE INDEX IF NOT EXISTS "StreakSnapshot_snapshotDate_idx" ON "StreakSnapshot"("snapshotDate");
CREATE INDEX IF NOT EXISTS "StreakSnapshot_userId_idx" ON "StreakSnapshot"("userId");

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "claimedStreak" INTEGER NOT NULL DEFAULT 0,
  "claimedDate" TEXT NOT NULL DEFAULT '',
  "clientClaim" TEXT NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolutionNote" TEXT,
  "beforeState" TEXT NOT NULL DEFAULT '{}',
  "afterState" TEXT NOT NULL DEFAULT '{}',
  "botPreview" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "SupportTicket_userId_idx" ON "SupportTicket"("userId");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX IF NOT EXISTS "SupportTicket_type_idx" ON "SupportTicket"("type");

CREATE TABLE IF NOT EXISTS "GiftDrop" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "rewardType" TEXT NOT NULL,
  "rewardId" TEXT NOT NULL,
  "audienceType" TEXT NOT NULL DEFAULT 'ALL_USERS',
  "audienceUserIds" TEXT NOT NULL DEFAULT '[]',
  "startsAt" DATETIME,
  "endsAt" DATETIME,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "UserGift" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "giftDropId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "claimedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserGift_userId_giftDropId_key" ON "UserGift"("userId", "giftDropId");
CREATE INDEX IF NOT EXISTS "UserGift_userId_idx" ON "UserGift"("userId");
CREATE INDEX IF NOT EXISTS "UserGift_giftDropId_idx" ON "UserGift"("giftDropId");

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforeRole" TEXT NOT NULL,
  "afterRole" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorUserId_idx" ON "AdminAuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetUserId_idx" ON "AdminAuditLog"("targetUserId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
`;

export async function initDatabase(): Promise<void> {
  // Split by semicolons, filter empty, execute each statement
  const statements = DDL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt + ";");
    } catch (e: unknown) {
      // Already exists or benign — skip
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("already exists") && !msg.includes("duplicate")) {
        console.warn("[DB Init] Statement failed:", msg.slice(0, 120));
      }
    }
  }

  // Additive migrations for existing tables (ALTER TABLE ADD COLUMN IF NOT EXISTS)
  await addColumnIfMissing("SupportTicket", "clientClaim", `TEXT NOT NULL DEFAULT '{}'`);
  await addColumnIfMissing("SupportTicket", "botPreview", `TEXT NOT NULL DEFAULT '{}'`);
  await addColumnIfMissing("User", "role", `TEXT NOT NULL DEFAULT 'USER'`);
  await addColumnIfMissing("User", "communityOptIn", `BOOLEAN NOT NULL DEFAULT false`);
  await addColumnIfMissing("User", "prayerDisplayOptIn", `BOOLEAN NOT NULL DEFAULT true`);
  await addColumnIfMissing("User", "supportCount", `INTEGER NOT NULL DEFAULT 0`);
  await addColumnIfMissing("User", "countryCode", `TEXT`);
  await addColumnIfMissing("User", "showCountry", `BOOLEAN NOT NULL DEFAULT true`);
  await addColumnIfMissing("User", "activeBadgeId", `TEXT`);
  await addColumnIfMissing("User", "normalizedNickname", `TEXT NOT NULL DEFAULT ''`);

  // Backfill normalizedNickname for existing users (one-time migration)
  await backfillNormalizedNicknames();

  console.log("[DB Init] Schema initialization complete");
}

async function addColumnIfMissing(
  table: string,
  column: string,
  definition: string
): Promise<void> {
  try {
    const cols = (
      await prisma.$queryRawUnsafe<{ name: string }[]>(
        `PRAGMA table_info('${table}')`
      )
    ).map((r) => r.name);
    if (!cols.includes(column)) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`
      );
      console.log(`[DB Init] Added ${table}.${column}`);
    }
  } catch (e) {
    // ignore
  }
}

async function backfillNormalizedNicknames(): Promise<void> {
  try {
    // Find users whose normalizedNickname is still empty
    const users = await prisma.$queryRawUnsafe<{ id: string; nickname: string }[]>(
      `SELECT "id", "nickname" FROM "User" WHERE "normalizedNickname" = '' OR "normalizedNickname" IS NULL`
    );
    if (users.length === 0) return;
    for (const user of users) {
      const normalized = normalizeNickname(user.nickname);
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "normalizedNickname" = ? WHERE "id" = ?`,
        normalized,
        user.id
      );
    }
    console.log(`[DB Init] Backfilled normalizedNickname for ${users.length} users`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[DB Init] backfillNormalizedNicknames failed:", msg.slice(0, 120));
  }
}

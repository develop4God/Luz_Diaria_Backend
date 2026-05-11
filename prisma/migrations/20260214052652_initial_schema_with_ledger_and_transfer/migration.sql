-- CreateTable
CREATE TABLE "Devotional" (
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

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT NOT NULL,
    "nicknameLower" TEXT NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StoreItem" (
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

-- CreateTable
CREATE TABLE "UserInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'store',
    CONSTRAINT "UserInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserInventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StoreItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyChallenge" (
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

-- CreateTable
CREATE TABLE "WeeklyProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WeeklyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeeklyProgress_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "WeeklyChallenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "devotionalDate" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BiblePassage" (
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

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ledgerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedByUserId" TEXT,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferCode_sourceUserId_fkey" FOREIGN KEY ("sourceUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Devotional_date_key" ON "Devotional"("date");

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "User_nicknameLower_key" ON "User"("nicknameLower");

-- CreateIndex
CREATE UNIQUE INDEX "UserInventory_userId_itemId_key" ON "UserInventory"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyChallenge_weekId_challengeIndex_key" ON "WeeklyChallenge"("weekId", "challengeIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyProgress_userId_challengeId_key" ON "WeeklyProgress"("userId", "challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavorite_userId_devotionalDate_key" ON "UserFavorite"("userId", "devotionalDate");

-- CreateIndex
CREATE INDEX "BiblePassage_lang_idx" ON "BiblePassage"("lang");

-- CreateIndex
CREATE UNIQUE INDEX "BiblePassage_refKey_lang_key" ON "BiblePassage"("refKey", "lang");

-- CreateIndex
CREATE INDEX "PointLedger_userId_idx" ON "PointLedger"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PointLedger_userId_ledgerId_key" ON "PointLedger"("userId", "ledgerId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferCode_code_key" ON "TransferCode"("code");

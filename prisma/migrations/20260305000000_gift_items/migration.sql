-- CreateTable
CREATE TABLE "GiftTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderUserId" TEXT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiftTransaction_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GiftTransaction_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GiftNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "giftTransactionId" TEXT NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiftNotification_giftTransactionId_fkey" FOREIGN KEY ("giftTransactionId") REFERENCES "GiftTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GiftTransaction_senderUserId_idx" ON "GiftTransaction"("senderUserId");

-- CreateIndex
CREATE INDEX "GiftTransaction_receiverUserId_idx" ON "GiftTransaction"("receiverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftNotification_userId_giftTransactionId_key" ON "GiftNotification"("userId", "giftTransactionId");

-- CreateIndex
CREATE INDEX "GiftNotification_userId_idx" ON "GiftNotification"("userId");

-- CreateIndex
CREATE INDEX "GiftNotification_seen_idx" ON "GiftNotification"("seen");

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

export const storeGiftsRouter = new Hono();

const DAILY_GIFT_LIMIT = 3;
const WEEKLY_GIFT_LIMIT = 20;

// POST /store/gift — send a store item as a gift to another user
storeGiftsRouter.post(
  "/gift",
  zValidator("json", z.object({
    senderUserId: z.string(),
    receiverUserId: z.string(),
    itemId: z.string(),
    message: z.string().max(120).default(""),
  })),
  async (c) => {
    const { senderUserId, receiverUserId, itemId, message } = c.req.valid("json");

    // 1. Cannot gift to yourself
    if (senderUserId === receiverUserId) {
      return c.json({ error: "CANNOT_GIFT_SELF" }, 400);
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 2. Validate sender exists
        const sender = await tx.user.findUnique({ where: { id: senderUserId } });
        if (!sender) throw new Error("SENDER_NOT_FOUND");

        // 3. Validate receiver exists
        const receiver = await tx.user.findUnique({ where: { id: receiverUserId } });
        if (!receiver) throw new Error("RECEIVER_NOT_FOUND");

        // 4. Validate item exists and is available
        const item = await tx.storeItem.findUnique({ where: { id: itemId } });
        if (!item) throw new Error("ITEM_NOT_FOUND");
        if (!item.available) throw new Error("ITEM_NOT_AVAILABLE");
        if (item.pricePoints === 0) throw new Error("ITEM_NOT_GIFTABLE"); // free items can't be gifted (they can just claim)
        if (item.comingSoon) throw new Error("ITEM_NOT_AVAILABLE");

        // 5. Check sender has enough points
        if (sender.points < item.pricePoints) throw new Error("INSUFFICIENT_POINTS");

        // 6. Check daily/weekly gift limits for sender
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday

        const dailyCount = await tx.giftTransaction.count({
          where: { senderUserId, createdAt: { gte: todayStart } },
        });
        if (dailyCount >= DAILY_GIFT_LIMIT) throw new Error("DAILY_LIMIT_REACHED");

        const weeklyCount = await tx.giftTransaction.count({
          where: { senderUserId, createdAt: { gte: weekStart } },
        });
        if (weeklyCount >= WEEKLY_GIFT_LIMIT) throw new Error("WEEKLY_LIMIT_REACHED");

        // 7. Deduct points from sender
        await tx.user.update({
          where: { id: senderUserId },
          data: { points: { decrement: item.pricePoints } },
        });

        // Also record in point ledger
        const ledgerId = `gift_sent_${senderUserId}_${itemId}_${Date.now()}`;
        await tx.pointLedger.create({
          data: {
            userId: senderUserId,
            ledgerId,
            type: "gift_sent",
            dateId: todayStart.toISOString().slice(0, 10),
            amount: -item.pricePoints,
            metadata: JSON.stringify({ itemId, receiverUserId }),
          },
        });

        // 8. Add item to receiver's inventory (throw if already owned)
        const existingInventory = await tx.userInventory.findUnique({
          where: { userId_itemId: { userId: receiverUserId, itemId } },
        });
        if (existingInventory) throw new Error("RECEIVER_ALREADY_HAS_ITEM");
        await tx.userInventory.create({
          data: {
            userId: receiverUserId,
            itemId,
            source: "gift",
          },
        });

        // 9. Create gift transaction (idempotency: check for recent duplicate)
        const giftTransaction = await tx.giftTransaction.create({
          data: {
            senderUserId,
            receiverUserId,
            itemId,
            pricePaid: item.pricePoints,
            message: message ?? "",
            status: "sent",
          },
        });

        // 10. Create gift notification for receiver
        await tx.giftNotification.create({
          data: {
            userId: receiverUserId,
            giftTransactionId: giftTransaction.id,
            seen: false,
          },
        });

        return { giftTransaction, receiver, item };
      });

      return c.json({
        success: true,
        giftId: result.giftTransaction.id,
        receiverNickname: result.receiver.nickname,
        itemName: result.item.nameEs,
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "UNKNOWN_ERROR";
      const statusMap: Record<string, number> = {
        SENDER_NOT_FOUND: 404,
        RECEIVER_NOT_FOUND: 404,
        ITEM_NOT_FOUND: 404,
        ITEM_NOT_AVAILABLE: 400,
        ITEM_NOT_GIFTABLE: 400,
        INSUFFICIENT_POINTS: 400,
        RECEIVER_ALREADY_HAS_ITEM: 400,
        DAILY_LIMIT_REACHED: 429,
        WEEKLY_LIMIT_REACHED: 429,
      };
      return c.json({ error: msg }, (statusMap[msg] ?? 500) as 400 | 404 | 429 | 500);
    }
  }
);

// GET /store/gift/notifications — fetch unseen gift notifications for a user
storeGiftsRouter.get("/gift/notifications", async (c) => {
  const userId = c.req.header("X-User-Id");
  if (!userId) return c.json({ error: "Missing X-User-Id" }, 400);

  try {
    const notifications = await prisma.giftNotification.findMany({
      where: { userId, seen: false },
      include: {
        giftTransaction: {
          include: {
            sender: { select: { id: true, nickname: true, avatarId: true, frameId: true, titleId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // For each notification, also fetch the item info
    const result = await Promise.all(
      notifications.map(async (notif) => {
        const item = await prisma.storeItem.findUnique({
          where: { id: notif.giftTransaction.itemId },
          select: { id: true, nameEs: true, nameEn: true, type: true, assetRef: true, rarity: true },
        });
        return {
          notificationId: notif.id,
          giftId: notif.giftTransactionId,
          senderNickname: notif.giftTransaction.sender.nickname,
          senderAvatarId: notif.giftTransaction.sender.avatarId,
          message: notif.giftTransaction.message,
          createdAt: notif.giftTransaction.createdAt,
          item,
        };
      })
    );

    return c.json({ notifications: result });
  } catch (err) {
    console.error("[GiftNotifications] Error:", err);
    return c.json({ error: "Failed to fetch notifications" }, 500);
  }
});

// POST /store/gift/notifications/:id/seen — mark a gift notification as seen
storeGiftsRouter.post("/gift/notifications/:id/seen", async (c) => {
  const userId = c.req.header("X-User-Id");
  const id = c.req.param("id");
  if (!userId) return c.json({ error: "Missing X-User-Id" }, 400);

  try {
    await prisma.giftNotification.updateMany({
      where: { id, userId },
      data: { seen: true },
    });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Failed to mark seen" }, 500);
  }
});

// GET /store/gift/search-users — search users by nickname prefix
storeGiftsRouter.get("/gift/search-users", async (c) => {
  const userId = c.req.header("X-User-Id");
  const query = c.req.query("q") ?? "";
  if (!userId) return c.json({ error: "Missing X-User-Id" }, 400);
  if (query.length < 2) return c.json({ users: [] });

  try {
    const users = await prisma.user.findMany({
      where: {
        nicknameLower: { contains: query.toLowerCase() },
        id: { not: userId }, // exclude self
      },
      select: { id: true, nickname: true, avatarId: true, frameId: true, titleId: true },
      take: 10,
      orderBy: { nicknameLower: "asc" },
    });
    return c.json({ users });
  } catch (err) {
    return c.json({ error: "Search failed" }, 500);
  }
});

// GET /store/gift/giftable-items — items giftable to a specific receiver
// Query params: receiverId (required), type (optional: avatar|frame|title|theme)
storeGiftsRouter.get("/gift/giftable-items", async (c) => {
  const userId = c.req.header("X-User-Id");
  const receiverId = c.req.query("receiverId") ?? "";
  const type = c.req.query("type") ?? "";
  if (!userId) return c.json({ error: "Missing X-User-Id" }, 400);
  if (!receiverId) return c.json({ error: "Missing receiverId" }, 400);

  try {
    const whereClause: Record<string, unknown> = {
      available: true,
      comingSoon: false,
      pricePoints: { gt: 0 },
    };
    if (type) whereClause.type = type;

    const items = await prisma.storeItem.findMany({
      where: whereClause,
      orderBy: [{ rarity: "asc" }, { pricePoints: "asc" }],
    });

    // Get receiver's current inventory item IDs
    const receiverInventory = await prisma.userInventory.findMany({
      where: { userId: receiverId },
      select: { itemId: true },
    });
    const ownedItemIds = new Set(receiverInventory.map((inv) => inv.itemId));

    const result = items.map((item) => ({
      ...item,
      receiverOwns: ownedItemIds.has(item.id),
    }));

    return c.json({ items: result });
  } catch (err) {
    console.error("[GiftableItems] Error:", err);
    return c.json({ error: "Failed to fetch items" }, 500);
  }
});

// POST /store/gift/notifications/:id/accept — receiver accepts gift, notifies sender
storeGiftsRouter.post("/gift/notifications/:id/accept", async (c) => {
  const userId = c.req.header("X-User-Id");
  const id = c.req.param("id");
  if (!userId) return c.json({ error: "Missing X-User-Id" }, 400);

  try {
    // Mark notification as seen
    const notif = await prisma.giftNotification.findFirst({
      where: { id, userId },
      include: {
        giftTransaction: {
          include: {
            receiver: { select: { id: true, nickname: true } },
            sender: { select: { id: true, nickname: true } },
          },
        },
      },
    });

    if (!notif) return c.json({ error: "Notification not found" }, 404);

    await prisma.giftNotification.update({
      where: { id },
      data: { seen: true },
    });

    // Update gift transaction status to "delivered"
    await prisma.giftTransaction.update({
      where: { id: notif.giftTransactionId },
      data: { status: "delivered" },
    });

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Failed to accept gift" }, 500);
  }
});

// POST /store/gift/notifications/:id/reject — receiver rejects gift (marks seen)
storeGiftsRouter.post("/gift/notifications/:id/reject", async (c) => {
  const userId = c.req.header("X-User-Id");
  const id = c.req.param("id");
  if (!userId) return c.json({ error: "Missing X-User-Id" }, 400);

  try {
    await prisma.giftNotification.updateMany({
      where: { id, userId },
      data: { seen: true },
    });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Failed to reject gift" }, 500);
  }
});

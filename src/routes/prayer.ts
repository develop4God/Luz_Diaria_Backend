import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

export const prayerRouter = new Hono();

// ============================================
// TYPES & CONSTANTS
// ============================================

const PRAYER_CATEGORIES = [
  'work', 'health', 'family', 'peace', 'wisdom',
  'studies', 'restoration', 'gratitude', 'salvation', 'strength', 'friend_strength'
] as const;

type PrayerCategoryKey = typeof PRAYER_CATEGORIES[number];

const PRAYER_POINTS = {
  SUBMIT_REQUEST: 10,       // Once per day max
  PRAYED_FOR_COMMUNITY: 5,  // Once per day max
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getCostaRicaDateString(): string {
  const now = new Date();
  const costaRicaTime = new Date(now.getTime() - (6 * 60 * 60 * 1000));
  return costaRicaTime.toISOString().split('T')[0]!;
}

// Fixed 48-hour expiration from now
function get48HourExpiration(): Date {
  return new Date(Date.now() + 48 * 60 * 60 * 1000);
}

// Period ID is a fixed constant — one slot per user at all times
const SINGLE_PERIOD_ID = "active";

// ============================================
// VALIDATION SCHEMAS
// ============================================

const submitPrayerRequestSchema = z.object({
  userId: z.string(),
  categoryKey: z.enum(PRAYER_CATEGORIES),
});

const prayedForCommunitySchema = z.object({
  userId: z.string(),
});

const updatePrayerDisplayOptInSchema = z.object({
  optIn: z.boolean(),
});

// ============================================
// PRAYER REQUEST ENDPOINTS
// ============================================

// POST /request — Submit or replace the user's single active petition
prayerRouter.post(
  "/request",
  zValidator("json", submitPrayerRequestSchema),
  async (c) => {
    try {
      const { userId, categoryKey } = c.req.valid("json");
      const expiresAt = get48HourExpiration();
      const today = getCostaRicaDateString();
      // Use 'daily' as the mode value to keep schema compatibility
      const mode = "daily";

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("USER_NOT_FOUND");

        // Delete any existing petition for this user (single-petition model)
        await tx.prayerRequest.deleteMany({ where: { userId } });

        // Create the new petition
        const prayerRequest = await tx.prayerRequest.create({
          data: {
            userId,
            periodId: SINGLE_PERIOD_ID,
            mode,
            categoryKey,
            expiresAt,
            nickname: user.prayerDisplayOptIn ? user.nickname : null,
            avatarId: user.avatarId,
            frameId: user.frameId,
            titleId: user.titleId,
            displayNameOptIn: user.prayerDisplayOptIn,
          },
        });

        // Award points for submitting (once per day max)
        const ledgerId = `prayer_request_${today}`;
        const existingLedger = await tx.pointLedger.findUnique({
          where: { userId_ledgerId: { userId, ledgerId } },
        });

        let pointsAwarded = 0;
        if (!existingLedger) {
          await tx.pointLedger.create({
            data: {
              userId,
              ledgerId,
              type: "prayer_request",
              dateId: today,
              amount: PRAYER_POINTS.SUBMIT_REQUEST,
              metadata: JSON.stringify({ categoryKey }),
            },
          });
          await tx.user.update({
            where: { id: userId },
            data: { points: { increment: PRAYER_POINTS.SUBMIT_REQUEST } },
          });
          pointsAwarded = PRAYER_POINTS.SUBMIT_REQUEST;
        }

        return { prayerRequest, pointsAwarded };
      });

      return c.json({
        success: true,
        prayerRequest: result.prayerRequest,
        pointsAwarded: result.pointsAwarded,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg === "USER_NOT_FOUND") return c.json({ error: "User not found" }, 404);
      console.error("[Prayer] Error submitting prayer request:", error);
      return c.json({ error: "Failed to submit prayer request" }, 500);
    }
  }
);

// GET /request/:userId — Get user's single active petition (if not expired)
prayerRouter.get("/request/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const now = new Date();

    const requests = await prisma.prayerRequest.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    return c.json({ requests });
  } catch (error) {
    console.error("[Prayer] Error getting user prayer requests:", error);
    return c.json({ error: "Failed to get prayer requests" }, 500);
  }
});

// DELETE /request/:userId — Delete user's active petition
prayerRouter.delete("/request/:userId/:mode", async (c) => {
  try {
    const userId = c.req.param("userId");
    await prisma.prayerRequest.deleteMany({ where: { userId } });
    return c.json({ success: true });
  } catch (error) {
    console.error("[Prayer] Error deleting prayer request:", error);
    return c.json({ error: "Failed to delete prayer request" }, 500);
  }
});

// ============================================
// COMMUNITY PRAYER REQUESTS ENDPOINTS
// ============================================

// GET /community — All active petitions (used for category count aggregation)
prayerRouter.get("/community", async (c) => {
  try {
    const now = new Date();

    const requests = await prisma.prayerRequest.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        categoryKey: true,
        mode: true,
        nickname: true,
        avatarId: true,
        frameId: true,
        titleId: true,
        displayNameOptIn: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return c.json({ requests, total: requests.length, limit: requests.length, offset: 0 });
  } catch (error) {
    console.error("[Prayer] Error getting community prayer requests:", error);
    return c.json({ error: "Failed to get community prayer requests" }, 500);
  }
});

// GET /summary — Aggregated category counts for active petitions
prayerRouter.get("/summary", async (c) => {
  try {
    const now = new Date();

    const requests = await prisma.prayerRequest.findMany({
      where: { expiresAt: { gt: now } },
      select: { categoryKey: true },
    });

    const summary: Record<string, number> = {};
    for (const r of requests) {
      summary[r.categoryKey] = (summary[r.categoryKey] ?? 0) + 1;
    }

    return c.json({ summary, total: requests.length });
  } catch (error) {
    console.error("[Prayer] Error getting prayer summary:", error);
    return c.json({ error: "Failed to get prayer summary" }, 500);
  }
});

// ============================================
// DAILY PRAYER ENDPOINTS
// ============================================

prayerRouter.get("/daily/:dateId", async (c) => {
  try {
    const dateId = c.req.param("dateId");
    const dailyPrayer = await prisma.dailyPrayer.findUnique({ where: { dateId } });
    if (!dailyPrayer) return c.json({ error: "Daily prayer not found" }, 404);
    return c.json({
      ...dailyPrayer,
      includedCategories: JSON.parse(dailyPrayer.includedCategories),
      categoryStats: JSON.parse(dailyPrayer.categoryStats),
    });
  } catch (error) {
    console.error("[Prayer] Error getting daily prayer:", error);
    return c.json({ error: "Failed to get daily prayer" }, 500);
  }
});

prayerRouter.get("/daily/today", async (c) => {
  try {
    const today = getCostaRicaDateString();
    const dailyPrayer = await prisma.dailyPrayer.findUnique({ where: { dateId: today } });
    if (!dailyPrayer) return c.json({ error: "Today's prayer not found", dateId: today }, 404);
    return c.json({
      ...dailyPrayer,
      includedCategories: JSON.parse(dailyPrayer.includedCategories),
      categoryStats: JSON.parse(dailyPrayer.categoryStats),
    });
  } catch (error) {
    console.error("[Prayer] Error getting today's prayer:", error);
    return c.json({ error: "Failed to get today's prayer" }, 500);
  }
});

// ============================================
// "YA ORÉ HOY" ENDPOINT
// ============================================

prayerRouter.post(
  "/prayed-for-community",
  zValidator("json", prayedForCommunitySchema),
  async (c) => {
    try {
      const { userId } = c.req.valid("json");
      const today = getCostaRicaDateString();

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("USER_NOT_FOUND");

        const ledgerId = `prayed_community_${today}`;
        const existingLedger = await tx.pointLedger.findUnique({
          where: { userId_ledgerId: { userId, ledgerId } },
        });

        if (existingLedger) return { alreadyPrayed: true, pointsAwarded: 0 };

        await tx.pointLedger.create({
          data: {
            userId,
            ledgerId,
            type: "prayed_community",
            dateId: today,
            amount: PRAYER_POINTS.PRAYED_FOR_COMMUNITY,
            metadata: JSON.stringify({}),
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { points: { increment: PRAYER_POINTS.PRAYED_FOR_COMMUNITY } },
        });

        return { alreadyPrayed: false, pointsAwarded: PRAYER_POINTS.PRAYED_FOR_COMMUNITY };
      });

      if (result.alreadyPrayed) {
        return c.json({ success: false, alreadyPrayed: true });
      }

      return c.json({ success: true, pointsAwarded: result.pointsAwarded });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg === "USER_NOT_FOUND") return c.json({ error: "User not found" }, 404);
      console.error("[Prayer] Error recording community prayer:", error);
      return c.json({ error: "Failed to record community prayer" }, 500);
    }
  }
);

prayerRouter.get("/prayed-for-community/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const today = getCostaRicaDateString();
    const ledgerId = `prayed_community_${today}`;
    const existing = await prisma.pointLedger.findUnique({
      where: { userId_ledgerId: { userId, ledgerId } },
    });
    return c.json({ prayedToday: !!existing });
  } catch (error) {
    console.error("[Prayer] Error checking community prayer status:", error);
    return c.json({ error: "Failed to check status" }, 500);
  }
});

// ============================================
// PRAYER DISPLAY OPT-IN ENDPOINTS
// ============================================

prayerRouter.patch(
  "/display-opt-in/:userId",
  zValidator("json", updatePrayerDisplayOptInSchema),
  async (c) => {
    try {
      const userId = c.req.param("userId");
      const { optIn } = c.req.valid("json");
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return c.json({ error: "User not found" }, 404);
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { prayerDisplayOptIn: optIn },
      });
      return c.json({ success: true, prayerDisplayOptIn: updated.prayerDisplayOptIn });
    } catch (error) {
      console.error("[Prayer] Error updating display opt-in:", error);
      return c.json({ error: "Failed to update prayer display opt-in" }, 500);
    }
  }
);

prayerRouter.get("/display-opt-in/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { prayerDisplayOptIn: true },
    });
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ prayerDisplayOptIn: user.prayerDisplayOptIn });
  } catch (error) {
    console.error("[Prayer] Error getting display opt-in status:", error);
    return c.json({ error: "Failed to get display opt-in status" }, 500);
  }
});

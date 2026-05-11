// Duel Queue — Matchmaking for Duelo de Sabiduría
// POST /api/duel/queue/join    — enter matchmaking queue
// GET  /api/duel/queue/status/:userId — poll for match result
// POST /api/duel/queue/leave   — leave queue (cancel search)

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";

const queueRouter = new Hono();

const QUEUE_TTL_MS     = 3 * 60 * 1000; // 3 min before queue entry expires
const DAILY_REWARD_CAP = 10;

// Rating tolerance expands over time: ±200 → ±400 → unlimited
function getRatingTolerance(waitingSinceMs: number): number {
  const waited = Date.now() - waitingSinceMs;
  if (waited >= 5000) return 9999; // any opponent after 5s
  if (waited >= 3000) return 400;
  return 200;
}

// ─── Helper: try to match a player ────────────────────────────────────────────
// Returns match data if matched, null if added to queue.
async function tryMatch(
  userId: string,
  duelRating: number,
  questionIds: string[]
): Promise<{
  matched: true;
  matchId: string;
  opponentId: string;
  opponentName: string;
  opponentAvatarId: string;
  opponentTitleId: string | null;
  opponentCountryCode: string | null;
  finalQuestionIds: string[];
  playerNumber: 2;
} | { matched: false }> {
  return prisma.$transaction(async (tx) => {
    // 1. Remove stale waiting entries (older than TTL)
    await tx.duelQueue.deleteMany({
      where: {
        status: "waiting",
        joinedAt: { lt: new Date(Date.now() - QUEUE_TTL_MS) },
      },
    });

    // 2. Find best available opponent — prefer closest rating,
    //    but use each waiting player's own tolerance based on how long they've waited.
    const waitingOpponents = await tx.duelQueue.findMany({
      where: {
        status: "waiting",
        userId: { not: userId },
      },
      orderBy: { joinedAt: "asc" }, // oldest first (fairness)
    });

    // Pick the first opponent whose tolerance (based on wait time) covers our rating,
    // or whose rating is within our own tolerance.
    const myTolerance = 200; // joiner always uses base tolerance
    const opponent = waitingOpponents.find((op) => {
      const opTolerance = getRatingTolerance(op.joinedAt.getTime());
      const ratingDiff = Math.abs(op.duelRating - duelRating);
      return ratingDiff <= Math.max(myTolerance, opTolerance);
    }) ?? null;

    if (opponent) {
      // Use the waiting player's questions (they've been waiting longer)
      const opponentQIds = JSON.parse(opponent.questionIds) as string[];
      const finalQuestionIds = opponentQIds.length >= 10 ? opponentQIds : questionIds;

      // Create the human match — seed lastSeen timestamps so heartbeat
      // doesn't immediately see null and falsely declare a disconnect.
      const now = new Date();
      const match = await tx.duelMatch.create({
        data: {
          player1UserId: opponent.userId,
          player2UserId: userId,
          status: "in_progress",
          questions: JSON.stringify(finalQuestionIds),
          isBotMatch: false,
          player1LastSeen: now,
          player2LastSeen: now,
        },
      });

      // Mark both queue entries as matched
      await tx.duelQueue.updateMany({
        where: { userId: { in: [userId, opponent.userId] } },
        data: { status: "matched", matchId: match.id },
      });

      // Fetch opponent nickname + cosmetics
      const opponentUser = await tx.user.findUnique({
        where: { id: opponent.userId },
        select: { nickname: true, avatarId: true, titleId: true, countryCode: true },
      });

      return {
        matched: true as const,
        matchId: match.id,
        opponentId: opponent.userId,
        opponentName: opponentUser?.nickname ?? "Rival",
        opponentAvatarId: opponentUser?.avatarId ?? "avatar_dove",
        opponentTitleId: opponentUser?.titleId ?? null,
        opponentCountryCode: opponentUser?.countryCode ?? null,
        finalQuestionIds,
        playerNumber: 2 as const,
      };
    }

    // 3. No match — upsert own queue entry
    await tx.duelQueue.upsert({
      where: { userId },
      create: {
        userId,
        duelRating,
        questionIds: JSON.stringify(questionIds),
        status: "waiting",
      },
      update: {
        duelRating,
        questionIds: JSON.stringify(questionIds),
        status: "waiting",
        joinedAt: new Date(),
        matchId: null,
      },
    });

    return { matched: false };
  });
}

// ─── POST /api/duel/queue/join ─────────────────────────────────────────────────
queueRouter.post(
  "/join",
  zValidator(
    "json",
    z.object({
      userId: z.string(),
      questionIds: z.array(z.string()).min(1).max(20),
    })
  ),
  async (c) => {
    const { userId, questionIds } = c.req.valid("json");

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { duelRating: true, duelRewardCount: true, duelRewardDate: true },
      });
      if (!user) return c.json({ error: "User not found" }, 404);

      const result = await tryMatch(userId, user.duelRating, questionIds);

      if (result.matched) {
        const today = new Date().toISOString().slice(0, 10);
        const rewardCountToday =
          user.duelRewardDate === today ? user.duelRewardCount : 0;
        const rewardedDuelsLeft = Math.max(0, DAILY_REWARD_CAP - rewardCountToday);

        return c.json({
          status: "matched",
          matchId: result.matchId,
          opponentName: result.opponentName,
          opponentId: result.opponentId,
          opponentAvatarId: result.opponentAvatarId,
          opponentTitleId: result.opponentTitleId,
          opponentCountryCode: result.opponentCountryCode,
          questionIds: result.finalQuestionIds,
          playerNumber: result.playerNumber,
          userRating: user.duelRating,
          rewardedDuelsLeft,
        });
      }

      return c.json({ status: "waiting" });
    } catch (err) {
      console.error("[DuelQueue] Error joining:", err);
      return c.json({ error: "Failed to join queue" }, 500);
    }
  }
);

// ─── GET /api/duel/queue/status/:userId ────────────────────────────────────────
queueRouter.get("/status/:userId", async (c) => {
  const userId = c.req.param("userId");

  try {
    const entry = await prisma.duelQueue.findUnique({ where: { userId } });
    if (!entry) return c.json({ status: "not_in_queue" });

    if (entry.status === "matched" && entry.matchId) {
      const match = await prisma.duelMatch.findUnique({
        where: { id: entry.matchId },
      });
      if (!match) return c.json({ status: "waiting" }); // stale, treat as waiting

      const opponentId =
        match.player1UserId === userId
          ? match.player2UserId
          : match.player1UserId;
      const playerNumber = match.player1UserId === userId ? 1 : 2;

      const [opponentUser, userRec] = await Promise.all([
        prisma.user.findUnique({
          where: { id: opponentId },
          select: { nickname: true, avatarId: true, titleId: true, countryCode: true },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            duelRating: true,
            duelRewardCount: true,
            duelRewardDate: true,
          },
        }),
      ]);

      const today = new Date().toISOString().slice(0, 10);
      const rewardCountToday =
        userRec?.duelRewardDate === today ? (userRec.duelRewardCount ?? 0) : 0;
      const rewardedDuelsLeft = Math.max(0, DAILY_REWARD_CAP - rewardCountToday);

      const questionIds = JSON.parse(match.questions) as string[];

      return c.json({
        status: "matched",
        matchId: entry.matchId,
        opponentName: opponentUser?.nickname ?? "Rival",
        opponentId,
        opponentAvatarId: opponentUser?.avatarId ?? "avatar_dove",
        opponentTitleId: opponentUser?.titleId ?? null,
        opponentCountryCode: opponentUser?.countryCode ?? null,
        questionIds,
        playerNumber,
        userRating: userRec?.duelRating ?? 1000,
        rewardedDuelsLeft,
      });
    }

    return c.json({ status: "waiting" });
  } catch (err) {
    console.error("[DuelQueue] Error checking status:", err);
    return c.json({ error: "Failed to check status" }, 500);
  }
});

// ─── POST /api/duel/queue/leave ────────────────────────────────────────────────
queueRouter.post(
  "/leave",
  zValidator("json", z.object({ userId: z.string() })),
  async (c) => {
    const { userId } = c.req.valid("json");
    try {
      await prisma.duelQueue.deleteMany({ where: { userId } });
    } catch {
      // Idempotent — ignore errors
    }
    return c.json({ ok: true });
  }
);

export { queueRouter };

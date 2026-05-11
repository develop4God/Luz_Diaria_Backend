// Duel Route — Duelo de Sabiduría backend endpoints
// POST /api/duel/start    — create a new duel match, returns user ranking
// POST /api/duel/complete — complete a match, award points, update ranking
// GET  /api/duel/stats/:userId   — basic stats
// GET  /api/duel/ranking/:userId — full ranking data
// GET  /api/duel/online-count    — approximate online player count

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { getCurrentWeekId } from "../weekly-challenges";

const duelRouter = new Hono();

const POINTS_WIN = 40;
const POINTS_LOSS = 10;
const DAILY_REWARD_CAP = 10; // max fully-rewarded duels per day

/** ELO-style rating changes */
const RATING_WIN = 25;
const RATING_LOSS = 15;
const RATING_MIN = 500;

// ─── POST /api/duel/start ──────────────────────────────────────────────────────
duelRouter.post(
  "/start",
  zValidator(
    "json",
    z.object({
      userId: z.string(),
      questionIds: z.array(z.string()).optional(),
      isBotMatch: z.boolean().optional().default(true),
    })
  ),
  async (c) => {
    const { userId, questionIds, isBotMatch } = c.req.valid("json");

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          duelRating: true,
          duelWins: true,
          duelLosses: true,
          duelWinStreak: true,
          duelBestStreak: true,
          duelRewardCount: true,
          duelRewardDate: true,
        },
      });
      if (!user) return c.json({ error: "User not found" }, 404);

      const match = await prisma.duelMatch.create({
        data: {
          player1UserId: userId,
          player2UserId: isBotMatch ? "bot:juanito" : userId,
          status: "in_progress",
          questions: JSON.stringify(questionIds ?? []),
          isBotMatch: isBotMatch ?? true,
        },
      });

      // Calculate how many rewarded duels are left today
      const today = new Date().toISOString().slice(0, 10);
      const rewardCountToday =
        user.duelRewardDate === today ? user.duelRewardCount : 0;
      const rewardedDuelsLeft = Math.max(0, DAILY_REWARD_CAP - rewardCountToday);

      return c.json({
        matchId: match.id,
        isBotMatch: match.isBotMatch,
        opponentName: match.isBotMatch ? "Juanito Bot" : null,
        userRating: user.duelRating,
        duelWins: user.duelWins,
        duelLosses: user.duelLosses,
        duelWinStreak: user.duelWinStreak,
        rewardedDuelsLeft,
      });
    } catch (err) {
      console.error("[Duel] Error starting match:", err);
      return c.json({ error: "Failed to start match" }, 500);
    }
  }
);

// ─── POST /api/duel/complete ───────────────────────────────────────────────────
duelRouter.post(
  "/complete",
  zValidator(
    "json",
    z.object({
      matchId: z.string(),
      userId: z.string(),
      outcome: z.enum(["win", "loss", "draw"]),
      player1Score: z.number().int().min(0).optional().default(0),
      player2Score: z.number().int().min(0).optional().default(0),
    })
  ),
  async (c) => {
    const { matchId, userId, outcome, player1Score, player2Score } = c.req.valid("json");

    try {
      const match = await prisma.duelMatch.findUnique({ where: { id: matchId } });
      if (!match) return c.json({ error: "Match not found" }, 404);

      if (match.status === "completed") {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { points: true, duelRating: true, duelWins: true, duelLosses: true, duelWinStreak: true },
        });
        return c.json({
          success: true,
          alreadyCompleted: true,
          pointsAwarded: match.pointsAwarded,
          newTotal: user?.points ?? 0,
          capReached: false,
          rewardedDuelsLeft: 0,
          duelRating: user?.duelRating ?? 1000,
          duelWins: user?.duelWins ?? 0,
          duelLosses: user?.duelLosses ?? 0,
          duelWinStreak: user?.duelWinStreak ?? 0,
          ratingChange: match.ratingChange,
        });
      }

      // Fetch current user stats for ranking update
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          points: true,
          duelRating: true,
          duelWins: true,
          duelLosses: true,
          duelWinStreak: true,
          duelBestStreak: true,
          duelRewardCount: true,
          duelRewardDate: true,
        },
      });
      if (!user) return c.json({ error: "User not found" }, 404);

      // ── Daily reward cap ──────────────────────────────────────────────────
      const today = new Date().toISOString().slice(0, 10);
      const rewardCountToday =
        user.duelRewardDate === today ? user.duelRewardCount : 0;
      const capReached = rewardCountToday >= DAILY_REWARD_CAP;

      // Points: full if under cap, 0 after cap
      const pointsAwarded = capReached ? 0 : (outcome === "win" ? POINTS_WIN : POINTS_LOSS);

      // ── Rating update ─────────────────────────────────────────────────────
      const ratingChange = outcome === "win" ? RATING_WIN : -RATING_LOSS;
      const newRating = Math.max(RATING_MIN, user.duelRating + ratingChange);

      // ── Win/loss streak ───────────────────────────────────────────────────
      const newWins = outcome === "win" ? user.duelWins + 1 : user.duelWins;
      const newLosses = outcome === "loss" ? user.duelLosses + 1 : user.duelLosses;
      const newStreak = outcome === "win" ? user.duelWinStreak + 1 : 0;
      const newBestStreak = Math.max(user.duelBestStreak, newStreak);
      const newRewardCount = capReached ? rewardCountToday : rewardCountToday + 1;

      const winnerUserId = outcome === "win" ? userId : (match.isBotMatch ? "bot:juanito" : null);

      // Update match
      await prisma.duelMatch.update({
        where: { id: matchId },
        data: {
          status: "completed",
          player1Score,
          player2Score,
          winnerUserId,
          pointsAwarded,
          ratingChange,
          completedAt: new Date(),
        },
      });

      // Update user ranking + points
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          points: { increment: pointsAwarded },
          pointsEarnedTotal: { increment: pointsAwarded },
          duelRating: newRating,
          duelWins: newWins,
          duelLosses: newLosses,
          duelWinStreak: newStreak,
          duelBestStreak: newBestStreak,
          duelRewardCount: newRewardCount,
          duelRewardDate: today,
        },
        select: { points: true },
      });

      // Ledger entry (idempotent)
      await prisma.pointLedger.upsert({
        where: {
          userId_ledgerId: {
            userId,
            ledgerId: `duel_${matchId}`,
          },
        },
        create: {
          userId,
          ledgerId: `duel_${matchId}`,
          type: outcome === "win" ? "duel_win" : "duel_loss",
          dateId: today,
          amount: pointsAwarded,
          metadata: JSON.stringify({ matchId, outcome, capReached, ratingChange }),
        },
        update: {},
      });

      const rewardedDuelsLeft = Math.max(0, DAILY_REWARD_CAP - newRewardCount);

      // ── Weekly mission progress ──────────────────────────────────────────────
      const completedMissions: { titleEs: string; rewardPoints: number }[] = [];
      try {
        const weekId = getCurrentWeekId();
        const isWin = outcome === "win";

        const duelChallenges = await prisma.weeklyChallenge.findMany({
          where: { weekId, type: { in: ["duel_play", "duel_win", "duel_win_streak"] } },
        });

        for (const challenge of duelChallenges) {
          let progress = await prisma.weeklyProgress.findUnique({
            where: { userId_challengeId: { userId, challengeId: challenge.id } },
          });
          if (!progress) {
            progress = await prisma.weeklyProgress.create({
              data: { userId, challengeId: challenge.id },
            });
          }
          if (progress.completed) continue;

          let newCount = progress.currentCount;

          if (challenge.type === "duel_play") {
            newCount += 1;
          } else if (challenge.type === "duel_win") {
            if (isWin) newCount += 1;
            else continue; // no change on loss
          } else if (challenge.type === "duel_win_streak") {
            if (isWin) {
              newCount += 1;
            } else {
              // Reset streak on loss
              await prisma.weeklyProgress.update({
                where: { id: progress.id },
                data: { currentCount: 0 },
              });
              continue;
            }
          }

          const isNowCompleted = newCount >= challenge.goalCount;
          await prisma.weeklyProgress.update({
            where: { id: progress.id },
            data: { currentCount: newCount, completed: isNowCompleted },
          });

          if (isNowCompleted) {
            completedMissions.push({
              titleEs: challenge.titleEs,
              rewardPoints: challenge.rewardPoints,
            });
          }
        }
      } catch (missionErr) {
        // Mission tracking is non-critical — log and continue
        console.error("[Duel] Failed to update weekly missions:", missionErr);
      }

      return c.json({
        success: true,
        pointsAwarded,
        newTotal: updatedUser.points,
        outcome,
        capReached,
        rewardedDuelsLeft,
        duelRating: newRating,
        duelWins: newWins,
        duelLosses: newLosses,
        duelWinStreak: newStreak,
        ratingChange,
        completedMissions,
      });
    } catch (err) {
      console.error("[Duel] Error completing match:", err);
      return c.json({ error: "Failed to complete match" }, 500);
    }
  }
);

// ─── GET /api/duel/stats/:userId ───────────────────────────────────────────────
duelRouter.get("/stats/:userId", async (c) => {
  const userId = c.req.param("userId");

  try {
    const [total, wins, user] = await Promise.all([
      prisma.duelMatch.count({
        where: { player1UserId: userId, status: "completed" },
      }),
      prisma.duelMatch.count({
        where: { player1UserId: userId, status: "completed", winnerUserId: userId },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          duelRating: true,
          duelWins: true,
          duelLosses: true,
          duelWinStreak: true,
          duelBestStreak: true,
        },
      }),
    ]);

    return c.json({
      totalMatches: total,
      wins,
      losses: total - wins,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      duelRating: user?.duelRating ?? 1000,
      duelWinStreak: user?.duelWinStreak ?? 0,
      duelBestStreak: user?.duelBestStreak ?? 0,
    });
  } catch (err) {
    console.error("[Duel] Error fetching stats:", err);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});

// ─── GET /api/duel/ranking/:userId ─────────────────────────────────────────────
duelRouter.get("/ranking/:userId", async (c) => {
  const userId = c.req.param("userId");

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        duelRating: true,
        duelWins: true,
        duelLosses: true,
        duelWinStreak: true,
        duelBestStreak: true,
        duelRewardCount: true,
        duelRewardDate: true,
        nickname: true,
      },
    });
    if (!user) return c.json({ error: "User not found" }, 404);

    const today = new Date().toISOString().slice(0, 10);
    const rewardCountToday = user.duelRewardDate === today ? user.duelRewardCount : 0;
    const rewardedDuelsLeft = Math.max(0, DAILY_REWARD_CAP - rewardCountToday);

    // Rank by duelRating (higher = better rank)
    const rank = await prisma.user.count({
      where: { duelRating: { gt: user.duelRating } },
    });

    return c.json({
      duelRating: user.duelRating,
      duelWins: user.duelWins,
      duelLosses: user.duelLosses,
      duelWinStreak: user.duelWinStreak,
      duelBestStreak: user.duelBestStreak,
      rewardedDuelsLeft,
      globalRank: rank + 1, // 1-indexed
    });
  } catch (err) {
    console.error("[Duel] Error fetching ranking:", err);
    return c.json({ error: "Failed to fetch ranking" }, 500);
  }
});

// ─── POST /api/duel/round-answer ───────────────────────────────────────────────
// Called by each player when they pick an answer (or time out).
// Idempotent: upserts the answer so re-submits are safe.
duelRouter.post(
  "/round-answer",
  zValidator(
    "json",
    z.object({
      matchId: z.string(),
      userId: z.string(),
      questionIndex: z.number().int().min(0),
      answerIndex: z.number().int().min(-1).max(3), // -1 = timeout
      isCorrect: z.boolean(),
    })
  ),
  async (c) => {
    const { matchId, userId, questionIndex, answerIndex, isCorrect } = c.req.valid("json");

    try {
      const match = await prisma.duelMatch.findUnique({ where: { id: matchId } });
      if (!match) return c.json({ error: "Match not found" }, 404);

      // Upsert the answer (idempotent)
      await prisma.duelRoundAnswer.upsert({
        where: { matchId_userId_questionIndex: { matchId, userId, questionIndex } },
        create: { matchId, userId, questionIndex, answerIndex, isCorrect },
        update: { answerIndex, isCorrect, answeredAt: new Date() },
      });

      // Update heartbeat / last-seen for disconnect detection
      const isPlayer1 = match.player1UserId === userId;
      await prisma.duelMatch.update({
        where: { id: matchId },
        data: isPlayer1
          ? { player1LastSeen: new Date() }
          : { player2LastSeen: new Date() },
      });

      return c.json({ ok: true });
    } catch (err) {
      console.error("[Duel] Error submitting round answer:", err);
      return c.json({ error: "Failed to submit answer" }, 500);
    }
  }
);

// ─── GET /api/duel/round-result/:matchId/:questionIndex ────────────────────────
// Long-poll endpoint: returns 'pending' until both answers are in (or auto-resolves
// after 38 s when one player has answered and the other hasn't).
duelRouter.get("/round-result/:matchId/:questionIndex", async (c) => {
  const matchId = c.req.param("matchId");
  const questionIndex = parseInt(c.req.param("questionIndex"), 10);

  try {
    const match = await prisma.duelMatch.findUnique({ where: { id: matchId } });
    if (!match) return c.json({ error: "Match not found" }, 404);

    const answers = await prisma.duelRoundAnswer.findMany({
      where: { matchId, questionIndex },
    });

    const p1Answer = answers.find((a) => a.userId === match.player1UserId);
    const p2Answer = answers.find((a) => a.userId === match.player2UserId);

    // Helper to build resolved result
    const resolve = (
      p1: { answerIndex: number; isCorrect: boolean } | null,
      p2: { answerIndex: number; isCorrect: boolean } | null
    ) => {
      const p1Correct = p1?.isCorrect ?? false;
      const p2Correct = p2?.isCorrect ?? false;
      let roundWinner: "player1" | "player2" | "draw";
      if (p1Correct && !p2Correct) roundWinner = "player1";
      else if (!p1Correct && p2Correct) roundWinner = "player2";
      else roundWinner = "draw";

      return c.json({
        status: "resolved",
        player1Answer: p1?.answerIndex ?? -1,
        player2Answer: p2?.answerIndex ?? -1,
        player1Correct: p1Correct,
        player2Correct: p2Correct,
        roundWinner,
      });
    };

    if (p1Answer && p2Answer) {
      // Both answered — resolve immediately
      return resolve(p1Answer, p2Answer);
    }

    // Only one answered — check timeout (38 s)
    const firstAnswer = p1Answer ?? p2Answer;
    if (firstAnswer) {
      const elapsed = Date.now() - firstAnswer.answeredAt.getTime();
      if (elapsed > 38_000) {
        // Auto-fill the missing answer as a timeout (-1, incorrect)
        const missingUserId = p1Answer ? match.player2UserId : match.player1UserId;
        await prisma.duelRoundAnswer.upsert({
          where: { matchId_userId_questionIndex: { matchId, userId: missingUserId, questionIndex } },
          create: { matchId, userId: missingUserId, questionIndex, answerIndex: -1, isCorrect: false },
          update: { answerIndex: -1, isCorrect: false },
        });
        return resolve(
          p1Answer ?? { answerIndex: -1, isCorrect: false },
          p2Answer ?? { answerIndex: -1, isCorrect: false }
        );
      }
    }

    return c.json({ status: "pending" });
  } catch (err) {
    console.error("[Duel] Error fetching round result:", err);
    return c.json({ error: "Failed to fetch round result" }, 500);
  }
});

// ─── POST /api/duel/heartbeat ──────────────────────────────────────────────────
// Called every ~5 s by each player while the match is active.
// Updates last-seen, and flags when opponent has gone silent > 20 s.
duelRouter.post(
  "/heartbeat",
  zValidator(
    "json",
    z.object({
      matchId: z.string(),
      userId: z.string(),
    })
  ),
  async (c) => {
    const { matchId, userId } = c.req.valid("json");

    try {
      const match = await prisma.duelMatch.findUnique({ where: { id: matchId } });
      if (!match) return c.json({ error: "Match not found" }, 404);

      if (match.status !== "in_progress") {
        return c.json({ opponentConnected: false, matchStatus: match.status });
      }

      const isPlayer1 = match.player1UserId === userId;

      // Update caller's last-seen
      const updatedMatch = await prisma.duelMatch.update({
        where: { id: matchId },
        data: isPlayer1
          ? { player1LastSeen: new Date() }
          : { player2LastSeen: new Date() },
      });

      // Check opponent's last-seen.
      // null means the match just started and the opponent hasn't sent their
      // first heartbeat yet — treat as connected during that window.
      const opponentLastSeen = isPlayer1
        ? updatedMatch.player2LastSeen
        : updatedMatch.player1LastSeen;

      const DISCONNECT_TIMEOUT_MS = 20_000;
      const opponentConnected =
        opponentLastSeen === null || // not yet seen → assume connected
        Date.now() - opponentLastSeen.getTime() < DISCONNECT_TIMEOUT_MS;

      return c.json({
        opponentConnected,
        matchStatus: updatedMatch.status,
      });
    } catch (err) {
      console.error("[Duel] Error in heartbeat:", err);
      return c.json({ error: "Heartbeat failed" }, 500);
    }
  }
);

// ─── GET /api/duel/leaderboard ─────────────────────────────────────────────────
// Returns the top duelists sorted by rating descending (global only).
// Query params: limit (default 100, max 200)
duelRouter.get("/leaderboard", async (c) => {
  const limitParam = parseInt(c.req.query("limit") ?? "100", 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 100 : limitParam), 200);
  const country = c.req.query("country") ?? null; // ISO 3166-1 alpha-2, e.g. "MX"

  try {
    const players = await prisma.user.findMany({
      where: {
        duelWins: { gt: 0 },
        ...(country ? { countryCode: country } : {}),
      },
      orderBy: [
        { duelRating: "desc" },
        { duelWins: "desc" },
      ],
      take: limit,
      select: {
        id: true,
        nickname: true,
        avatarId: true,
        titleId: true,
        duelRating: true,
        duelWins: true,
        duelLosses: true,
        duelWinStreak: true,
      },
    });

    const leaderboard = players.map((p, index) => ({
      rank: index + 1,
      userId: p.id,
      nickname: p.nickname,
      avatarId: p.avatarId,
      titleId: p.titleId ?? null,
      duelRating: p.duelRating,
      duelWins: p.duelWins,
      duelLosses: p.duelLosses,
      duelWinStreak: p.duelWinStreak,
    }));

    return c.json({ leaderboard, total: leaderboard.length });
  } catch (err) {
    console.error("[Duel] Error fetching leaderboard:", err);
    return c.json({ error: "Failed to fetch leaderboard" }, 500);
  }
});

// ─── GET /api/duel/online-count ────────────────────────────────────────────────
// Returns the number of users active in the last 5 minutes.
// Uses lastSeenAt (updated by session heartbeat) — not lastActiveAt which is
// only updated on discrete actions (devotionals, etc.).
duelRouter.get("/online-count", async (c) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const count = await prisma.user.count({
      where: {
        lastSeenAt: { gte: fiveMinutesAgo },
      },
    });

    return c.json({ count });
  } catch (err) {
    console.error("[Duel] Error fetching online count:", err);
    return c.json({ count: 0 });
  }
});

export { duelRouter };

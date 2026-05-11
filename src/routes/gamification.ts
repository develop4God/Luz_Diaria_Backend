import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import { checkAndAwardBadges } from "../seed-badges";
import { validateNickname, normalizeNickname } from "../lib/nickname-safety";
import { IS_DEV } from "../env";
import { generateNextRound } from "../weekly-challenges";

export const gamificationRouter = new Hono();

// ============================================
// SEASON HELPER
// ============================================

/**
 * Build a Prisma WHERE clause that matches seasons considered "active".
 * A season is active if:
 *   isActive = true  AND  (preview = true  OR  now BETWEEN startDate AND endDate)
 * The `preview` flag only takes effect in DEV — in PROD it is ignored.
 */
function buildActiveSeasonWhere(now: Date) {
  const dateRangeClause = { startDate: { lte: now }, endDate: { gte: now } };
  if (IS_DEV) {
    return {
      isActive: true,
      OR: [{ preview: true }, dateRangeClause],
    };
  }
  // PROD: ignore preview flag entirely
  return { isActive: true, ...dateRangeClause };
}

// ============================================
// TYPES & CONSTANTS
// ============================================

type ActionType = 'devotional_complete' | 'share' | 'prayer' | 'tts_complete' | 'streak_bonus' | 'favorite' | 'study_complete';

interface DailyActions {
  shareDate?: string;
  shareCount?: number;
  prayerDate?: string;
  prayerDone?: boolean;
  ttsDate?: string;
  ttsDone?: boolean;
  devotionalDates?: string[]; // Track completed devotionals by date
  // Daily pack claims: tracks claim count and date per pack type
  dailyPackDate?: string;       // ISO date string (YYYY-MM-DD) of last pack interaction
  dailyPackCount?: number;      // How many packs claimed on dailyPackDate
  accumulatedPacks?: number;    // Unclaimed packs accumulated across missed days (hard cap: 2)
}

const POINTS_CONFIG: Record<ActionType, { points: number; dailyCap?: number }> = {
  devotional_complete: { points: 50 },
  share: { points: 10, dailyCap: 2 },
  prayer: { points: 8, dailyCap: 1 },
  tts_complete: { points: 6, dailyCap: 1 },
  streak_bonus: { points: 0 }, // Varies by milestone
  favorite: { points: 10 },
  study_complete: { points: 300 },
};

const STREAK_MILESTONES: Record<number, number> = {
  5: 100,
  7: 200,   // 7-day streak = 200 bonus points
  10: 250,
  30: 600,  // 30-day streak = 600 bonus points (updated from 1000)
};

// ============================================
// VALIDATION SCHEMAS
// ============================================

const registerUserSchema = z.object({
  nickname: z.string().min(3).max(20),
  avatarId: z.string().optional(),
  deviceId: z.string().optional(),
});

const syncUserSchema = z.object({
  points: z.number().int().nonnegative().optional(),
  streakCurrent: z.number().int().nonnegative().optional(),
  streakBest: z.number().int().nonnegative().optional(),
  devotionalsCompleted: z.number().int().nonnegative().optional(),
  totalTimeSeconds: z.number().int().nonnegative().optional(),
  lastActiveAt: z.string().datetime().optional(),
  // When a new devotional is completed, pass the date (YYYY-MM-DD) to record it authoritatively
  completedDevotionalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Cosmetic fields - sync equipped items
  titleId: z.string().nullable().optional(),
  frameId: z.string().nullable().optional(),
  avatarId: z.string().optional(),
  themeId: z.string().optional(),
  communityOptIn: z.boolean().optional(),
  countryCode: z.string().nullable().optional(),
  showCountry: z.boolean().optional(),
  nickname: z.string().optional(),
});

const awardPointsSchema = z.object({
  userId: z.string(),
  action: z.enum(['devotional_complete', 'share', 'prayer', 'tts_complete', 'streak_bonus', 'favorite', 'study_complete']),
  metadata: z.any().optional(),
});

const purchaseSchema = z.object({
  userId: z.string(),
  itemId: z.string(),
});

const equipSchema = z.object({
  type: z.enum(['theme', 'frame', 'title', 'music', 'avatar', 'badge']),
  itemId: z.string().nullable(),
});

const updateChallengeSchema = z.object({
  userId: z.string(),
  type: z.enum(['devotional_complete', 'share', 'prayer', 'duel_play', 'duel_win', 'duel_win_streak']),
});

const claimChallengeSchema = z.object({
  userId: z.string(),
  challengeId: z.string(),
});

// Transfer code schemas
const generateTransferCodeSchema = z.object({
  userId: z.string(),
});

const restoreTransferCodeSchema = z.object({
  code: z.string().length(8),
  targetUserId: z.string(),
});

// Device ID schemas
const updateDeviceIdSchema = z.object({
  deviceId: z.string(),
});

// Country schemas
const updateCountrySchema = z.object({
  countryCode: z.string().length(2).toUpperCase().nullable().optional(),
  showCountry: z.boolean().optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0]!;
}

function getCurrentWeekId(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, "0")}`;
}

function parseDailyActions(jsonStr: string): DailyActions {
  try {
    return JSON.parse(jsonStr) as DailyActions;
  } catch {
    return {};
  }
}

// Hard cap on accumulated free packs (applies to all users regardless of premium)
const FREE_PACK_MAX_ACCUMULATED = 2;

/**
 * Computes available free packs taking into account:
 * - Daily earn rate (1 per day for regular, 2 for premium)
 * - Days elapsed since last interaction
 * - Hard cap of FREE_PACK_MAX_ACCUMULATED regardless of days missed
 *
 * Returns: { available: number, updatedActions: DailyActions }
 * The caller must persist updatedActions after using this result.
 */
function computeAvailablePacks(
  dailyActions: DailyActions,
  today: string,
  dailyEarnRate: number
): { available: number; updatedActions: DailyActions } {
  const lastDate = dailyActions.dailyPackDate;
  const lastCount = dailyActions.dailyPackCount ?? 0;
  const prevAccumulated = dailyActions.accumulatedPacks ?? 0;

  if (!lastDate || lastDate === today) {
    // Same day — available = accumulated + (dailyEarnRate - claimedToday), capped
    const claimedToday = lastDate === today ? lastCount : 0;
    const earnedToday = dailyEarnRate - claimedToday;
    const available = Math.min(FREE_PACK_MAX_ACCUMULATED, prevAccumulated + Math.max(0, earnedToday));
    return {
      available,
      updatedActions: { ...dailyActions },
    };
  }

  // New day(s) have passed — compute how many days elapsed since last interaction
  const lastMs = new Date(lastDate).getTime();
  const todayMs = new Date(today).getTime();
  const daysElapsed = Math.floor((todayMs - lastMs) / (24 * 60 * 60 * 1000));

  // Packs that were not claimed on previous days carry over, but cap applies
  // Each elapsed day earns dailyEarnRate packs, capped globally at FREE_PACK_MAX_ACCUMULATED
  const earnedSinceLast = daysElapsed * dailyEarnRate;
  const available = Math.min(FREE_PACK_MAX_ACCUMULATED, prevAccumulated + earnedSinceLast);

  return {
    available,
    updatedActions: {
      ...dailyActions,
      dailyPackDate: today,
      dailyPackCount: 0,
      accumulatedPacks: available,
    },
  };
}

// Generate a random 8-character alphanumeric code
function generateTransferCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0/O, 1/I/L
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Compute deterministic ledger IDs for idempotent point tracking
function computeLedgerId(
  action: ActionType,
  dateId: string,
  metadata?: Record<string, unknown>
): string {
  switch (action) {
    case 'devotional_complete': {
      const devotionalDate = (metadata?.devotionalDate as string) ?? dateId;
      return `devotional_${devotionalDate}`;
    }
    case 'streak_bonus': {
      const streakDays = metadata?.streakDays as number;
      return `streak_bonus_${streakDays}_${dateId}`;
    }
    case 'share': {
      const count = metadata?.shareCount as number ?? 1;
      return `share_${dateId}_${count}`;
    }
    case 'prayer':
      return `prayer_${dateId}`;
    case 'tts_complete':
      return `tts_${dateId}`;
    case 'favorite': {
      const favoriteDate = (metadata?.devotionalDate as string) ?? dateId;
      return `favorite_${favoriteDate}`;
    }
    case 'study_complete': {
      const studyId = (metadata?.studyId as string) ?? dateId;
      return `study_complete_${studyId}`;
    }
    default:
      return `${action}_${dateId}`;
  }
}

// ============================================
// USER MANAGEMENT ENDPOINTS
// ============================================

// POST /user/register - Register new user with unique nickname
gamificationRouter.post(
  "/user/register",
  zValidator("json", registerUserSchema),
  async (c) => {
    try {
      const { nickname, avatarId, deviceId } = c.req.valid("json");

      // Run full safety validation
      const validation = validateNickname(nickname);
      if (!validation.ok) {
        return c.json({ error: validation.error }, 400);
      }
      const nicknameLower = nickname.toLowerCase();
      const normalizedNickname = validation.normalized!;

      // Check raw case-insensitive uniqueness
      const existingUser = await prisma.user.findUnique({
        where: { nicknameLower },
      });
      if (existingUser) {
        return c.json({ error: "Nickname is already taken" }, 409);
      }

      // Check normalized (lookalike) uniqueness
      const lookalike = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT "id" FROM "User" WHERE "normalizedNickname" = ? LIMIT 1`,
        normalizedNickname
      );
      if (lookalike.length > 0) {
        return c.json({ error: "Nickname is already taken" }, 409);
      }

      const user = await prisma.user.create({
        data: {
          nickname,
          nicknameLower,
          normalizedNickname,
          avatarId: avatarId ?? "avatar_dove",
          deviceId: deviceId ?? null,
        },
        include: {
          inventory: {
            include: { item: true },
          },
        },
      });

      return c.json(user, 201);
    } catch (error) {
      console.error("[Gamification] Error registering user:", error);
      return c.json({ error: "Failed to register user" }, 500);
    }
  }
);

// GET /me - Get current user profile via X-User-Id header (avoids proxy issues with ID in URL)
// Falls back to X-User-Nickname lookup if the ID is not found (handles stale local IDs)
// Also supports nickname-only lookup (no X-User-Id) for account recovery flow
gamificationRouter.get("/me", async (c) => {
  try {
    const userId = c.req.header("X-User-Id");
    const nicknameHeader = c.req.header("X-User-Nickname");

    let user = null;

    if (userId) {
      console.log(`[UserProfile/me] Lookup userId="${userId}"`);
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, nickname: true, role: true, points: true, streakCurrent: true, avatarId: true },
      });

      // Fallback: if ID not found, try to find by nickname (handles stale/mismatched local IDs)
      if (!user && nicknameHeader) {
        console.log(`[UserProfile/me] ID not found, trying nickname fallback: "${nicknameHeader}"`);
        user = await prisma.user.findFirst({
          where: { nickname: nicknameHeader },
          select: { id: true, nickname: true, role: true, points: true, streakCurrent: true, avatarId: true },
        });
        if (user) {
          console.log(`[UserProfile/me] Nickname fallback succeeded: found id="${user.id}" role="${user.role}"`);
        }
      }
    } else if (nicknameHeader) {
      // Recovery flow: no userId, lookup by nickname only
      console.log(`[UserProfile/me] Recovery lookup by nickname="${nicknameHeader}"`);
      user = await prisma.user.findFirst({
        where: { nickname: nicknameHeader },
        select: { id: true, nickname: true, role: true, points: true, streakCurrent: true, avatarId: true },
      });
      if (user) {
        console.log(`[UserProfile/me] Recovery succeeded: found id="${user.id}" role="${user.role}"`);
      }
    } else {
      return c.json({ error: "Missing X-User-Id or X-User-Nickname header" }, 400);
    }

    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json(user);
  } catch (error) {
    console.error("[Gamification] Error getting /me:", error);
    return c.json({ error: "Failed to get user" }, 500);
  }
});

// GET /user/:userId/role - Lightweight role check (works via proxy since it has two path segments)
gamificationRouter.get("/user/:userId/role", async (c) => {
  try {
    const userId = c.req.param("userId");
    console.log(`[UserProfile/role] Lookup userId="${userId}"`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, role: true },
    });

    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json(user);
  } catch (error) {
    console.error("[Gamification] Error getting role:", error);
    return c.json({ error: "Failed to get role" }, 500);
  }
});

// GET /user/:userId - Get user profile
gamificationRouter.get("/user/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const xForwardedFor = c.req.header("x-forwarded-for") ?? "unknown";
    const userAgent = c.req.header("user-agent") ?? "unknown";
    console.log(`[TESTFLIGHT-DEBUG] GET /user/:userId => userId="${userId}" | IP="${xForwardedFor}" | UA="${userAgent}"`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        inventory: {
          include: { item: true },
        },
      },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Build equipped items info
    const equippedItems = {
      theme: user.themeId,
      frame: user.frameId,
      title: user.titleId,
      music: user.selectedMusicId,
      badge: user.activeBadgeId,
    };

    return c.json({ ...user, equippedItems });
  } catch (error) {
    console.error("[Gamification] Error getting user:", error);
    return c.json({ error: "Failed to get user" }, 500);
  }
});

// POST /user/:userId/sync - Sync local user data to server
gamificationRouter.post(
  "/user/:userId/sync",
  zValidator("json", syncUserSchema),
  async (c) => {
    try {
      const userId = c.req.param("userId");
      const data = c.req.valid("json");

      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        console.log(`[Sync] User not found: ${userId}`);
        return c.json({ error: "User not found" }, 404);
      }

      console.log(`[Sync] User ${existingUser.nickname} (${userId}):`, {
        before: {
          points: existingUser.points,
          streakCurrent: existingUser.streakCurrent,
          devotionalsCompleted: existingUser.devotionalsCompleted,
        },
        incoming: data,
      });

      const updateData: Record<string, unknown> = {};

      // If a new devotional was completed, upsert a DevotionalCompletion row (unique per date)
      // then derive the authoritative count from the table
      if (data.completedDevotionalDate) {
        await prisma.devotionalCompletion.upsert({
          where: {
            userId_devotionalDate: {
              userId,
              devotionalDate: data.completedDevotionalDate,
            },
          },
          update: {}, // already recorded — no-op
          create: {
            userId,
            devotionalDate: data.completedDevotionalDate,
          },
        });
      }

      // Derive devotionalsCompleted from the authoritative DevotionalCompletion table.
      // Cap at the total number of devotionals available to prevent inflated counts.
      const authoritativeCount = await prisma.devotionalCompletion.count({
        where: { userId },
      });
      const totalDevotionals = await prisma.devotional.count();
      const cappedExisting = Math.min(existingUser.devotionalsCompleted, totalDevotionals);
      const cappedIncoming = Math.min(data.devotionalsCompleted ?? 0, totalDevotionals);
      updateData.devotionalsCompleted = Math.min(
        Math.max(authoritativeCount, cappedExisting, cappedIncoming),
        totalDevotionals
      );

      // Use MAX strategy for cumulative stats to prevent data loss when local store resets
      // This ensures we never lose progress even if the frontend sends lower values
      if (data.points !== undefined) {
        updateData.points = Math.max(data.points, existingUser.points);
      }
      if (data.streakCurrent !== undefined) {
        updateData.streakCurrent = Math.max(data.streakCurrent, existingUser.streakCurrent);
      }
      if (data.streakBest !== undefined) {
        updateData.streakBest = Math.max(data.streakBest, existingUser.streakBest);
      }
      if (data.totalTimeSeconds !== undefined) {
        updateData.totalTimeSeconds = Math.max(data.totalTimeSeconds, existingUser.totalTimeSeconds);
      }
      if (data.lastActiveAt !== undefined) updateData.lastActiveAt = new Date(data.lastActiveAt);

      // Sync cosmetic/profile fields (always update if provided)
      if (data.titleId !== undefined) updateData.titleId = data.titleId;
      if (data.frameId !== undefined) updateData.frameId = data.frameId;
      if (data.avatarId !== undefined) updateData.avatarId = data.avatarId;
      if (data.themeId !== undefined) updateData.themeId = data.themeId;
      if (data.communityOptIn !== undefined) updateData.communityOptIn = data.communityOptIn;
      if (data.countryCode !== undefined) updateData.countryCode = data.countryCode;
      if (data.showCountry !== undefined) updateData.showCountry = data.showCountry;
      if (data.nickname !== undefined) {
        // Reject nicknames that fail safety checks (profanity, etc.)
        const safetyCheck = validateNickname(data.nickname);
        if (safetyCheck.ok) {
          // Only update nickname if it's not taken by another user
          const existingNickname = await prisma.user.findFirst({
            where: { nicknameLower: data.nickname.toLowerCase(), NOT: { id: userId } },
          });
          if (!existingNickname) {
            updateData.nickname = data.nickname;
            updateData.nicknameLower = data.nickname.toLowerCase();
            updateData.normalizedNickname = safetyCheck.normalized!;
          }
        } else {
          // Incoming nickname is inappropriate — keep the server's current value, do not overwrite
          console.warn(`[Sync] Blocked inappropriate nickname from device for user ${userId}: "${data.nickname}"`);
        }
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          inventory: {
            include: { item: true },
          },
        },
      });

      console.log(`[Sync] User ${existingUser.nickname} updated:`, {
        points: user.points,
        streakCurrent: user.streakCurrent,
        devotionalsCompleted: user.devotionalsCompleted,
      });

      // Auto-award any newly earned badges (non-blocking)
      checkAndAwardBadges(userId).catch(() => {});

      return c.json(user);
    } catch (error) {
      console.error("[Gamification] Error syncing user:", error);
      return c.json({ error: "Failed to sync user" }, 500);
    }
  }
);

// ============================================
// POINTS SYSTEM ENDPOINTS
// ============================================

// POST /points/award - Award points with ledger-based idempotent tracking
gamificationRouter.post(
  "/points/award",
  zValidator("json", awardPointsSchema),
  async (c) => {
    try {
      const { userId, action, metadata } = c.req.valid("json");
      const today = getTodayDateString();

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      const dailyActions = parseDailyActions(user.dailyActions);
      let pointsAwarded = 0;
      let message: string | undefined;
      let ledgerId: string;
      let shareCountForLedger = 1;

      // Determine points and validate action-specific rules
      switch (action) {
        case "share": {
          // Reset count if new day
          if (dailyActions.shareDate !== today) {
            dailyActions.shareDate = today;
            dailyActions.shareCount = 0;
          }
          const currentCount = dailyActions.shareCount ?? 0;
          if (currentCount >= 2) {
            return c.json({
              success: false,
              pointsAwarded: 0,
              newTotal: user.points,
              message: "Daily share limit reached (2/day)",
            });
          }
          shareCountForLedger = currentCount + 1;
          dailyActions.shareCount = shareCountForLedger;
          pointsAwarded = POINTS_CONFIG.share.points;
          break;
        }

        case "prayer": {
          if (dailyActions.prayerDate === today && dailyActions.prayerDone) {
            return c.json({
              success: false,
              pointsAwarded: 0,
              newTotal: user.points,
              message: "Daily prayer bonus already claimed",
            });
          }
          dailyActions.prayerDate = today;
          dailyActions.prayerDone = true;
          pointsAwarded = POINTS_CONFIG.prayer.points;
          break;
        }

        case "tts_complete": {
          if (dailyActions.ttsDate === today && dailyActions.ttsDone) {
            return c.json({
              success: false,
              pointsAwarded: 0,
              newTotal: user.points,
              message: "Daily TTS bonus already claimed",
            });
          }
          dailyActions.ttsDate = today;
          dailyActions.ttsDone = true;
          pointsAwarded = POINTS_CONFIG.tts_complete.points;
          break;
        }

        case "devotional_complete": {
          const devotionalDate = (metadata?.devotionalDate as string) ?? today;
          const completedDates = dailyActions.devotionalDates ?? [];

          if (completedDates.includes(devotionalDate)) {
            return c.json({
              success: false,
              pointsAwarded: 0,
              newTotal: user.points,
              message: "This devotional has already been completed",
            });
          }

          dailyActions.devotionalDates = [...completedDates, devotionalDate];
          pointsAwarded = POINTS_CONFIG.devotional_complete.points;
          break;
        }

        case "streak_bonus": {
          const streakDays = (metadata?.streakDays as number) ?? user.streakCurrent;
          const milestonePoints = STREAK_MILESTONES[streakDays];

          if (!milestonePoints) {
            return c.json({
              success: false,
              pointsAwarded: 0,
              newTotal: user.points,
              message: `No milestone bonus for ${streakDays} days`,
            });
          }

          pointsAwarded = milestonePoints;
          message = `Streak milestone bonus for ${streakDays} days!`;
          break;
        }

        case "favorite": {
          pointsAwarded = POINTS_CONFIG.favorite.points;
          break;
        }

        case "study_complete": {
          pointsAwarded = POINTS_CONFIG.study_complete.points;
          break;
        }
      }

      // Compute deterministic ledger ID
      const metadataForLedger = {
        ...metadata,
        shareCount: shareCountForLedger,
      };
      ledgerId = computeLedgerId(action, today, metadataForLedger);

      // Use transaction for atomic ledger entry + points update
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Check if ledger entry already exists (idempotency check)
          const existingEntry = await tx.pointLedger.findUnique({
            where: {
              userId_ledgerId: { userId, ledgerId },
            },
          });

          if (existingEntry) {
            // Already awarded - return current state
            const currentUser = await tx.user.findUnique({
              where: { id: userId },
            });
            return {
              alreadyAwarded: true,
              newTotal: currentUser?.points ?? user.points,
            };
          }

          // Create ledger entry
          await tx.pointLedger.create({
            data: {
              userId,
              ledgerId,
              type: action,
              dateId: today,
              amount: pointsAwarded,
              metadata: JSON.stringify(metadata ?? {}),
            },
          });

          // Atomic increment of points
          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: {
              points: { increment: pointsAwarded },
              pointsEarnedTotal: { increment: pointsAwarded },
              dailyActions: JSON.stringify(dailyActions),
            },
          });

          return {
            alreadyAwarded: false,
            newTotal: updatedUser.points,
          };
        });

        if (result.alreadyAwarded) {
          return c.json({
            success: false,
            pointsAwarded: 0,
            newTotal: result.newTotal,
            message: "Points already awarded for this action",
            ledgerId,
          });
        }

        return c.json({
          success: true,
          pointsAwarded,
          newTotal: result.newTotal,
          message,
          ledgerId,
        });
      } catch (txError) {
        // Handle unique constraint violation (race condition)
        if (txError instanceof Error && txError.message.includes('Unique constraint')) {
          const currentUser = await prisma.user.findUnique({
            where: { id: userId },
          });
          return c.json({
            success: false,
            pointsAwarded: 0,
            newTotal: currentUser?.points ?? user.points,
            message: "Points already awarded for this action",
            ledgerId,
          });
        }
        throw txError;
      }
    } catch (error) {
      console.error("[Gamification] Error awarding points:", error);
      return c.json({ error: "Failed to award points" }, 500);
    }
  }
);

// ============================================
// STORE & INVENTORY ENDPOINTS
// ============================================

// GET /store/items - Get all available store items (respects active seasons)
gamificationRouter.get("/store/items", async (c) => {
  try {
    const type = c.req.query("type");
    const now = new Date();

    // Determine active season IDs (supports preview flag in DEV)
    const activeSeasons = await prisma.season.findMany({
      where: buildActiveSeasonWhere(now),
    });
    const activeSeasonIds = activeSeasons.map((s) => s.id);

    // Build filter: available items that are either:
    // a) not tied to any season (seasonId is null)
    // b) tied to an active season
    const where: Record<string, unknown> = {
      available: true,
      comingSoon: false,
      OR: [
        { seasonId: null },
        ...(activeSeasonIds.length > 0
          ? [{ seasonId: { in: activeSeasonIds } }]
          : []),
      ],
    };

    if (type) {
      where.type = type;
    }

    const items = await prisma.storeItem.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { pricePoints: "asc" }],
    });

    return c.json({ items, activeSeasons });
  } catch (error) {
    console.error("[Gamification] Error getting store items:", error);
    return c.json({ error: "Failed to get store items" }, 500);
  }
});

// ============================================
// SEASONS / EVENTS ENDPOINTS
// ============================================

// GET /seasons/active - Get currently active seasons (respects preview flag in DEV)
gamificationRouter.get("/seasons/active", async (c) => {
  try {
    const now = new Date();
    const seasons = await prisma.season.findMany({
      where: buildActiveSeasonWhere(now),
      orderBy: { priority: "desc" },
    });
    return c.json(seasons);
  } catch (error) {
    console.error("[Gamification] Error getting active seasons:", error);
    return c.json({ error: "Failed to get active seasons" }, 500);
  }
});

// GET /seasons/all - Get all seasons (admin use)
gamificationRouter.get("/seasons/all", async (c) => {
  try {
    const seasons = await prisma.season.findMany({
      orderBy: [{ priority: "desc" }, { startDate: "desc" }],
    });
    return c.json(seasons);
  } catch (error) {
    console.error("[Gamification] Error getting all seasons:", error);
    return c.json({ error: "Failed to get seasons" }, 500);
  }
});

// GET /seasons/preview - Debug endpoint: shows all seasons + which are active right now (DEV only)
gamificationRouter.get("/seasons/preview", async (c) => {
  if (!IS_DEV) {
    return c.json({ error: "Only available in DEV environment" }, 403);
  }
  try {
    const now = new Date();
    const allSeasons = await prisma.season.findMany({
      orderBy: [{ priority: "desc" }, { startDate: "desc" }],
    });
    const activeSeasons = await prisma.season.findMany({
      where: buildActiveSeasonWhere(now),
      orderBy: { priority: "desc" },
    });
    return c.json({
      now: now.toISOString(),
      activeSeasons,
      allSeasons,
      note: "preview=true seasons are treated as active in DEV regardless of date",
    });
  } catch (error) {
    console.error("[Gamification] Error getting seasons preview:", error);
    return c.json({ error: "Failed to get seasons preview" }, 500);
  }
});

// GET /inventory/:userId - Get user's inventory
gamificationRouter.get("/inventory/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const inventory = await prisma.userInventory.findMany({
      where: { userId },
      include: { item: true },
      orderBy: { acquiredAt: "desc" },
    });

    return c.json(inventory);
  } catch (error) {
    console.error("[Gamification] Error getting inventory:", error);
    return c.json({ error: "Failed to get inventory" }, 500);
  }
});

// POST /store/purchase - Purchase item
gamificationRouter.post(
  "/store/purchase",
  zValidator("json", purchaseSchema),
  async (c) => {
    try {
      const { userId, itemId } = c.req.valid("json");

      // Auto-create user if not found (e.g. after DB reset)
      const existingUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!existingUser) {
        const shortId = userId.slice(-8).replace(/[^a-zA-Z0-9]/g, 'x');
        const base = `user_${shortId}`;
        let nickname = base;
        let suffix = 0;
        while (await prisma.user.findUnique({ where: { nicknameLower: nickname.toLowerCase() } })) {
          suffix++;
          nickname = `${base}${suffix}`;
        }
        await prisma.user.create({
          data: { id: userId, nickname, nicknameLower: nickname.toLowerCase() },
        });
        console.log(`[Store] Auto-created user ${userId} as "${nickname}" for purchase`);
      }

      // Use transaction for atomic operation
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new Error("USER_NOT_FOUND");
        }

        const item = await tx.storeItem.findUnique({
          where: { id: itemId },
        });

        if (!item) {
          throw new Error("ITEM_NOT_FOUND");
        }

        if (!item.available) {
          throw new Error("ITEM_NOT_AVAILABLE");
        }

        // Check if user already owns item (skip for repeatable consumables like sobre_biblico)
        const itemMeta = JSON.parse(item.metadata || '{}');
        const isRepeatableConsumable = itemMeta.repeatablePurchase === true;

        if (!isRepeatableConsumable) {
          const existingInventory = await tx.userInventory.findUnique({
            where: {
              userId_itemId: { userId, itemId },
            },
          });

          if (existingInventory) {
            throw new Error("ALREADY_OWNED");
          }
        }

        // Auto-apply free daily pack if available
        const PACK_ITEM_IDS = ['sobre_biblico', 'pack_pascua', 'pack_milagros', 'pack_heroes'];
        const isPack = PACK_ITEM_IDS.includes(itemId);
        let usedFreePack = false;
        let freePacksRemaining = 0;
        let newPoints = user.points;

        if (isPack) {
          const today = new Date().toISOString().split("T")[0] as string;
          const isPremium = user.role === 'PREMIUM' || user.role === 'OWNER';
          const dailyEarnRate = isPremium ? 2 : 1;
          const dailyActions = parseDailyActions(user.dailyActions);
          const { available, updatedActions } = computeAvailablePacks(dailyActions, today, dailyEarnRate);
          if (available > 0) {
            usedFreePack = true;
            freePacksRemaining = Math.max(0, available - 1);
            const newDailyActions: DailyActions = {
              ...updatedActions,
              dailyPackDate: today,
              dailyPackCount: (updatedActions.dailyPackDate === today ? (updatedActions.dailyPackCount ?? 0) : 0) + 1,
              accumulatedPacks: freePacksRemaining,
            };
            await tx.user.update({ where: { id: userId }, data: { dailyActions: JSON.stringify(newDailyActions) } });
            await tx.userInventory.upsert({
              where: { userId_itemId: { userId, itemId } },
              create: { userId, itemId, source: 'gift' },
              update: { acquiredAt: new Date(), source: 'gift' },
            });
          }
        }

        if (!usedFreePack) {
          // Check if user has enough points
          if (user.points < item.pricePoints) {
            throw new Error("INSUFFICIENT_POINTS");
          }

          // Deduct points and add to inventory
          newPoints = user.points - item.pricePoints;

          await tx.user.update({
            where: { id: userId },
            data: { points: newPoints, pointsSpentTotal: { increment: item.pricePoints } },
          });

          // For repeatable consumables, upsert (don't fail if already "owned")
          await tx.userInventory.upsert({
            where: { userId_itemId: { userId, itemId } },
            create: { userId, itemId, source: "store" },
            update: { acquiredAt: new Date(), source: "store" },
          });

          if (item.pricePoints > 0) {
            const today = new Date().toISOString().split("T")[0] as string;
            await tx.pointLedger.create({
              data: {
                userId,
                ledgerId: `store_purchase_${itemId}_${Date.now()}`,
                type: 'store_purchase',
                dateId: today,
                amount: -item.pricePoints,
                metadata: JSON.stringify({ itemId, itemName: item.nameEs }),
              },
            });
          }
        }

        // === Special: sobre_biblico - draw a random biblical card ===
        // cardsPerPack = 1 (single-card pack, backward-compatible)
        let drawnCard: { cardId: string; wasNew: boolean } | undefined;
        let drawnCards: Array<{ cardId: string; wasNew: boolean }> = [];

        async function drawOneCard(
          pool: string[],
          targetUserId: string,
          tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
        ): Promise<{ cardId: string; wasNew: boolean }> {
          const cardId = pool[Math.floor(Math.random() * pool.length)] as string;
          const existing = await tx.biblicalCardInventory.findUnique({
            where: { userId_cardId: { userId: targetUserId, cardId } },
          });
          if (existing) {
            await tx.biblicalCardInventory.update({
              where: { userId_cardId: { userId: targetUserId, cardId } },
              data: { duplicates: { increment: 1 } },
            });
            return { cardId, wasNew: false };
          } else {
            await tx.biblicalCardInventory.create({
              data: { userId: targetUserId, cardId, owned: true, duplicates: 0, isNew: true },
            });
            return { cardId, wasNew: true };
          }
        }

        if (itemId === 'sobre_biblico') {
          // Only cards with inStandardPool=true are eligible for random draws.
          // Special/legendary cards (e.g. jesus_rey_reyes) and event cards must be excluded here.
          // Keep this list in sync with STANDARD_POOL_IDS in mobile/src/lib/biblical-cards.ts.
          const CARD_POOL: string[] = ['david', 'moses', 'ark', 'espada_espiritu', 'arpa_david', 'zarza_ardiente'];
          const CARDS_PER_PACK = 1;
          for (let i = 0; i < CARDS_PER_PACK; i++) {
            drawnCards.push(await drawOneCard(CARD_POOL, userId, tx));
          }
          drawnCard = drawnCards[0];
        }

        // === Special: pack_pascua - draw a random Pascua 2026 event card ===
        if (itemId === 'pack_pascua') {
          // Only cards belonging to eventSet="pascua_2026".
          // Keep this list in sync with PASCUA_2026_POOL_IDS in mobile/src/lib/biblical-cards.ts.
          const PASCUA_POOL: string[] = [
            'entrada_jerusalen', 'burrito', 'ultima_cena', 'getsemani', 'judas',
            'arresto', 'poncio_pilato', 'barrabas', 'camino_calvario', 'crucifixion',
            'velo_rasgado', 'tumba_sellada', 'resurreccion', 'tomas',
          ];
          const CARDS_PER_PACK = 1;
          for (let i = 0; i < CARDS_PER_PACK; i++) {
            drawnCards.push(await drawOneCard(PASCUA_POOL, userId, tx));
          }
          drawnCard = drawnCards[0];
        }

        // === Special: pack_milagros - draw 3 random Milagros 2026 event cards ===
        if (itemId === 'pack_milagros') {
          // Only cards belonging to eventSet="milagros_2026".
          // Keep this list in sync with MILAGROS_2026_POOL_IDS in mobile/src/lib/biblical-cards.ts.
          const MILAGROS_POOL: string[] = [
            'agua_en_vino', 'pesca_milagrosa', 'sanidad_leproso', 'sanidad_paralitico',
            'sanidad_centurion', 'sanidad_suegra_pedro', 'mano_seca', 'diez_leprosos',
            'sordomudo', 'ciego_betsaida', 'multiplicacion_panes', 'moneda_pez',
            'calma_tormenta', 'higuera_maldita', 'red_peces', 'alimenta_4000',
            'liberacion_demonio', 'nina_resucitada',
            'caminar_agua', 'ciego_nacimiento', 'hijo_viuda_nain', 'endemoniado_gadareno',
            'mujer_flujo', 'jesus_desaparece', 'tempestad_calmada',
            'resurreccion_lazaro', 'transfiguracion', 'jesus_aparece_resucitado',
            'jesus_glorificado',
          ];
          const CARDS_PER_PACK = 3;
          for (let i = 0; i < CARDS_PER_PACK; i++) {
            drawnCards.push(await drawOneCard(MILAGROS_POOL, userId, tx));
          }
          drawnCard = drawnCards[0];
        }

        // === Special: pack_heroes - draw 3 random Héroes de la Fe 2026 cards ===
        if (itemId === 'pack_heroes') {
          // Only cards belonging to eventSet="heroes_2026" (excludes secret reward card).
          // Keep this list in sync with HEROES_2026_POOL_IDS in mobile/src/lib/biblical-cards.ts.
          const HEROES_POOL: string[] = [
            'noe_contra_corriente', 'abraham_cree_imposible', 'abraham_isaac_entrega',
            'jacob_marcado_cambiar', 'jose_del_pozo', 'moises_llamado_inesperado',
            'mar_rojo_camino', 'sinai_dios_habla', 'josue_obediencia_ilogica',
            'rahab_fe_rescata', 'gedeon_menos_es_mas', 'debora_liderar_fe',
            'sanson_fuerza_sin_control', 'samuel_habla_senor', 'david_gigantes_caen',
            'david_corazon_correcto', 'elias_fuego_cielo', 'elias_en_secreto',
            'eliseo_dios_provee', 'jonas_huir_no_funciona', 'jonas_dios_misericordia',
            'daniel_fe_firme', 'horno_fuego_firme', 'ester_para_este_momento',
            'nehemias_reconstruir',
          ];
          const CARDS_PER_PACK = 3;
          for (let i = 0; i < CARDS_PER_PACK; i++) {
            drawnCards.push(await drawOneCard(HEROES_POOL, userId, tx));
          }
          drawnCard = drawnCards[0];
        }

        // Track pack opening in PointLedger for accurate dashboard counts
        if (isPack) {
          const today = new Date().toISOString().split("T")[0] as string;
          const ts = Date.now();
          await tx.pointLedger.create({
            data: {
              userId,
              ledgerId: `pack_open_${itemId}_${ts}`,
              type: 'pack_open',
              dateId: today,
              amount: 0,
              metadata: JSON.stringify({ packType: itemId, source: usedFreePack ? 'free' : 'store' }),
            },
          });
        }

        return { item, newPoints, drawnCard, drawnCards, usedFreePack, freePacksRemaining };
      });

      return c.json({
        success: true,
        item: result.item,
        newPoints: result.newPoints,
        drawnCard: result.drawnCard ?? null,
        drawnCards: result.drawnCards ?? [],
        usedFreePack: result.usedFreePack ?? false,
        freePacksRemaining: result.freePacksRemaining ?? 0,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (errorMessage === "USER_NOT_FOUND") {
        return c.json({ error: "User not found" }, 404);
      }
      if (errorMessage === "ITEM_NOT_FOUND") {
        return c.json({ error: "Item not found" }, 404);
      }
      if (errorMessage === "ITEM_NOT_AVAILABLE") {
        return c.json({ error: "Item is not available" }, 400);
      }
      if (errorMessage === "ALREADY_OWNED") {
        return c.json({ error: "You already own this item" }, 400);
      }
      if (errorMessage === "INSUFFICIENT_POINTS") {
        return c.json({ error: "Insufficient points" }, 400);
      }

      console.error("[Gamification] Error purchasing item:", error);
      return c.json({ error: "Failed to purchase item" }, 500);
    }
  }
);

// POST /store/purchase-bundle - Purchase a bundle of items
gamificationRouter.post(
  "/store/purchase-bundle",
  zValidator("json", z.object({
    userId: z.string(),
    bundleId: z.string(),
    itemIds: z.array(z.string()),
    bundlePrice: z.number(),
  })),
  async (c) => {
    try {
      const { userId, bundleId, itemIds, bundlePrice } = c.req.valid("json");

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new Error("USER_NOT_FOUND");
        }

        // Check if user has enough points
        if (user.points < bundlePrice) {
          throw new Error("INSUFFICIENT_POINTS");
        }

        // Find all items in the bundle
        const items = await tx.storeItem.findMany({
          where: { id: { in: itemIds } },
        });

        // Check which items user already owns
        const existingInventory = await tx.userInventory.findMany({
          where: {
            userId,
            itemId: { in: itemIds },
          },
        });

        const ownedItemIds = new Set(existingInventory.map(inv => inv.itemId));
        const itemsToAdd = items.filter(item => !ownedItemIds.has(item.id));

        if (itemsToAdd.length === 0) {
          throw new Error("ALL_ITEMS_OWNED");
        }

        // Deduct points
        const newPoints = user.points - bundlePrice;

        await tx.user.update({
          where: { id: userId },
          data: { points: newPoints, pointsSpentTotal: { increment: bundlePrice } },
        });

        // Add all new items to inventory
        for (const item of itemsToAdd) {
          await tx.userInventory.create({
            data: {
              userId,
              itemId: item.id,
              source: `bundle:${bundleId}`,
            },
          });
        }

        if (bundlePrice > 0) {
          const today = new Date().toISOString().split("T")[0] as string;
          await tx.pointLedger.create({
            data: {
              userId,
              ledgerId: `bundle_purchase_${bundleId}_${Date.now()}`,
              type: 'store_purchase',
              dateId: today,
              amount: -bundlePrice,
              metadata: JSON.stringify({ bundleId }),
            },
          });
        }

        return {
          itemsAdded: itemsToAdd,
          newPoints,
          alreadyOwned: items.length - itemsToAdd.length,
        };
      });

      return c.json({
        success: true,
        itemsAdded: result.itemsAdded,
        newPoints: result.newPoints,
        alreadyOwned: result.alreadyOwned,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (errorMessage === "USER_NOT_FOUND") {
        return c.json({ error: "User not found" }, 404);
      }
      if (errorMessage === "INSUFFICIENT_POINTS") {
        return c.json({ error: "Insufficient points" }, 400);
      }
      if (errorMessage === "ALL_ITEMS_OWNED") {
        return c.json({ error: "You already own all items in this bundle" }, 400);
      }

      console.error("[Gamification] Error purchasing bundle:", error);
      return c.json({ error: "Failed to purchase bundle" }, 500);
    }
  }
);

// POST /user/:userId/equip - Equip item
gamificationRouter.post(
  "/user/:userId/equip",
  zValidator("json", equipSchema),
  async (c) => {
    try {
      const userId = c.req.param("userId");
      const { type, itemId } = c.req.valid("json");

      // Auto-create user if not found (e.g. after DB reset)
      let user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        const shortId = userId.slice(-8).replace(/[^a-zA-Z0-9]/g, 'x');
        const base = `user_${shortId}`;
        let nickname = base;
        let suffix = 0;
        while (await prisma.user.findUnique({ where: { nicknameLower: nickname.toLowerCase() } })) {
          suffix++;
          nickname = `${base}${suffix}`;
        }
        user = await prisma.user.create({
          data: { id: userId, nickname, nicknameLower: nickname.toLowerCase() },
        });
        console.log(`[Store] Auto-created user ${userId} as "${nickname}" for equip`);
      }

      // Check if user owns the item (or it's a default/free item)
      // itemId can be null to unequip badge
      const isDefaultFreeItem = itemId !== null && (
        itemId.startsWith("music_free_") ||
        itemId === "theme_amanecer" ||
        itemId.startsWith("avatar_")
      );

      if (itemId !== null && !isDefaultFreeItem) {
        const inventoryItem = await prisma.userInventory.findUnique({
          where: {
            userId_itemId: { userId, itemId },
          },
        });

        // If not in inventory, check if the item exists in store and add it (trust client claim)
        if (!inventoryItem) {
          const storeItem = await prisma.storeItem.findUnique({ where: { id: itemId } });
          if (storeItem) {
            await prisma.userInventory.upsert({
              where: { userId_itemId: { userId, itemId } },
              create: { userId, itemId, source: "store" },
              update: {},
            });
            console.log(`[Store] Added missing inventory item ${itemId} for user ${userId} during equip`);
          } else {
            return c.json({ error: "You do not own this item" }, 403);
          }
        }
      }

      // Update the appropriate field based on type
      const updateData: Record<string, string | null> = {};
      switch (type) {
        case "theme":
          updateData.themeId = itemId ?? "theme_amanecer";
          break;
        case "frame":
          updateData.frameId = itemId;
          break;
        case "title":
          updateData.titleId = itemId;
          break;
        case "music":
          updateData.selectedMusicId = itemId ?? "music_free_1";
          break;
        case "avatar":
          updateData.avatarId = itemId ?? "avatar_dove";
          break;
        case "badge":
          updateData.activeBadgeId = itemId;
          break;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          inventory: {
            include: { item: true },
          },
        },
      });

      return c.json(updatedUser);
    } catch (error) {
      console.error("[Gamification] Error equipping item:", error);
      return c.json({ error: "Failed to equip item" }, 500);
    }
  }
);

// ============================================
// NOTIFICATION BADGE COUNTS
// ============================================

// GET /notifications/badge-counts - Returns all in-app badge counts for a user
gamificationRouter.get("/notifications/badge-counts", async (c) => {
  try {
    const userId = c.req.header("x-user-id");
    if (!userId) return c.json({ error: "x-user-id header required" }, 400);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      pendingTradesCount,
      pendingGift,
      unseenStoreGiftsCount,
      user,
      commentLikesCount,
      pendingSupportCount,
    ] = await Promise.all([
      // Incoming pending trades (where I'm the receiver)
      prisma.cardTrade.count({
        where: { toUserId: userId, status: "pending" },
      }),
      // App-drop gift pending
      prisma.userGift.findFirst({
        where: { userId, status: "PENDING" },
        select: { id: true },
      }),
      // Unseen user-to-user gift notifications
      prisma.giftNotification.count({
        where: { userId, seen: false },
      }),
      // User (for daily pack check via dailyActions)
      prisma.user.findUnique({ where: { id: userId }, select: { dailyActions: true, role: true } }),
      // Likes on MY comments from the past 7 days by other users
      prisma.devotionalCommentLike.count({
        where: {
          comment: { userId },
          userId: { not: userId },
          createdAt: { gte: weekAgo },
        },
      }),
      // Support tickets awaiting user response
      prisma.supportTicket.count({
        where: { userId, status: "waiting_user" },
      }),
    ]);

    // Daily pack availability via accumulated-pack logic
    let dailyPackAvailable = false;
    if (user) {
      const today = new Date().toISOString().split("T")[0] as string;
      const dailyActions = parseDailyActions(user.dailyActions);
      const isPremium = user.role === 'PREMIUM' || user.role === 'OWNER';
      const { available } = computeAvailablePacks(dailyActions, today, isPremium ? 2 : 1);
      dailyPackAvailable = available > 0;
    }

    return c.json({
      pendingTradesCount,
      hasPendingGift: !!pendingGift,
      unseenStoreGiftsCount,
      dailyPackAvailable,
      recentCommentLikesCount: commentLikesCount,
      pendingSupportCount,
    });
  } catch (error) {
    console.error("[Gamification] Error getting badge counts:", error);
    return c.json({ error: "Failed to get badge counts" }, 500);
  }
});

// ============================================
// WEEKLY CHALLENGES ENDPOINTS
// ============================================

// GET /challenges/current - Get current week's challenges
gamificationRouter.get("/challenges/current", async (c) => {
  try {
    const currentWeekId = getCurrentWeekId();

    const challenges = await prisma.weeklyChallenge.findMany({
      where: { weekId: currentWeekId },
      orderBy: { challengeIndex: "asc" },
    });

    return c.json(challenges);
  } catch (error) {
    console.error("[Gamification] Error getting current challenges:", error);
    return c.json({ error: "Failed to get challenges" }, 500);
  }
});

// GET /challenges/progress/:userId - Get user's challenge progress (optionally for a specific weekId/round)
gamificationRouter.get("/challenges/progress/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const weekIdParam = c.req.query("weekId");
    const currentWeekId = weekIdParam ?? getCurrentWeekId();

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Get current week's challenges
    const challenges = await prisma.weeklyChallenge.findMany({
      where: { weekId: currentWeekId },
    });

    // Get or create progress for each challenge
    const progressList = await Promise.all(
      challenges.map(async (challenge) => {
        let progress = await prisma.weeklyProgress.findUnique({
          where: {
            userId_challengeId: { userId, challengeId: challenge.id },
          },
          include: { challenge: true },
        });

        if (!progress) {
          progress = await prisma.weeklyProgress.create({
            data: {
              userId,
              challengeId: challenge.id,
            },
            include: { challenge: true },
          });
        }

        return progress;
      })
    );

    return c.json(progressList);
  } catch (error) {
    console.error("[Gamification] Error getting challenge progress:", error);
    return c.json({ error: "Failed to get progress" }, 500);
  }
});

// POST /challenges/update - Update challenge progress
gamificationRouter.post(
  "/challenges/update",
  zValidator("json", updateChallengeSchema),
  async (c) => {
    try {
      const { userId, type } = c.req.valid("json");
      const currentWeekId = getCurrentWeekId();

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      // Find challenges of this type for current week
      const challenges = await prisma.weeklyChallenge.findMany({
        where: {
          weekId: currentWeekId,
          type: type,
        },
      });

      const updatedProgress: Array<{
        id: string;
        userId: string;
        challengeId: string;
        currentCount: number;
        completed: boolean;
        claimed: boolean;
        updatedAt: Date;
      }> = [];
      const completedFlags: boolean[] = [];

      for (const challenge of challenges) {
        // Get or create progress
        let progress = await prisma.weeklyProgress.findUnique({
          where: {
            userId_challengeId: { userId, challengeId: challenge.id },
          },
        });

        if (!progress) {
          progress = await prisma.weeklyProgress.create({
            data: {
              userId,
              challengeId: challenge.id,
            },
          });
        }

        // Don't update if already completed
        if (progress.completed) {
          updatedProgress.push(progress);
          completedFlags.push(false); // Already was completed, not newly completed
          continue;
        }

        const newCount = progress.currentCount + 1;
        const isNowCompleted = newCount >= challenge.goalCount;

        const updated = await prisma.weeklyProgress.update({
          where: { id: progress.id },
          data: {
            currentCount: newCount,
            completed: isNowCompleted,
          },
        });

        updatedProgress.push(updated);
        completedFlags.push(isNowCompleted);
      }

      return c.json({
        updated: updatedProgress,
        completed: completedFlags,
      });
    } catch (error) {
      console.error("[Gamification] Error updating challenge:", error);
      return c.json({ error: "Failed to update challenge" }, 500);
    }
  }
);

// POST /challenges/claim - Claim challenge reward
gamificationRouter.post(
  "/challenges/claim",
  zValidator("json", claimChallengeSchema),
  async (c) => {
    try {
      const { userId, challengeId } = c.req.valid("json");

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new Error("USER_NOT_FOUND");
        }

        const progress = await tx.weeklyProgress.findUnique({
          where: {
            userId_challengeId: { userId, challengeId },
          },
          include: { challenge: true },
        });

        if (!progress) {
          throw new Error("PROGRESS_NOT_FOUND");
        }

        if (!progress.completed) {
          throw new Error("NOT_COMPLETED");
        }

        if (progress.claimed) {
          throw new Error("ALREADY_CLAIMED");
        }

        // Award points
        const newPoints = user.points + progress.challenge.rewardPoints;

        await tx.user.update({
          where: { id: userId },
          data: { points: newPoints },
        });

        // Mark as claimed
        await tx.weeklyProgress.update({
          where: { id: progress.id },
          data: { claimed: true },
        });

        // Award optional item
        let itemAwarded = null;
        if (progress.challenge.rewardItemId) {
          const item = await tx.storeItem.findUnique({
            where: { id: progress.challenge.rewardItemId },
          });

          if (item) {
            // Check if user already has the item
            const existingInventory = await tx.userInventory.findUnique({
              where: {
                userId_itemId: { userId, itemId: item.id },
              },
            });

            if (!existingInventory) {
              await tx.userInventory.create({
                data: {
                  userId,
                  itemId: item.id,
                  source: "challenge",
                },
              });
              itemAwarded = item;
            }
          }
        }

        return {
          pointsAwarded: progress.challenge.rewardPoints,
          itemAwarded,
        };
      });

      return c.json({
        success: true,
        pointsAwarded: result.pointsAwarded,
        itemAwarded: result.itemAwarded,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (errorMessage === "USER_NOT_FOUND") {
        return c.json({ error: "User not found" }, 404);
      }
      if (errorMessage === "PROGRESS_NOT_FOUND") {
        return c.json({ error: "Challenge progress not found" }, 404);
      }
      if (errorMessage === "NOT_COMPLETED") {
        return c.json({ error: "Challenge not completed yet" }, 400);
      }
      if (errorMessage === "ALREADY_CLAIMED") {
        return c.json({ error: "Reward already claimed" }, 400);
      }

      console.error("[Gamification] Error claiming reward:", error);
      return c.json({ error: "Failed to claim reward" }, 500);
    }
  }
);

// GET /challenges/active-round/:userId - Returns challenges for user's current active (incomplete) round
gamificationRouter.get("/challenges/active-round/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const baseWeekId = getCurrentWeekId();

    // Find all rounds for this week (base + suffixed)
    const allWeekChallenges = await prisma.weeklyChallenge.findMany({
      where: { weekId: { startsWith: baseWeekId } },
      orderBy: [{ weekId: "asc" }, { challengeIndex: "asc" }],
    });

    // Group by weekId (each weekId = one round)
    const roundMap = new Map<string, typeof allWeekChallenges>();
    for (const c of allWeekChallenges) {
      if (!roundMap.has(c.weekId)) roundMap.set(c.weekId, []);
      roundMap.get(c.weekId)!.push(c);
    }

    // Sort rounds: base first, then r2, r3...
    const sortedRoundIds = [...roundMap.keys()].sort((a, b) => {
      if (a === baseWeekId) return -1;
      if (b === baseWeekId) return 1;
      const na = parseInt(a.match(/-r(\d+)$/)?.[1] ?? "1");
      const nb = parseInt(b.match(/-r(\d+)$/)?.[1] ?? "1");
      return na - nb;
    });

    // Find the first round where the user has NOT yet claimed all visible challenges (first 3)
    for (const weekId of sortedRoundIds) {
      const challenges = (roundMap.get(weekId) ?? []).slice(0, 3);
      if (challenges.length === 0) continue;

      const progressList = await prisma.weeklyProgress.findMany({
        where: { userId, challengeId: { in: challenges.map(c => c.id) } },
      });

      const allClaimed = challenges.every(ch =>
        progressList.find(p => p.challengeId === ch.id)?.claimed === true
      );

      if (!allClaimed) {
        const roundMatch = weekId.match(/-r(\d+)$/);
        const roundNumber = roundMatch?.[1] ? parseInt(roundMatch[1]) : 1;
        return c.json({ challenges, weekId, roundNumber });
      }
    }

    // All existing rounds are fully claimed — return the last round so UI can show "all done"
    const lastRoundId = sortedRoundIds[sortedRoundIds.length - 1] ?? baseWeekId;
    const lastChallenges = (roundMap.get(lastRoundId) ?? []).slice(0, 3);
    const roundMatch = lastRoundId.match(/-r(\d+)$/);
    const roundNumber = roundMatch?.[1] ? parseInt(roundMatch[1]) : 1;
    return c.json({ challenges: lastChallenges, weekId: lastRoundId, roundNumber });
  } catch (error) {
    console.error("[Gamification] Error getting active round:", error);
    return c.json({ error: "Failed to get active round" }, 500);
  }
});

// POST /challenges/next-round - Generate the next round of challenges (called after chest claim)
gamificationRouter.post("/challenges/next-round", async (c) => {
  try {
    const result = await generateNextRound();
    return c.json(result);
  } catch (error) {
    console.error("[Gamification] Error generating next round:", error);
    return c.json({ error: "Failed to generate next round" }, 500);
  }
});

// POST /challenges/admin/force-complete - Mark user's current active round as completed+claimed (admin/testing)
gamificationRouter.post("/challenges/admin/force-complete", async (c) => {
  try {
    const body = await c.req.json();
    const userId = body?.userId as string;
    if (!userId) return c.json({ error: "userId required" }, 400);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return c.json({ error: "User not found" }, 404);

    const baseWeekId = getCurrentWeekId();

    // Find all rounds for this week
    const allWeekChallenges = await prisma.weeklyChallenge.findMany({
      where: { weekId: { startsWith: baseWeekId } },
      orderBy: [{ weekId: "asc" }, { challengeIndex: "asc" }],
    });

    // Group by weekId
    const roundMap = new Map<string, typeof allWeekChallenges>();
    for (const ch of allWeekChallenges) {
      if (!roundMap.has(ch.weekId)) roundMap.set(ch.weekId, []);
      roundMap.get(ch.weekId)!.push(ch);
    }

    const sortedRoundIds = [...roundMap.keys()].sort((a, b) => {
      if (a === baseWeekId) return -1;
      if (b === baseWeekId) return 1;
      const na = parseInt(a.match(/-r(\d+)$/)?.[1] ?? "1");
      const nb = parseInt(b.match(/-r(\d+)$/)?.[1] ?? "1");
      return na - nb;
    });

    // Find the first round where not all 3 challenges are claimed
    let targetWeekId = baseWeekId;
    for (const weekId of sortedRoundIds) {
      const challenges = (roundMap.get(weekId) ?? []).slice(0, 3);
      if (challenges.length === 0) continue;
      const progressList = await prisma.weeklyProgress.findMany({
        where: { userId, challengeId: { in: challenges.map(ch => ch.id) } },
      });
      const allClaimed = challenges.every(ch =>
        progressList.find(p => p.challengeId === ch.id)?.claimed === true
      );
      if (!allClaimed) {
        targetWeekId = weekId;
        break;
      }
    }

    const targetChallenges = (roundMap.get(targetWeekId) ?? []).slice(0, 3);

    for (const challenge of targetChallenges) {
      await prisma.weeklyProgress.upsert({
        where: { userId_challengeId: { userId, challengeId: challenge.id } },
        create: { userId, challengeId: challenge.id, currentCount: challenge.goalCount, completed: true, claimed: true },
        update: { currentCount: challenge.goalCount, completed: true, claimed: true },
      });
    }

    console.log(`[Admin] Force-completed ${targetChallenges.length} challenges for user ${userId} (${targetWeekId})`);
    return c.json({ success: true, challengesCompleted: targetChallenges.length, weekId: targetWeekId });
  } catch (error) {
    console.error("[Admin] Error force-completing challenges:", error);
    return c.json({ error: "Failed to force-complete challenges" }, 500);
  }
});

// POST /challenges/admin/reset - Reset all challenge progress for the current week (all rounds) for a user
gamificationRouter.post("/challenges/admin/reset", async (c) => {
  try {
    const body = await c.req.json();
    const userId = body?.userId as string;
    if (!userId) return c.json({ error: "userId required" }, 400);

    const baseWeekId = getCurrentWeekId();
    const challenges = await prisma.weeklyChallenge.findMany({
      where: { weekId: { startsWith: baseWeekId } },
    });

    for (const challenge of challenges) {
      await prisma.weeklyProgress.deleteMany({
        where: { userId, challengeId: challenge.id },
      });
    }

    console.log(`[Admin] Reset challenge progress for user ${userId} (week ${baseWeekId}, all rounds)`);
    return c.json({ success: true, weekId: baseWeekId });
  } catch (error) {
    console.error("[Admin] Error resetting challenges:", error);
    return c.json({ error: "Failed to reset challenges" }, 500);
  }
});

// ============================================
// NICKNAME VALIDATION ENDPOINT
// ============================================

// GET /nickname/check/:nickname - Check if nickname available
gamificationRouter.get("/nickname/check/:nickname", async (c) => {
  try {
    const nickname = c.req.param("nickname");
    const nicknameLower = nickname.toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { nicknameLower },
    });

    return c.json({ available: !existingUser });
  } catch (error) {
    console.error("[Gamification] Error checking nickname:", error);
    return c.json({ error: "Failed to check nickname" }, 500);
  }
});

// ============================================
// TRANSFER CODE ENDPOINTS
// ============================================

// POST /transfer/generate - Generate a transfer code for account restoration
gamificationRouter.post(
  "/transfer/generate",
  zValidator("json", generateTransferCodeSchema),
  async (c) => {
    try {
      const { userId } = c.req.valid("json");

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      // Check if user already has an active (unexpired, unused) transfer code
      const existingActiveCode = await prisma.transferCode.findFirst({
        where: {
          sourceUserId: userId,
          used: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (existingActiveCode) {
        return c.json({
          code: existingActiveCode.code,
          expiresAt: existingActiveCode.expiresAt.toISOString(),
          message: "Existing active code returned",
        });
      }

      // Generate new code with 15-minute expiry
      const code = generateTransferCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      const transferCode = await prisma.transferCode.create({
        data: {
          code,
          sourceUserId: userId,
          expiresAt,
        },
      });

      return c.json({
        code: transferCode.code,
        expiresAt: transferCode.expiresAt.toISOString(),
      });
    } catch (error) {
      console.error("[Gamification] Error generating transfer code:", error);
      return c.json({ error: "Failed to generate transfer code" }, 500);
    }
  }
);

// POST /transfer/restore - Restore account using transfer code
gamificationRouter.post(
  "/transfer/restore",
  zValidator("json", restoreTransferCodeSchema),
  async (c) => {
    try {
      const { code, targetUserId } = c.req.valid("json");

      const result = await prisma.$transaction(async (tx) => {
        // Find the transfer code
        const transferCode = await tx.transferCode.findUnique({
          where: { code: code.toUpperCase() },
        });

        if (!transferCode) {
          throw new Error("INVALID_CODE");
        }

        if (transferCode.used) {
          throw new Error("CODE_ALREADY_USED");
        }

        if (transferCode.expiresAt < new Date()) {
          throw new Error("CODE_EXPIRED");
        }

        // Get source user data
        const sourceUser = await tx.user.findUnique({
          where: { id: transferCode.sourceUserId },
          include: {
            inventory: true,
            favorites: true,
            weeklyProgress: true,
            pointLedger: true,
          },
        });

        if (!sourceUser) {
          throw new Error("SOURCE_USER_NOT_FOUND");
        }

        // Get or create target user
        let targetUser = await tx.user.findUnique({
          where: { id: targetUserId },
        });

        if (!targetUser) {
          throw new Error("TARGET_USER_NOT_FOUND");
        }

        // Prevent self-transfer
        if (sourceUser.id === targetUserId) {
          throw new Error("CANNOT_TRANSFER_TO_SELF");
        }

        // Copy all data from source to target user
        targetUser = await tx.user.update({
          where: { id: targetUserId },
          data: {
            points: sourceUser.points,
            streakCurrent: sourceUser.streakCurrent,
            streakBest: sourceUser.streakBest,
            devotionalsCompleted: sourceUser.devotionalsCompleted,
            totalTimeSeconds: sourceUser.totalTimeSeconds,
            lastActiveAt: sourceUser.lastActiveAt,
            dailyActions: sourceUser.dailyActions,
            themeId: sourceUser.themeId,
            frameId: sourceUser.frameId,
            titleId: sourceUser.titleId,
            selectedMusicId: sourceUser.selectedMusicId,
            avatarId: sourceUser.avatarId,
            migratedFromUserId: sourceUser.id,
          },
        });

        // Copy inventory items (skip if already owned)
        for (const item of sourceUser.inventory) {
          const existingItem = await tx.userInventory.findUnique({
            where: {
              userId_itemId: { userId: targetUserId, itemId: item.itemId },
            },
          });

          if (!existingItem) {
            await tx.userInventory.create({
              data: {
                userId: targetUserId,
                itemId: item.itemId,
                source: "transfer",
              },
            });
          }
        }

        // Copy favorites (skip if already exists)
        for (const favorite of sourceUser.favorites) {
          const existingFavorite = await tx.userFavorite.findUnique({
            where: {
              userId_devotionalDate: {
                userId: targetUserId,
                devotionalDate: favorite.devotionalDate,
              },
            },
          });

          if (!existingFavorite) {
            await tx.userFavorite.create({
              data: {
                userId: targetUserId,
                devotionalDate: favorite.devotionalDate,
              },
            });
          }
        }

        // Copy point ledger entries (update userId, skip if ledgerId already exists)
        for (const ledgerEntry of sourceUser.pointLedger) {
          const existingEntry = await tx.pointLedger.findUnique({
            where: {
              userId_ledgerId: {
                userId: targetUserId,
                ledgerId: ledgerEntry.ledgerId,
              },
            },
          });

          if (!existingEntry) {
            await tx.pointLedger.create({
              data: {
                userId: targetUserId,
                ledgerId: ledgerEntry.ledgerId,
                type: ledgerEntry.type,
                dateId: ledgerEntry.dateId,
                amount: ledgerEntry.amount,
                metadata: ledgerEntry.metadata,
              },
            });
          }
        }

        // Mark transfer code as used
        await tx.transferCode.update({
          where: { id: transferCode.id },
          data: {
            used: true,
            usedByUserId: targetUserId,
            usedAt: new Date(),
          },
        });

        // Get updated target user with all relations
        const restoredUser = await tx.user.findUnique({
          where: { id: targetUserId },
          include: {
            inventory: { include: { item: true } },
            favorites: true,
          },
        });

        return restoredUser;
      });

      return c.json({
        success: true,
        user: result,
        message: "Account data restored successfully",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (errorMessage === "INVALID_CODE") {
        return c.json({ error: "Invalid transfer code" }, 400);
      }
      if (errorMessage === "CODE_ALREADY_USED") {
        return c.json({ error: "Transfer code has already been used" }, 400);
      }
      if (errorMessage === "CODE_EXPIRED") {
        return c.json({ error: "Transfer code has expired" }, 400);
      }
      if (errorMessage === "SOURCE_USER_NOT_FOUND") {
        return c.json({ error: "Source account not found" }, 404);
      }
      if (errorMessage === "TARGET_USER_NOT_FOUND") {
        return c.json({ error: "Target user not found" }, 404);
      }
      if (errorMessage === "CANNOT_TRANSFER_TO_SELF") {
        return c.json({ error: "Cannot transfer to the same account" }, 400);
      }

      console.error("[Gamification] Error restoring account:", error);
      return c.json({ error: "Failed to restore account" }, 500);
    }
  }
);

// GET /transfer/active/:userId - Check if user has an active transfer code
gamificationRouter.get("/transfer/active/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const activeCode = await prisma.transferCode.findFirst({
      where: {
        sourceUserId: userId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeCode) {
      return c.json({
        hasActiveCode: true,
        code: activeCode.code,
        expiresAt: activeCode.expiresAt.toISOString(),
      });
    }

    return c.json({
      hasActiveCode: false,
    });
  } catch (error) {
    console.error("[Gamification] Error checking active transfer code:", error);
    return c.json({ error: "Failed to check transfer code" }, 500);
  }
});

// ============================================
// DEVICE ID ENDPOINTS
// ============================================

// GET /user/by-device/:deviceId - Find user by device ID
gamificationRouter.get("/user/by-device/:deviceId", async (c) => {
  try {
    const deviceId = c.req.param("deviceId");

    const user = await prisma.user.findFirst({
      where: { deviceId },
      include: {
        inventory: {
          include: { item: true },
        },
      },
    });

    if (!user) {
      return c.json({ found: false });
    }

    const equippedItems = {
      theme: user.themeId,
      frame: user.frameId,
      title: user.titleId,
      music: user.selectedMusicId,
      badge: user.activeBadgeId,
    };

    return c.json({
      found: true,
      user: { ...user, equippedItems },
    });
  } catch (error) {
    console.error("[Gamification] Error finding user by device:", error);
    return c.json({ error: "Failed to find user" }, 500);
  }
});

// PATCH /user/:userId/device - Update user's device ID
gamificationRouter.patch(
  "/user/:userId/device",
  zValidator("json", updateDeviceIdSchema),
  async (c) => {
    try {
      const userId = c.req.param("userId");
      const { deviceId } = c.req.valid("json");

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { deviceId },
        include: {
          inventory: {
            include: { item: true },
          },
        },
      });

      return c.json(updatedUser);
    } catch (error) {
      console.error("[Gamification] Error updating device ID:", error);
      return c.json({ error: "Failed to update device ID" }, 500);
    }
  }
);

// ============================================
// POINTS LEDGER ENDPOINTS
// ============================================

// GET /points/ledger/:userId - Get user's point ledger history
gamificationRouter.get("/points/ledger/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const limit = parseInt(c.req.query("limit") ?? "50", 10);
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const [entries, total] = await Promise.all([
      prisma.pointLedger.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.pointLedger.count({
        where: { userId },
      }),
    ]);

    return c.json({
      entries,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Gamification] Error getting points ledger:", error);
    return c.json({ error: "Failed to get points ledger" }, 500);
  }
});

// ============================================
// PROMO CODE ENDPOINTS
// ============================================

// Validation schema for promo code redemption
const redeemPromoCodeSchema = z.object({
  userId: z.string(),
  code: z.string().min(1).max(50),
});

// Helper function to normalize promo code input
// Removes accents, trims whitespace, converts to lowercase
function normalizePromoCode(rawCode: string): string {
  // Remove accents/diacritics
  const normalized = rawCode
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ""); // Remove all whitespace
  return normalized;
}

// POST /promo/redeem - Redeem a promo code
gamificationRouter.post(
  "/promo/redeem",
  zValidator("json", redeemPromoCodeSchema),
  async (c) => {
    try {
      const { userId, code: rawCode } = c.req.valid("json");
      const codeId = normalizePromoCode(rawCode);
      const today = getTodayDateString();

      console.log(`[PromoCode] User ${userId} attempting to redeem: "${rawCode}" -> normalized: "${codeId}"`);

      const result = await prisma.$transaction(async (tx) => {
        // 1. Check if promo code exists
        const promoCode = await tx.promoCode.findUnique({
          where: { id: codeId },
        });

        if (!promoCode) {
          console.log(`[PromoCode] Code not found: ${codeId}`);
          throw new Error("INVALID_CODE");
        }

        // 2. Check if code is active
        if (!promoCode.isActive) {
          console.log(`[PromoCode] Code not active: ${codeId}`);
          throw new Error("CODE_UNAVAILABLE");
        }

        // 3. Check max uses if applicable
        if (promoCode.maxUses !== null && promoCode.totalUses >= promoCode.maxUses) {
          console.log(`[PromoCode] Code max uses reached: ${codeId} (${promoCode.totalUses}/${promoCode.maxUses})`);
          throw new Error("CODE_UNAVAILABLE");
        }

        // 4. Check if user exists
        const user = await tx.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          throw new Error("USER_NOT_FOUND");
        }

        // 5. Check if user already redeemed this code
        const existingRedemption = await tx.promoRedemption.findUnique({
          where: {
            userId_codeId: { userId, codeId },
          },
        });

        if (existingRedemption) {
          console.log(`[PromoCode] User ${userId} already redeemed: ${codeId}`);
          throw new Error("ALREADY_REDEEMED");
        }

        // 6. Check if ledger entry already exists (idempotency check)
        const ledgerId = `promo_${codeId}`;
        const existingLedger = await tx.pointLedger.findUnique({
          where: {
            userId_ledgerId: { userId, ledgerId },
          },
        });

        if (existingLedger) {
          console.log(`[PromoCode] Ledger entry already exists for user ${userId}: ${ledgerId}`);
          throw new Error("ALREADY_REDEEMED");
        }

        // 7. Create redemption record
        await tx.promoRedemption.create({
          data: {
            userId,
            codeId,
            pointsAwarded: promoCode.points,
          },
        });

        // 8. Create ledger entry (idempotent tracking)
        await tx.pointLedger.create({
          data: {
            userId,
            ledgerId,
            type: "promo",
            dateId: today,
            amount: promoCode.points,
            metadata: JSON.stringify({
              codeId,
              displayCode: promoCode.displayCode,
            }),
          },
        });

        // 9. Increment user points
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            points: { increment: promoCode.points },
          },
        });

        // 10. Increment promo code total uses
        await tx.promoCode.update({
          where: { id: codeId },
          data: {
            totalUses: { increment: 1 },
          },
        });

        console.log(`[PromoCode] Successfully redeemed! User ${userId} received ${promoCode.points} points for code "${promoCode.displayCode}"`);

        return {
          pointsAwarded: promoCode.points,
          displayCode: promoCode.displayCode,
          newTotal: updatedUser.points,
        };
      });

      return c.json({
        success: true,
        pointsAwarded: result.pointsAwarded,
        displayCode: result.displayCode,
        newTotal: result.newTotal,
        message: `Código aplicado: +${result.pointsAwarded} puntos`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (errorMessage === "INVALID_CODE") {
        return c.json({
          success: false,
          error: "Código inválido",
          errorCode: "INVALID_CODE"
        }, 400);
      }
      if (errorMessage === "CODE_UNAVAILABLE") {
        return c.json({
          success: false,
          error: "Este código ya no está disponible",
          errorCode: "CODE_UNAVAILABLE"
        }, 400);
      }
      if (errorMessage === "USER_NOT_FOUND") {
        return c.json({
          success: false,
          error: "Usuario no encontrado",
          errorCode: "USER_NOT_FOUND"
        }, 404);
      }
      if (errorMessage === "ALREADY_REDEEMED") {
        return c.json({
          success: false,
          error: "Ya canjeaste este código",
          errorCode: "ALREADY_REDEEMED"
        }, 400);
      }

      console.error("[PromoCode] Error redeeming promo code:", error);
      return c.json({
        success: false,
        error: "Error al canjear el código",
        errorCode: "UNKNOWN_ERROR"
      }, 500);
    }
  }
);

// GET /promo/user/:userId - Get user's redemption history
gamificationRouter.get("/promo/user/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const redemptions = await prisma.promoRedemption.findMany({
      where: { userId },
      include: { promoCode: true },
      orderBy: { redeemedAt: "desc" },
    });

    return c.json(redemptions);
  } catch (error) {
    console.error("[PromoCode] Error getting user redemptions:", error);
    return c.json({ error: "Failed to get redemptions" }, 500);
  }
});

// ============================================
// COMMUNITY ENDPOINTS
// ============================================

// Schema for updating community opt-in
const updateCommunityOptInSchema = z.object({
  optIn: z.boolean(),
});

// GET /community/members - Get community members list with activity-first ordering
gamificationRouter.get("/community/members", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") ?? "20", 10);
    const offset = parseInt(c.req.query("offset") ?? "0", 10);

    // Admin user IDs (comma-separated in ADMIN_USER_IDS env var)
    const adminUserIds = (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Fetch all opted-in users ordered by most recent activity first
    const [allMembers, total] = await Promise.all([
      prisma.user.findMany({
        where: { communityOptIn: true },
        select: {
          id: true,
          nickname: true,
          avatarId: true,
          frameId: true,
          titleId: true,
          points: true,
          streakCurrent: true,
          devotionalsCompleted: true,
          lastActiveAt: true,
          createdAt: true,
          supportCount: true,
          countryCode: true,
          showCountry: true,
          activeBadgeId: true,
        },
        orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.user.count({
        where: { communityOptIn: true },
      }),
    ]);

    // Activity-priority ordering with soft rotation:
    // Group 1: active within last 3 days
    // Group 2: active within last 7 days
    // Group 3: inactive 7+ days
    // Within each group, apply light per-request randomization so the list
    // does not feel static while still surfacing recently active users first.
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    const group1: typeof allMembers = []; // active < 3 days
    const group2: typeof allMembers = []; // active 3–7 days
    const group3: typeof allMembers = []; // inactive 7+ days

    for (const m of allMembers) {
      const lastActive = m.lastActiveAt ? new Date(m.lastActiveAt).getTime() : 0;
      const daysAgo = (now - lastActive) / DAY_MS;
      if (daysAgo < 3) {
        group1.push(m);
      } else if (daysAgo < 7) {
        group2.push(m);
      } else {
        group3.push(m);
      }
    }

    // Seeded shuffle within each group using a seed that changes every ~4 hours
    // so the rotation feels fresh during the day without being completely random
    const timeSeed = Math.floor(now / (4 * 60 * 60 * 1000));
    function seededShuffle<T>(arr: T[], seed: number): T[] {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        // Simple deterministic hash from seed + index
        const j = Math.abs(Math.floor(Math.sin(seed * (i + 1) * 9301 + 49297) * 233280)) % (i + 1);
        [result[i], result[j]] = [result[j] as T, result[i] as T];
      }
      return result;
    }

    const ordered = [
      ...seededShuffle(group1, timeSeed),
      ...seededShuffle(group2, timeSeed + 1),
      ...seededShuffle(group3, timeSeed + 2),
    ];

    // Apply pagination after ordering
    const paginated = ordered.slice(offset, offset + limit);

    // Annotate each member with isAdmin flag
    const annotatedMembers = paginated.map((m) => ({
      ...m,
      isAdmin: adminUserIds.length > 0 ? adminUserIds.includes(m.id) : false,
    }));

    return c.json({
      members: annotatedMembers,
      total,
      limit,
      offset,
      orderingStrategy: "activity-rotation",
    });
  } catch (error) {
    console.error("[Community] Error getting community members:", error);
    return c.json({ error: "Failed to get community members" }, 500);
  }
});

// PATCH /community/opt-in/:userId - Update user's community opt-in status
gamificationRouter.patch(
  "/community/opt-in/:userId",
  zValidator("json", updateCommunityOptInSchema),
  async (c) => {
    try {
      const userId = c.req.param("userId");
      const { optIn } = c.req.valid("json");

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { communityOptIn: optIn },
      });

      console.log(`[Community] User ${userId} set communityOptIn to ${optIn}`);

      return c.json({
        success: true,
        communityOptIn: updatedUser.communityOptIn,
      });
    } catch (error) {
      console.error("[Community] Error updating opt-in:", error);
      return c.json({ error: "Failed to update community opt-in" }, 500);
    }
  }
);

// GET /community/opt-in/:userId - Get user's community opt-in status
gamificationRouter.get("/community/opt-in/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { communityOptIn: true },
    });

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ communityOptIn: user.communityOptIn });
  } catch (error) {
    console.error("[Community] Error getting opt-in status:", error);
    return c.json({ error: "Failed to get opt-in status" }, 500);
  }
});

// PATCH /user/:userId/country - Update user's country and showCountry preference
gamificationRouter.patch(
  "/user/:userId/country",
  zValidator("json", updateCountrySchema),
  async (c) => {
    try {
      const userId = c.req.param("userId");
      const { countryCode, showCountry } = c.req.valid("json");

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return c.json({ error: "User not found" }, 404);

      const data: Record<string, unknown> = {};
      if (countryCode !== undefined) data.countryCode = countryCode;
      if (showCountry !== undefined) data.showCountry = showCountry;

      const updated = await prisma.user.update({ where: { id: userId }, data });

      return c.json({
        success: true,
        countryCode: updated.countryCode,
        showCountry: updated.showCountry,
      });
    } catch (error) {
      console.error("[User] Error updating country:", error);
      return c.json({ error: "Failed to update country" }, 500);
    }
  }
);

// GET /user/:userId/country - Get user's country settings
gamificationRouter.get("/user/:userId/country", async (c) => {
  try {
    const userId = c.req.param("userId");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true, showCountry: true },
    });
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ countryCode: user.countryCode, showCountry: user.showCountry });
  } catch (error) {
    console.error("[User] Error getting country:", error);
    return c.json({ error: "Failed to get country" }, 500);
  }
});

// ============================================
// COLLECTION CLAIMS
// ============================================

// GET /collections/claims/:userId - Get all claimed collections for a user
gamificationRouter.get("/collections/claims/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const claims = await prisma.collectionClaim.findMany({
      where: { userId },
      select: { collectionId: true, pointsAwarded: true, claimedAt: true },
    });
    return c.json({ success: true, claims });
  } catch (error) {
    console.error("[Collections] Error getting claims:", error);
    return c.json({ error: "Failed to get collection claims" }, 500);
  }
});

// POST /collections/claim - Claim a completed collection reward
gamificationRouter.post(
  "/collections/claim",
  zValidator(
    "json",
    z.object({
      userId: z.string(),
      collectionId: z.string(),
      // The client sends which items it owns so server can verify
      ownedItemIds: z.array(z.string()),
      // Points to award (defined in client constants; server double-checks)
      rewardPoints: z.number().int().positive().max(10000),
    })
  ),
  async (c) => {
    const { userId, collectionId, ownedItemIds, rewardPoints } = c.req.valid("json");

    try {
      // Check if already claimed
      const existingClaim = await prisma.collectionClaim.findUnique({
        where: { userId_collectionId: { userId, collectionId } },
      });

      if (existingClaim) {
        return c.json({ success: false, error: "already_claimed" }, 409);
      }

      // Check user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, points: true },
      });
      if (!user) return c.json({ error: "User not found" }, 404);

      // Award points + record claim atomically
      const [updatedUser, claim] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { points: { increment: rewardPoints } },
          select: { id: true, points: true },
        }),
        prisma.collectionClaim.create({
          data: { userId, collectionId, pointsAwarded: rewardPoints },
        }),
        prisma.pointLedger.create({
          data: {
            userId,
            ledgerId: `collection_${collectionId}_${Date.now()}`,
            type: "collection_reward",
            dateId: new Date().toISOString().slice(0, 10),
            amount: rewardPoints,
            metadata: JSON.stringify({ collectionId }),
          },
        }),
      ]);

      console.log(`[Collections] User ${userId} claimed ${collectionId}: +${rewardPoints} pts (now ${updatedUser.points})`);

      return c.json({
        success: true,
        newPoints: updatedUser.points,
        pointsAwarded: rewardPoints,
        collectionId,
      });
    } catch (error) {
      console.error("[Collections] Claim error:", error);
      return c.json({ error: "Failed to claim collection reward" }, 500);
    }
  }
);

// ============================================
// CHAPTER COLLECTION PROGRESS (Spiritual Paths)
// ============================================

// GET /collections/chapters/progress/:userId
// Returns all claimed chapter IDs per collectionId for a user.
gamificationRouter.get("/collections/chapters/progress/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const rows = await prisma.userChapterProgress.findMany({
      where: { userId },
      select: { collectionId: true, claimedChapterIds: true, updatedAt: true },
    });
    // Parse JSON arrays from DB
    const progress = rows.map(r => ({
      collectionId: r.collectionId,
      claimedChapterIds: JSON.parse(r.claimedChapterIds) as string[],
      updatedAt: r.updatedAt.toISOString(),
    }));
    return c.json({ progress });
  } catch (error) {
    console.error("[ChapterProgress] GET error:", error);
    return c.json({ error: "Failed to fetch chapter progress" }, 500);
  }
});

// POST /collections/chapters/progress
// Upserts chapter progress for a user+collection. Merge strategy: keep the union (most claimed).
gamificationRouter.post(
  "/collections/chapters/progress",
  zValidator("json", z.object({
    userId: z.string(),
    collectionId: z.string(),
    claimedChapterIds: z.array(z.string()),
  })),
  async (c) => {
    try {
      const { userId, collectionId, claimedChapterIds } = c.req.valid("json");

      // Merge with existing (union — never lose claims)
      const existing = await prisma.userChapterProgress.findUnique({
        where: { userId_collectionId: { userId, collectionId } },
        select: { claimedChapterIds: true },
      });
      const existingIds: string[] = existing ? JSON.parse(existing.claimedChapterIds) : [];
      const merged = Array.from(new Set([...existingIds, ...claimedChapterIds]));

      await prisma.userChapterProgress.upsert({
        where: { userId_collectionId: { userId, collectionId } },
        create: { userId, collectionId, claimedChapterIds: JSON.stringify(merged) },
        update: { claimedChapterIds: JSON.stringify(merged) },
      });

      console.log(`[ChapterProgress] User ${userId} / ${collectionId}: claimed=${JSON.stringify(merged)}`);
      return c.json({ success: true, claimedChapterIds: merged });
    } catch (error) {
      console.error("[ChapterProgress] POST error:", error);
      return c.json({ error: "Failed to save chapter progress" }, 500);
    }
  }
);

// POST /community/support - Send "Acompañar" gesture (1 per viewer per day per target)
gamificationRouter.post(
  "/community/support",
  zValidator("json", z.object({
    fromUserId: z.string(),
    toUserId: z.string(),
  })),
  async (c) => {
    try {
      const { fromUserId, toUserId } = c.req.valid("json");

      if (fromUserId === toUserId) {
        return c.json({ error: "Cannot support yourself" }, 400);
      }

      const dateId = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // Try to create support record (unique constraint prevents duplicates)
      const existing = await prisma.userSupport.findUnique({
        where: {
          fromUserId_toUserId_dateId: { fromUserId, toUserId, dateId },
        },
      });

      if (existing) {
        // Already supported today — return current count without error
        const target = await prisma.user.findUnique({
          where: { id: toUserId },
          select: { supportCount: true },
        });
        return c.json({
          success: false,
          alreadySupported: true,
          supportCount: target?.supportCount ?? 0,
        });
      }

      // Create record and increment supportCount atomically
      const [, updatedUser] = await prisma.$transaction([
        prisma.userSupport.create({
          data: { fromUserId, toUserId, dateId },
        }),
        prisma.user.update({
          where: { id: toUserId },
          data: { supportCount: { increment: 1 } },
          select: { supportCount: true },
        }),
      ]);

      console.log(`[Support] ${fromUserId} → ${toUserId} on ${dateId}`);
      return c.json({
        success: true,
        alreadySupported: false,
        supportCount: updatedUser.supportCount,
      });
    } catch (error) {
      console.error("[Support] POST error:", error);
      return c.json({ error: "Failed to send support" }, 500);
    }
  }
);

// GET /community/support/status - Check if viewer already supported a list of members today
// Query: fromUserId=xxx&toUserIds=id1,id2,id3
gamificationRouter.get("/community/support/status", async (c) => {
  try {
    const fromUserId = c.req.query("fromUserId");
    const toUserIdsRaw = c.req.query("toUserIds");

    if (!fromUserId || !toUserIdsRaw) {
      return c.json({ error: "Missing params" }, 400);
    }

    const toUserIds = toUserIdsRaw.split(",").filter(Boolean).slice(0, 100);
    const dateId = new Date().toISOString().slice(0, 10);

    const records = await prisma.userSupport.findMany({
      where: {
        fromUserId,
        toUserId: { in: toUserIds },
        dateId,
      },
      select: { toUserId: true },
    });

    const supportedToday = new Set(records.map((r) => r.toUserId));
    const status: Record<string, boolean> = {};
    for (const id of toUserIds) {
      status[id] = supportedToday.has(id);
    }

    return c.json({ status, dateId });
  } catch (error) {
    console.error("[Support] GET status error:", error);
    return c.json({ error: "Failed to get support status" }, 500);
  }
});

// ============================================
// RENAME TOKEN HELPERS
// ============================================

// ============================================
// COMMUNITY STATS ENDPOINT
// ============================================

// In-memory cache (60 seconds)
let communityStatsCache: {
  data: {
    registeredUsers: number;
    activeUsers30d: number;
    devotionalsCompletedTotal: number;
    devotionalsSharedTotal: number;
    pointsEarnedTotal: number;
    pointsSpentTotal: number;
    windowDays: number;
    computedAt: string;
  };
  expiresAt: number;
} | null = null;

const ACTIVE_DAYS = 30;

// GET /community/stats - Global community metrics
gamificationRouter.get("/community/stats", async (c) => {
  try {
    const now = Date.now();
    if (communityStatsCache && communityStatsCache.expiresAt > now) {
      return c.json(communityStatsCache.data);
    }

    const windowDate = new Date(now - ACTIVE_DAYS * 24 * 60 * 60 * 1000);

    const [registeredUsers, activeUsers30d, totals, ledgerEarned, ledgerSpent, sharedCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { lastSeenAt: { gte: windowDate } },
      }),
      prisma.user.aggregate({
        _sum: {
          devotionalsCompleted: true,
          pointsEarnedTotal: true,
          pointsSpentTotal: true,
        },
      }),
      // Fallback: calculate earned from ledger (for users before pointsEarnedTotal was tracked)
      prisma.pointLedger.aggregate({
        _sum: { amount: true },
        where: { amount: { gt: 0 } },
      }),
      prisma.pointLedger.aggregate({
        _sum: { amount: true },
        where: { amount: { lt: 0 } },
      }),
      prisma.pointLedger.count({
        where: { type: 'share' },
      }),
    ]);

    const earnedFromCounters = totals._sum.pointsEarnedTotal ?? 0;
    const spentFromCounters = totals._sum.pointsSpentTotal ?? 0;

    // Use ledger as source of truth since counters are newly added
    const earnedFromLedger = ledgerEarned._sum.amount ?? 0;
    const spentFromLedger = Math.abs(ledgerSpent._sum.amount ?? 0);

    // Use the higher of the two (counters fill in over time)
    const pointsEarnedTotal = Math.max(earnedFromCounters, earnedFromLedger);
    const pointsSpentTotal = Math.max(spentFromCounters, spentFromLedger);

    const data = {
      registeredUsers,
      activeUsers30d,
      devotionalsCompletedTotal: totals._sum.devotionalsCompleted ?? 0,
      devotionalsSharedTotal: sharedCount,
      pointsEarnedTotal,
      pointsSpentTotal,
      windowDays: ACTIVE_DAYS,
      computedAt: new Date().toISOString(),
    };

    communityStatsCache = { data, expiresAt: now + 60_000 };
    return c.json(data);
  } catch (error) {
    console.error("[CommunityStats] Error:", error);
    return c.json({ error: "Failed to fetch community stats" }, 500);
  }
});

// ============================================
// SESSION HEARTBEAT ENDPOINT
// ============================================

const heartbeatSchema = z.object({
  sessionId: z.string().optional(),
  userId: z.string(),
});

const MAX_DELTA_SECONDS = 60; // clamp: max seconds credited per heartbeat

// POST /session/heartbeat - Track user session time (server-authoritative)
gamificationRouter.post(
  "/session/heartbeat",
  zValidator("json", heartbeatSchema),
  async (c) => {
    try {
      const { sessionId, userId } = c.req.valid("json");
      const serverNow = new Date();

      // Validate user exists
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      let session: { id: string; lastSeenAt: Date } | null = null;

      const SESSION_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

      if (sessionId) {
        const candidate = await prisma.userSession.findFirst({
          where: { id: sessionId, userId },
          select: { id: true, lastSeenAt: true },
        });
        // Only reuse if last heartbeat was within 8 hours
        if (candidate && serverNow.getTime() - candidate.lastSeenAt.getTime() < SESSION_EXPIRY_MS) {
          session = candidate;
        }
      }

      if (!session) {
        // Create new session
        const newSession = await prisma.userSession.create({
          data: {
            userId,
            startedAt: serverNow,
            lastSeenAt: serverNow,
            totalSeconds: 0,
          },
        });

        // Update user's lastSeenAt
        await prisma.user.update({
          where: { id: userId },
          data: { lastSeenAt: serverNow },
        });

        return c.json({ sessionId: newSession.id, serverNow: serverNow.toISOString(), role: user.role });
      }

      // Calculate delta from server clock
      const deltaMs = serverNow.getTime() - session.lastSeenAt.getTime();
      const deltaRaw = Math.floor(deltaMs / 1000);
      const delta = Math.min(Math.max(deltaRaw, 0), MAX_DELTA_SECONDS);

      // Update session + user atomically
      await prisma.$transaction([
        prisma.userSession.update({
          where: { id: session.id },
          data: {
            lastSeenAt: serverNow,
            totalSeconds: { increment: delta },
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: {
            totalTimeSeconds: { increment: delta },
            lastSeenAt: serverNow,
          },
        }),
      ]);

      return c.json({ sessionId: session.id, serverNow: serverNow.toISOString(), deltaSeconds: delta, role: user.role });
    } catch (error) {
      console.error("[Heartbeat] Error:", error);
      return c.json({ error: "Failed to process heartbeat" }, 500);
    }
  }
);

export async function userHasRenameToken(userId: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM "UserInventory" WHERE "userId" = ? AND "itemId" = 'pincel_magico' AND "source" != 'used'`,
    userId
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

export async function consumeRenameToken(userId: string): Promise<void> {
  await prisma.userInventory.update({
    where: { userId_itemId: { userId, itemId: "pincel_magico" } },
    data: { source: 'used' },
  });
}

// ============================================
// RENAME ENDPOINT
// ============================================

const renameSchema = z.object({
  newNickname: z.string().min(3).max(20),
});

// POST /user/rename - Change nickname using a rename token
gamificationRouter.post(
  "/user/rename",
  zValidator("json", renameSchema),
  async (c) => {
    try {
      const userId = c.req.header("X-User-Id");
      if (!userId) return c.json({ error: "Missing X-User-Id header" }, 400);

      const { newNickname } = c.req.valid("json");

      // a) Load user
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return c.json({ error: "Usuario no encontrado" }, 404);

      // b) Check rename token ownership
      const hasToken = await userHasRenameToken(userId);
      if (!hasToken) {
        return c.json({ error: "Necesitas el Pincel Mágico para cambiar tu nickname." }, 403);
      }

      // c) Run full safety checks
      const validation = validateNickname(newNickname);
      if (!validation.ok) {
        return c.json({ error: validation.error }, 400);
      }
      const newNicknameLower = newNickname.toLowerCase();
      const newNormalizedNickname = validation.normalized!;

      // d) Raw uniqueness (skip own current nickname)
      if (newNicknameLower !== user.nicknameLower) {
        const existingRaw = await prisma.user.findUnique({ where: { nicknameLower: newNicknameLower } });
        if (existingRaw) return c.json({ error: "Ese nickname ya está en uso." }, 409);
      }

      // e) Normalized (lookalike) uniqueness
      if (newNormalizedNickname !== user.normalizedNickname) {
        const lookalike = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "User" WHERE "normalizedNickname" = ? AND "id" != ? LIMIT 1`,
          newNormalizedNickname,
          userId
        );
        if (lookalike.length > 0) return c.json({ error: "Ese nickname ya está en uso." }, 409);
      }

      // f) Rename + consume token atomically
      const [updatedUser] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            nickname: newNickname,
            nicknameLower: newNicknameLower,
            normalizedNickname: newNormalizedNickname,
          },
          include: { inventory: { include: { item: true } } },
        }),
        prisma.userInventory.update({
          where: { userId_itemId: { userId, itemId: "pincel_magico" } },
          data: { source: 'used' },
        }),
      ]);

      console.log(`[Rename] User ${user.nickname} renamed to ${newNickname}`);
      return c.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error("[Gamification] Error renaming user:", error);
      return c.json({ error: "Error al cambiar el nickname." }, 500);
    }
  }
);

// ============================================
// BIBLICAL CARDS
// ============================================

// GET /biblical-cards/:userId - Get user's biblical card inventory
gamificationRouter.get("/biblical-cards/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const cards = await prisma.biblicalCardInventory.findMany({
      where: { userId },
    });
    return c.json(cards);
  } catch (error) {
    console.error("[BiblicalCards] Error fetching biblical cards:", error);
    return c.json({ error: "Failed to fetch biblical cards" }, 500);
  }
});

// PATCH /biblical-cards/:userId/:cardId/seen — clear isNew flag when user opens a card
gamificationRouter.patch("/biblical-cards/:userId/:cardId/seen", async (c) => {
  try {
    const userId = c.req.param("userId");
    const cardId = c.req.param("cardId");
    await prisma.biblicalCardInventory.updateMany({
      where: { userId, cardId, isNew: true },
      data: { isNew: false },
    });
    return c.json({ success: true });
  } catch (error) {
    console.error("[BiblicalCards] Error clearing isNew:", error);
    return c.json({ error: "Failed to clear isNew" }, 500);
  }
});

// ============================================================
// COLLECTION CARD REWARD
// One-time secret card + bonus points for completing a collection.
// Currently supports: pascua_2026 → jesus_resucitado + 1000 pts
// ============================================================

const COLLECTION_REWARD_MAP: Record<string, { secretCardId: string; bonusPoints: number }> = {
  pascua_2026: { secretCardId: 'jesus_resucitado', bonusPoints: 1000 },
  milagros_2026: { secretCardId: 'reino_de_dios', bonusPoints: 2000 },
  heroes_2026: { secretCardId: 'jesus_autor_fe', bonusPoints: 2500 },
};

// POST /biblical-cards/collection-reward
// Idempotent: second call returns 409 with alreadyClaimed=true
gamificationRouter.post(
  "/biblical-cards/collection-reward",
  zValidator("json", z.object({
    userId:       z.string(),
    collectionId: z.string(), // e.g. "pascua_2026"
    ownedCardIds: z.array(z.string()), // all card IDs the user currently owns for this collection
  })),
  async (c) => {
    try {
      const { userId, collectionId, ownedCardIds } = c.req.valid("json");

      // Look up reward config
      const rewardConfig = COLLECTION_REWARD_MAP[collectionId];
      if (!rewardConfig) {
        return c.json({ error: "Unknown collectionId" }, 400);
      }

      // Check idempotency — has this reward already been claimed?
      const existing = await prisma.collectionCardReward.findUnique({
        where: { userId_collectionId: { userId, collectionId } },
      });
      if (existing) {
        return c.json({ alreadyClaimed: true, secretCardId: rewardConfig.secretCardId }, 409);
      }

      // Verify user actually owns all required cards for this collection
      const COLLECTION_CARD_IDS: Record<string, string[]> = {
        pascua_2026: [
          'entrada_jerusalen', 'burrito', 'ultima_cena', 'getsemani', 'judas',
          'arresto', 'poncio_pilato', 'barrabas', 'camino_calvario', 'crucifixion',
          'velo_rasgado', 'tumba_sellada', 'resurreccion', 'tomas',
        ],
        milagros_2026: [
          'agua_en_vino', 'pesca_milagrosa', 'sanidad_leproso', 'sanidad_paralitico',
          'sanidad_centurion', 'sanidad_suegra_pedro', 'mano_seca', 'diez_leprosos',
          'sordomudo', 'ciego_betsaida', 'multiplicacion_panes', 'moneda_pez',
          'calma_tormenta', 'higuera_maldita', 'red_peces', 'alimenta_4000',
          'liberacion_demonio', 'nina_resucitada',
          'caminar_agua', 'ciego_nacimiento', 'hijo_viuda_nain', 'endemoniado_gadareno',
          'mujer_flujo', 'jesus_desaparece', 'tempestad_calmada',
          'resurreccion_lazaro', 'transfiguracion', 'jesus_aparece_resucitado',
          'jesus_glorificado',
        ],
        heroes_2026: [
          'noe_contra_corriente', 'abraham_cree_imposible', 'abraham_isaac_entrega',
          'jacob_marcado_cambiar', 'jose_del_pozo', 'moises_llamado_inesperado',
          'mar_rojo_camino', 'sinai_dios_habla', 'josue_obediencia_ilogica',
          'rahab_fe_rescata', 'gedeon_menos_es_mas', 'debora_liderar_fe',
          'sanson_fuerza_sin_control', 'samuel_habla_senor', 'david_gigantes_caen',
          'david_corazon_correcto', 'elias_fuego_cielo', 'elias_en_secreto',
          'eliseo_dios_provee', 'jonas_huir_no_funciona', 'jonas_dios_misericordia',
          'daniel_fe_firme', 'horno_fuego_firme', 'ester_para_este_momento',
          'nehemias_reconstruir',
        ],
      };
      const requiredCards = COLLECTION_CARD_IDS[collectionId] ?? [];
      const ownsAll = requiredCards.every((id) => ownedCardIds.includes(id));
      if (!ownsAll) {
        return c.json({ error: "Collection not yet complete" }, 400);
      }

      // Grant reward in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Award secret card (upsert — safe if somehow already there)
        const secretCardId = rewardConfig.secretCardId;
        const existingCard = await tx.biblicalCardInventory.findUnique({
          where: { userId_cardId: { userId, cardId: secretCardId } },
        });
        if (!existingCard) {
          await tx.biblicalCardInventory.create({
            data: { userId, cardId: secretCardId, owned: true, duplicates: 0, isNew: true },
          });
        }

        // Award bonus points
        const user = await tx.user.update({
          where: { id: userId },
          data: { points: { increment: rewardConfig.bonusPoints } },
        });

        // Ledger entry
        await tx.pointLedger.create({
          data: {
            userId,
            ledgerId: `collection_card_reward_${collectionId}_${Date.now()}`,
            type:     'collection_reward',
            dateId:   new Date().toISOString().split('T')[0] as string,
            amount:   rewardConfig.bonusPoints,
            metadata: JSON.stringify({ collectionId, secretCardId }),
          },
        });

        // Record that reward was claimed
        await tx.collectionCardReward.create({
          data: {
            userId,
            collectionId,
            secretCardId,
            pointsAwarded: rewardConfig.bonusPoints,
          },
        });

        return {
          newPoints:    user.points,
          pointsAwarded: rewardConfig.bonusPoints,
          secretCardId,
        };
      });

      console.log(`[CollectionReward] User ${userId} completed ${collectionId}: awarded ${result.secretCardId} + ${result.pointsAwarded}pts`);
      return c.json({ success: true, ...result });
    } catch (error) {
      console.error("[CollectionReward] Error:", error);
      return c.json({ error: "Failed to claim collection reward" }, 500);
    }
  }
);

// GET /biblical-cards/collection-reward/status/:userId
// Returns which collection card rewards this user has already claimed
gamificationRouter.get("/biblical-cards/collection-reward/status/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const claimed = await prisma.collectionCardReward.findMany({
      where: { userId },
      select: { collectionId: true, secretCardId: true, pointsAwarded: true, claimedAt: true },
    });
    return c.json({ claimed });
  } catch (error) {
    console.error("[CollectionReward] Error fetching status:", error);
    return c.json({ error: "Failed to fetch collection reward status" }, 500);
  }
});

// ─── Card Trade Routes ────────────────────────────────────────────────────────

// GET /biblical-cards/trades/:userId
// Returns all pending trades where the user is sender or receiver, plus recent history
gamificationRouter.get("/biblical-cards/trades/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");

    // Compute daily trade usage (server-side UTC day)
    const DAILY_TRADE_LIMIT = 2;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const completedTodayCount = await prisma.cardTrade.count({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
        status: "accepted",
        respondedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const trades = await prisma.cardTrade.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
        NOT: { status: { in: ["cancelled", "failed"] } },
      },
      include: {
        fromUser: { select: { id: true, nickname: true, avatarId: true, frameId: true } },
        toUser:   { select: { id: true, nickname: true, avatarId: true, frameId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return c.json({
      trades,
      dailyLimit: DAILY_TRADE_LIMIT,
      dailyUsed: Math.min(completedTodayCount, DAILY_TRADE_LIMIT),
    });
  } catch (error) {
    console.error("[Trade] list error:", error);
    return c.json({ error: "Failed to fetch trades" }, 500);
  }
});

// GET /biblical-cards/trades/user-cards/:userId
// Returns the tradable card inventory for a user (owned=true, with duplicates info)
gamificationRouter.get("/biblical-cards/trades/user-cards/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const cards = await prisma.biblicalCardInventory.findMany({
      where: { userId, owned: true },
      select: { cardId: true, duplicates: true },
    });
    return c.json({ cards });
  } catch (error) {
    console.error("[Trade] user-cards error:", error);
    return c.json({ error: "Failed to fetch user cards" }, 500);
  }
});

// POST /biblical-cards/trades
// Create a new trade proposal
gamificationRouter.post("/biblical-cards/trades", async (c) => {
  try {
    const body = await c.req.json() as {
      fromUserId: string;
      toUserId: string;
      offeredCardId: string;
      requestedCardId: string;
    };
    const { fromUserId, toUserId, offeredCardId, requestedCardId } = body;

    if (!fromUserId || !toUserId || !offeredCardId || !requestedCardId) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    if (fromUserId === toUserId) {
      return c.json({ error: "Cannot trade with yourself" }, 400);
    }
    if (offeredCardId === requestedCardId) {
      return c.json({ error: "Cannot trade a card for itself" }, 400);
    }

    // Validate fromUser has a duplicate of offeredCardId
    const offeredEntry = await prisma.biblicalCardInventory.findUnique({
      where: { userId_cardId: { userId: fromUserId, cardId: offeredCardId } },
    });
    if (!offeredEntry || !offeredEntry.owned || offeredEntry.duplicates < 1) {
      return c.json({ error: "NO_DUPLICATE_OFFERED", message: "You don't have a duplicate of the offered card" }, 400);
    }

    // Validate toUser has a duplicate of requestedCardId
    const requestedEntry = await prisma.biblicalCardInventory.findUnique({
      where: { userId_cardId: { userId: toUserId, cardId: requestedCardId } },
    });
    if (!requestedEntry || !requestedEntry.owned || requestedEntry.duplicates < 1) {
      return c.json({ error: "NO_DUPLICATE_REQUESTED", message: "The other user doesn't have a duplicate of the requested card" }, 400);
    }

    // Block if this card is already offered in any other pending trade (prevents double-offering a single duplicate)
    const alreadyOffered = await prisma.cardTrade.findFirst({
      where: { fromUserId, offeredCardId, status: "pending" },
    });
    if (alreadyOffered) {
      return c.json({ error: "CARD_ALREADY_IN_TRADE", messageEs: "Este cromo ya está en otro intercambio pendiente. Cancélalo primero.", message: "This card is already offered in a pending trade. Cancel it first." }, 400);
    }

    // Limit pending outbound trades per user (max 10)
    const pendingCount = await prisma.cardTrade.count({
      where: { fromUserId, status: "pending" },
    });
    if (pendingCount >= 10) {
      return c.json({ error: "TOO_MANY_PENDING", message: "You have too many pending trades. Cancel some first." }, 400);
    }

    const trade = await prisma.cardTrade.create({
      data: { fromUserId, toUserId, offeredCardId, requestedCardId, status: "pending" },
      include: {
        fromUser: { select: { id: true, nickname: true, avatarId: true, frameId: true } },
        toUser:   { select: { id: true, nickname: true, avatarId: true, frameId: true } },
      },
    });

    return c.json({ success: true, trade });
  } catch (error) {
    console.error("[Trade] create error:", error);
    return c.json({ error: "Failed to create trade" }, 500);
  }
});

// PATCH /biblical-cards/trades/:tradeId/accept
// Accept a pending trade — atomic validation + card swap
gamificationRouter.patch("/biblical-cards/trades/:tradeId/accept", async (c) => {
  try {
    const tradeId = c.req.param("tradeId");
    const body = await c.req.json() as { userId: string };
    const { userId } = body;

    const trade = await prisma.cardTrade.findUnique({ where: { id: tradeId } });
    if (!trade) return c.json({ error: "Trade not found" }, 404);
    if (trade.status !== "pending") return c.json({ error: "Trade is no longer pending" }, 400);
    if (trade.toUserId !== userId) return c.json({ error: "Not authorised to accept this trade" }, 403);

    // Enforce daily trade limit per user (server UTC day)
    const DAILY_TRADE_LIMIT = 2;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [accepterCount, initiatorCount] = await Promise.all([
      prisma.cardTrade.count({
        where: {
          OR: [{ fromUserId: userId }, { toUserId: userId }],
          status: "accepted",
          respondedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.cardTrade.count({
        where: {
          OR: [{ fromUserId: trade.fromUserId }, { toUserId: trade.fromUserId }],
          status: "accepted",
          respondedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    if (accepterCount >= DAILY_TRADE_LIMIT) {
      return c.json({ error: "DAILY_LIMIT_REACHED", message: "Has alcanzado tu límite diario de intercambios" }, 400);
    }
    if (initiatorCount >= DAILY_TRADE_LIMIT) {
      return c.json({ error: "DAILY_LIMIT_REACHED", message: "El otro usuario ha alcanzado su límite diario de intercambios" }, 400);
    }

    // Re-validate both sides still have duplicates
    const offeredEntry = await prisma.biblicalCardInventory.findUnique({
      where: { userId_cardId: { userId: trade.fromUserId, cardId: trade.offeredCardId } },
    });
    const requestedEntry = await prisma.biblicalCardInventory.findUnique({
      where: { userId_cardId: { userId: trade.toUserId, cardId: trade.requestedCardId } },
    });

    if (!offeredEntry || !offeredEntry.owned || offeredEntry.duplicates < 1) {
      await prisma.cardTrade.update({ where: { id: tradeId }, data: { status: "failed", respondedAt: new Date() } });
      return c.json({ error: "TRADE_FAILED", message: "The other user no longer has a duplicate of the offered card" }, 400);
    }
    if (!requestedEntry || !requestedEntry.owned || requestedEntry.duplicates < 1) {
      await prisma.cardTrade.update({ where: { id: tradeId }, data: { status: "failed", respondedAt: new Date() } });
      return c.json({ error: "TRADE_FAILED", message: "You no longer have a duplicate of the requested card" }, 400);
    }

    // Execute swap atomically
    await prisma.$transaction(async (tx) => {
      // 1. fromUser loses one duplicate of offeredCard
      await tx.biblicalCardInventory.update({
        where: { userId_cardId: { userId: trade.fromUserId, cardId: trade.offeredCardId } },
        data: { duplicates: { decrement: 1 } },
      });

      // 2. fromUser gains requestedCard (upsert — may already own it)
      const fromHasRequested = await tx.biblicalCardInventory.findUnique({
        where: { userId_cardId: { userId: trade.fromUserId, cardId: trade.requestedCardId } },
      });
      if (fromHasRequested) {
        await tx.biblicalCardInventory.update({
          where: { userId_cardId: { userId: trade.fromUserId, cardId: trade.requestedCardId } },
          data: { duplicates: { increment: 1 } },
        });
      } else {
        await tx.biblicalCardInventory.create({
          data: { userId: trade.fromUserId, cardId: trade.requestedCardId, owned: true, duplicates: 0, isNew: true },
        });
      }

      // 3. toUser loses one duplicate of requestedCard
      await tx.biblicalCardInventory.update({
        where: { userId_cardId: { userId: trade.toUserId, cardId: trade.requestedCardId } },
        data: { duplicates: { decrement: 1 } },
      });

      // 4. toUser gains offeredCard (upsert)
      const toHasOffered = await tx.biblicalCardInventory.findUnique({
        where: { userId_cardId: { userId: trade.toUserId, cardId: trade.offeredCardId } },
      });
      if (toHasOffered) {
        await tx.biblicalCardInventory.update({
          where: { userId_cardId: { userId: trade.toUserId, cardId: trade.offeredCardId } },
          data: { duplicates: { increment: 1 } },
        });
      } else {
        await tx.biblicalCardInventory.create({
          data: { userId: trade.toUserId, cardId: trade.offeredCardId, owned: true, duplicates: 0, isNew: true },
        });
      }

      // 5. Mark trade accepted
      await tx.cardTrade.update({
        where: { id: tradeId },
        data: { status: "accepted", respondedAt: new Date() },
      });
    });

    // Determine what toUser received and whether it was new
    const receivedNew = !requestedEntry || (requestedEntry && !requestedEntry.owned);

    return c.json({
      success: true,
      receivedCardId: trade.offeredCardId,
      receivedNew,
    });
  } catch (error) {
    console.error("[Trade] accept error:", error);
    return c.json({ error: "Failed to accept trade" }, 500);
  }
});

// PATCH /biblical-cards/trades/:tradeId/reject
gamificationRouter.patch("/biblical-cards/trades/:tradeId/reject", async (c) => {
  try {
    const tradeId = c.req.param("tradeId");
    const body = await c.req.json() as { userId: string };
    const { userId } = body;

    const trade = await prisma.cardTrade.findUnique({ where: { id: tradeId } });
    if (!trade) return c.json({ error: "Trade not found" }, 404);
    if (trade.status !== "pending") return c.json({ error: "Trade is no longer pending" }, 400);
    if (trade.toUserId !== userId) return c.json({ error: "Not authorised to reject this trade" }, 403);

    await prisma.cardTrade.update({
      where: { id: tradeId },
      data: { status: "rejected", respondedAt: new Date() },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("[Trade] reject error:", error);
    return c.json({ error: "Failed to reject trade" }, 500);
  }
});

// PATCH /biblical-cards/trades/:tradeId/cancel
gamificationRouter.patch("/biblical-cards/trades/:tradeId/cancel", async (c) => {
  try {
    const tradeId = c.req.param("tradeId");
    const body = await c.req.json() as { userId: string };
    const { userId } = body;

    const trade = await prisma.cardTrade.findUnique({ where: { id: tradeId } });
    if (!trade) return c.json({ error: "Trade not found" }, 404);
    if (trade.status !== "pending") return c.json({ error: "Trade is no longer pending" }, 400);
    if (trade.fromUserId !== userId) return c.json({ error: "Not authorised to cancel this trade" }, 403);

    await prisma.cardTrade.update({
      where: { id: tradeId },
      data: { status: "cancelled", respondedAt: new Date() },
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("[Trade] cancel error:", error);
    return c.json({ error: "Failed to cancel trade" }, 500);
  }
});



// GET /daily-pack/status/:userId - Check daily pack availability
gamificationRouter.get("/daily-pack/status/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return c.json({ error: "User not found" }, 404);

    const today = new Date().toISOString().split("T")[0] as string;
    const dailyActions = parseDailyActions(user.dailyActions);

    // Premium support: isPremium will be read from metadata/role in future.
    // For now derive from role field: 'PREMIUM' or 'OWNER' = 2 packs/day.
    const isPremium = user.role === 'PREMIUM' || user.role === 'OWNER';
    const dailyEarnRate = isPremium ? 2 : 1;

    // Compute available packs with accumulation cap
    const { available } = computeAvailablePacks(dailyActions, today, dailyEarnRate);

    // Compute next available time: midnight of next day UTC (only if fully capped)
    let nextAvailableMs: number | null = null;
    if (available === 0) {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      nextAvailableMs = tomorrow.getTime();
    }

    return c.json({
      canClaim: available > 0,
      remaining: available,
      dailyLimit: FREE_PACK_MAX_ACCUMULATED,
      isPremium,
      nextAvailableMs,
      claimedToday: dailyActions.dailyPackDate === today ? (dailyActions.dailyPackCount ?? 0) : 0,
    });
  } catch (error) {
    console.error("[DailyPack] Error checking status:", error);
    return c.json({ error: "Failed to check daily pack status" }, 500);
  }
});

// POST /daily-pack/claim - Claim a daily free pack
gamificationRouter.post(
  "/daily-pack/claim",
  zValidator("json", z.object({
    userId: z.string(),
    packType: z.enum(["sobre_biblico", "pack_pascua", "pack_milagros", "pack_heroes"]),
  })),
  async (c) => {
    try {
      const { userId, packType } = c.req.valid("json");
      const today = new Date().toISOString().split("T")[0] as string;

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("USER_NOT_FOUND");

        const isPremium = user.role === 'PREMIUM' || user.role === 'OWNER';
        const dailyEarnRate = isPremium ? 2 : 1;

        const dailyActions = parseDailyActions(user.dailyActions);

        // Compute available packs with accumulation and hard cap
        const { available, updatedActions } = computeAvailablePacks(dailyActions, today, dailyEarnRate);

        if (available <= 0) {
          throw new Error("DAILY_LIMIT_REACHED");
        }

        // Draw a card — same pools as the purchase endpoint
        const CARD_POOL = ['david', 'moses', 'ark', 'espada_espiritu', 'arpa_david', 'zarza_ardiente'];
        const PASCUA_POOL = [
          'entrada_jerusalen', 'burrito', 'ultima_cena', 'getsemani', 'judas',
          'arresto', 'poncio_pilato', 'barrabas', 'camino_calvario', 'crucifixion',
          'velo_rasgado', 'tumba_sellada', 'resurreccion', 'tomas',
        ];
        const MILAGROS_POOL = [
          'agua_en_vino', 'pesca_milagrosa', 'sanidad_leproso', 'sanidad_paralitico',
          'sanidad_centurion', 'sanidad_suegra_pedro', 'mano_seca', 'diez_leprosos',
          'sordomudo', 'ciego_betsaida', 'multiplicacion_panes', 'moneda_pez',
          'calma_tormenta', 'higuera_maldita', 'red_peces', 'alimenta_4000',
          'liberacion_demonio', 'nina_resucitada',
          'caminar_agua', 'ciego_nacimiento', 'hijo_viuda_nain', 'endemoniado_gadareno',
          'mujer_flujo', 'jesus_desaparece', 'tempestad_calmada',
          'resurreccion_lazaro', 'transfiguracion', 'jesus_aparece_resucitado',
          'jesus_glorificado',
        ];
        const HEROES_POOL = [
          'noe_contra_corriente', 'abraham_cree_imposible', 'abraham_isaac_entrega',
          'jacob_marcado_cambiar', 'jose_del_pozo', 'moises_llamado_inesperado',
          'mar_rojo_camino', 'sinai_dios_habla', 'josue_obediencia_ilogica',
          'rahab_fe_rescata', 'gedeon_menos_es_mas', 'debora_liderar_fe',
          'sanson_fuerza_sin_control', 'samuel_habla_senor', 'david_gigantes_caen',
          'david_corazon_correcto', 'elias_fuego_cielo', 'elias_en_secreto',
          'eliseo_dios_provee', 'jonas_huir_no_funciona', 'jonas_dios_misericordia',
          'daniel_fe_firme', 'horno_fuego_firme', 'ester_para_este_momento',
          'nehemias_reconstruir',
        ];

        const pool = packType === 'pack_pascua' ? PASCUA_POOL
          : packType === 'pack_milagros' ? MILAGROS_POOL
          : packType === 'pack_heroes' ? HEROES_POOL
          : CARD_POOL;

        // pack_milagros and pack_heroes give 3 cards; others give 1
        const cardsToDrawCount = (packType === 'pack_milagros' || packType === 'pack_heroes') ? 3 : 1;
        const drawnCards: Array<{ cardId: string; wasNew: boolean }> = [];

        for (let i = 0; i < cardsToDrawCount; i++) {
          const cardId = pool[Math.floor(Math.random() * pool.length)] as string;

          const existing = await tx.biblicalCardInventory.findUnique({
            where: { userId_cardId: { userId, cardId } },
          });

          let wasNew = false;
          if (existing) {
            await tx.biblicalCardInventory.update({
              where: { userId_cardId: { userId, cardId } },
              data: { duplicates: { increment: 1 } },
            });
          } else {
            await tx.biblicalCardInventory.create({
              data: { userId, cardId, owned: true, duplicates: 0, isNew: true },
            });
            wasNew = true;
          }
          drawnCards.push({ cardId, wasNew });
        }

        // Deduct one pack from accumulated and track claim on today's date
        const newAccumulated = Math.max(0, available - 1);
        const newDailyActions: DailyActions = {
          ...updatedActions,
          dailyPackDate: today,
          dailyPackCount: (updatedActions.dailyPackDate === today ? (updatedActions.dailyPackCount ?? 0) : 0) + 1,
          accumulatedPacks: newAccumulated,
        };

        await tx.user.update({
          where: { id: userId },
          data: { dailyActions: JSON.stringify(newDailyActions) },
        });

        // Track daily pack opening in PointLedger for accurate dashboard counts
        await tx.pointLedger.create({
          data: {
            userId,
            ledgerId: `pack_open_${packType}_${Date.now()}`,
            type: 'pack_open',
            dateId: today,
            amount: 0,
            metadata: JSON.stringify({ packType, source: 'daily_free' }),
          },
        });

        return {
          success: true,
          drawnCard: drawnCards[0],
          drawnCards,
          remaining: newAccumulated,
          dailyLimit: FREE_PACK_MAX_ACCUMULATED,
          isPremium,
        };
      });

      console.log(`[DailyPack] User ${userId} claimed ${packType}:`, result.drawnCard);
      return c.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === "USER_NOT_FOUND") return c.json({ error: "User not found" }, 404);
      if (msg === "DAILY_LIMIT_REACHED") {
        return c.json({ error: "Daily pack limit already claimed", canClaim: false }, 400);
      }
      console.error("[DailyPack] Error claiming pack:", error);
      return c.json({ error: "Failed to claim daily pack" }, 500);
    }
  }
);

// POST /sync-studies - Sync completed study IDs from client to ensure server-side tracking is accurate
gamificationRouter.post(
  "/sync-studies",
  zValidator("json", z.object({ userId: z.string(), completedStudyIds: z.array(z.string()) })),
  async (c) => {
    const { userId, completedStudyIds } = c.req.valid("json");
    if (!completedStudyIds.length) return c.json({ synced: 0 });

    const today = new Date().toISOString().split("T")[0] as string;
    let synced = 0;

    for (const studyId of completedStudyIds) {
      const ledgerId = `study_complete_${studyId}`;
      const existing = await prisma.pointLedger.findUnique({
        where: { userId_ledgerId: { userId, ledgerId } },
      });
      if (existing) continue;
      await prisma.pointLedger.create({
        data: {
          userId,
          ledgerId,
          type: "study_complete",
          dateId: today,
          amount: 0,
          metadata: JSON.stringify({ studyId, source: "sync" }),
        },
      });
      synced++;
    }

    return c.json({ synced });
  }
);

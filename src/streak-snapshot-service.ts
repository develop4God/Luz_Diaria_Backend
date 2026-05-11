import { prisma } from "./prisma";

/** Returns YYYY-MM-DD in Costa Rica time (UTC-6) */
export function getCRDateString(daysAgo = 0): string {
  const d = new Date();
  // Costa Rica is UTC-6 (no DST)
  d.setUTCMinutes(d.getUTCMinutes() - 6 * 60 - daysAgo * 24 * 60);
  return d.toISOString().split("T")[0]!;
}

/** Returns YYYY-MM-DD in UTC */
function getDateStringUTC(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().split("T")[0]!;
}

/**
 * Generate snapshots for ALL users for a given date.
 * Idempotent: upserts by (snapshotDate, userId).
 */
export async function generateStreakSnapshots(snapshotDate: string): Promise<{
  processed: number;
  created: number;
  errors: number;
}> {
  console.log(`[StreakSnapshot] Generating snapshots for ${snapshotDate}...`);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      streakCurrent: true,
      dailyActions: true,
      devotionalsCompleted: true,
    },
  });

  let processed = 0;
  let created = 0;
  let errors = 0;

  for (const user of users) {
    let lastDevotionalDateCompleted: string | null = null;
    try {
      const actions = JSON.parse(user.dailyActions || "{}") as Record<string, unknown>;
      if (typeof actions.devotionalDate === "string") {
        lastDevotionalDateCompleted = actions.devotionalDate;
      } else if (Array.isArray(actions.devotionalDates) && actions.devotionalDates.length > 0) {
        const sorted = [...actions.devotionalDates].sort().reverse();
        lastDevotionalDateCompleted = sorted[0] as string;
      }
    } catch {
      // ignore parse error
    }

    try {
      await prisma.streakSnapshot.upsert({
        where: {
          snapshotDate_userId: { snapshotDate, userId: user.id },
        },
        create: {
          snapshotDate,
          userId: user.id,
          streak: user.streakCurrent,
          lastDevotionalDateCompleted,
          totalDevotionalsCompleted: user.devotionalsCompleted,
        },
        update: {
          streak: user.streakCurrent,
          lastDevotionalDateCompleted,
          totalDevotionalsCompleted: user.devotionalsCompleted,
        },
      });
      created++;
    } catch (err) {
      errors++;
      console.error(`[StreakSnapshot] Error for user ${user.id}:`, err);
    }
    processed++;
  }

  // Cleanup: keep only last 7 days of snapshots (more generous window for ticket lookups)
  const cutoff = getDateStringUTC(7);
  const deleted = await prisma.streakSnapshot.deleteMany({
    where: {
      snapshotDate: { lt: cutoff },
    },
  });

  console.log(
    `[StreakSnapshot] Done for ${snapshotDate}: processed=${processed}, created/updated=${created}, errors=${errors}, cleaned=${deleted.count}`
  );
  return { processed, created, errors };
}

/**
 * Get the best available snapshot for a user at or before a given reference date.
 * Searches today → yesterday → day-before → up to 7 days back.
 * This is the primary lookup used when creating and resolving support tickets.
 */
export async function getBestSnapshotForUser(
  userId: string,
  referenceDate?: string // YYYY-MM-DD, defaults to CR today
): Promise<{
  id: string;
  snapshotDate: string;
  streak: number;
  lastDevotionalDateCompleted: string | null;
  totalDevotionalsCompleted: number;
} | null> {
  // Find the most recent snapshot <= referenceDate
  const where = referenceDate
    ? { userId, snapshotDate: { lte: referenceDate } }
    : { userId };

  const snap = await prisma.streakSnapshot.findFirst({
    where,
    orderBy: { snapshotDate: "desc" },
  });

  if (!snap) return null;
  return {
    id: snap.id,
    snapshotDate: snap.snapshotDate,
    streak: snap.streak,
    lastDevotionalDateCompleted: snap.lastDevotionalDateCompleted,
    totalDevotionalsCompleted: snap.totalDevotionalsCompleted,
  };
}

/**
 * Get snapshot by ID (for stable references stored on tickets).
 */
export async function getSnapshotById(id: string): Promise<{
  id: string;
  snapshotDate: string;
  streak: number;
  lastDevotionalDateCompleted: string | null;
  totalDevotionalsCompleted: number;
} | null> {
  const snap = await prisma.streakSnapshot.findUnique({ where: { id } });
  if (!snap) return null;
  return {
    id: snap.id,
    snapshotDate: snap.snapshotDate,
    streak: snap.streak,
    lastDevotionalDateCompleted: snap.lastDevotionalDateCompleted,
    totalDevotionalsCompleted: snap.totalDevotionalsCompleted,
  };
}

/**
 * @deprecated Use getBestSnapshotForUser instead.
 * Kept for backward compat with any callers.
 */
export async function getLatestSnapshotForUser(userId: string) {
  return getBestSnapshotForUser(userId);
}

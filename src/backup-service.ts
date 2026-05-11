/**
 * backup-service.ts
 *
 * Automated daily backup of critical data to JSON files.
 * - Keeps 7 rolling daily backups.
 * - Runs daily via cron (after the main cron job).
 * - Backup directory: backend/backups/YYYY-MM-DD/
 * - PROD: creates backups silently, alerts loudly if tables are empty.
 * - DEV:  creates backups, allows restore.
 */

import { prisma } from "./prisma";
import { IS_PROD } from "./env";
import * as fs from "fs";
import * as path from "path";

const BACKUP_DIR = path.resolve(process.cwd(), "backups");
const MAX_BACKUPS = 7;

function getBackupPath(dateStr: string): string {
  return path.join(BACKUP_DIR, dateStr);
}

function getTodayDateStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

export async function runDailyBackup(): Promise<void> {
  const dateStr = getTodayDateStr();
  const backupPath = getBackupPath(dateStr);

  console.log(`[Backup] Starting daily backup for ${dateStr}...`);

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    // Collect all backup data in parallel
    const [
      users,
      devotionals,
      streakSnapshots,
      inventories,
      devotionalCompletions,
      supportTickets,
      prayerRequests,
      pointLedger,
      collectionClaims,
      userChapterProgress,
      weeklyProgress,
      userFavorites,
      userGifts,
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          nickname: true,
          role: true,
          avatarId: true,
          frameId: true,
          titleId: true,
          themeId: true,
          selectedMusicId: true,
          points: true,
          streakCurrent: true,
          streakBest: true,
          devotionalsCompleted: true,
          totalTimeSeconds: true,
          lastActiveAt: true,
          communityOptIn: true,
          prayerDisplayOptIn: true,
          supportCount: true,
          countryCode: true,
          showCountry: true,
          activeBadgeId: true,
          deviceId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.devotional.findMany(),
      prisma.streakSnapshot.findMany({
        orderBy: { snapshotDate: "desc" },
      }),
      prisma.userInventory.findMany(),
      prisma.devotionalCompletion.findMany(),
      prisma.supportTicket.findMany(),
      prisma.prayerRequest.findMany(),
      prisma.pointLedger.findMany(),
      prisma.collectionClaim.findMany(),
      prisma.userChapterProgress.findMany(),
      prisma.weeklyProgress.findMany(),
      prisma.userFavorite.findMany(),
      prisma.userGift.findMany(),
    ]);

    const manifest = {
      backupDate: dateStr,
      createdAt: new Date().toISOString(),
      appEnv: IS_PROD ? "prod" : "dev",
      counts: {
        users: users.length,
        devotionals: devotionals.length,
        streakSnapshots: streakSnapshots.length,
        inventoryItems: inventories.length,
        devotionalCompletions: devotionalCompletions.length,
        supportTickets: supportTickets.length,
        prayerRequests: prayerRequests.length,
        pointLedgerEntries: pointLedger.length,
        collectionClaims: collectionClaims.length,
        userChapterProgress: userChapterProgress.length,
        weeklyProgress: weeklyProgress.length,
        userFavorites: userFavorites.length,
        userGifts: userGifts.length,
      },
    };

    const files: Record<string, unknown> = {
      "manifest.json": manifest,
      "users.json": users,
      "devotionals.json": devotionals,
      "streak_snapshots.json": streakSnapshots,
      "inventory.json": inventories,
      "devotional_completions.json": devotionalCompletions,
      "support_tickets.json": supportTickets,
      "prayer_requests.json": prayerRequests,
      "point_ledger.json": pointLedger,
      "collection_claims.json": collectionClaims,
      "user_chapter_progress.json": userChapterProgress,
      "weekly_progress.json": weeklyProgress,
      "user_favorites.json": userFavorites,
      "user_gifts.json": userGifts,
    };

    for (const [filename, data] of Object.entries(files)) {
      fs.writeFileSync(
        path.join(backupPath, filename),
        JSON.stringify(data, null, 2),
        "utf-8"
      );
    }

    console.log(`[Backup] Backup complete for ${dateStr}:`, manifest.counts);

    // Rotate: keep only MAX_BACKUPS most recent
    pruneOldBackups();
  } catch (err) {
    console.error("[Backup] FAILED to create daily backup:", err);
    if (IS_PROD) {
      console.error("[Backup] ⚠️  CRITICAL: Backup failed in production!");
    }
  }
}

function pruneOldBackups(): void {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const entries = fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
      .sort()
      .reverse(); // newest first

    const toDelete = entries.slice(MAX_BACKUPS);
    for (const dir of toDelete) {
      const fullPath = path.join(BACKUP_DIR, dir);
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`[Backup] Pruned old backup: ${dir}`);
    }
  } catch (err) {
    console.error("[Backup] Failed to prune old backups:", err);
  }
}

export function listBackups(): { date: string; manifest: unknown }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const entries = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort()
    .reverse();

  const result = [];
  for (const date of entries) {
    const manifestPath = path.join(BACKUP_DIR, date, "manifest.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      result.push({ date, manifest });
    }
  }
  return result;
}

export function getBackupData(date: string): Record<string, unknown> | null {
  const backupPath = getBackupPath(date);
  if (!fs.existsSync(backupPath)) return null;

  const result: Record<string, unknown> = {};
  const files = fs.readdirSync(backupPath);
  for (const file of files) {
    const key = file.replace(".json", "");
    result[key] = JSON.parse(fs.readFileSync(path.join(backupPath, file), "utf-8"));
  }
  return result;
}

/**
 * Startup sanity check.
 * In PROD: if User or Devotional tables are empty → log CRITICAL and exit.
 * In DEV:  if empty → allow safe reseed (just log a warning).
 */
export async function runStartupSanityCheck(): Promise<void> {
  try {
    const [userCount, devotionalCount] = await Promise.all([
      prisma.user.count(),
      prisma.devotional.count(),
    ]);

    console.log(`[Sanity] Users: ${userCount}, Devotionals: ${devotionalCount}`);

    if (IS_PROD) {
      if (userCount === 0) {
        console.error(
          "🚨 [Sanity] CRITICAL: User table is EMPTY in PRODUCTION! This likely means a DB reset occurred. " +
          "Stopping server to prevent data loss. Restore from backup before restarting."
        );
        process.exit(1);
      }
      if (devotionalCount === 0) {
        console.error(
          "🚨 [Sanity] CRITICAL: Devotional table is EMPTY in PRODUCTION! " +
          "This likely means a DB reset occurred. Stopping server to prevent data loss."
        );
        process.exit(1);
      }
      console.log("[Sanity] PROD sanity check passed ✅");
    } else {
      if (userCount === 0) {
        console.warn("[Sanity] DEV: User table is empty — safe to reseed.");
      }
      if (devotionalCount === 0) {
        console.warn("[Sanity] DEV: Devotional table is empty — will seed on cron startup.");
      }
      console.log("[Sanity] DEV sanity check complete ✅");
    }
  } catch (err) {
    console.error("[Sanity] Failed to run sanity check:", err);
    if (IS_PROD) {
      console.error("[Sanity] Stopping server due to sanity check failure in production.");
      process.exit(1);
    }
  }
}

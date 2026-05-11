/**
 * admin-backup.ts
 *
 * OWNER-only endpoints for backup management:
 * - GET  /api/admin/backups         → list available backups (prod + dev)
 * - GET  /api/admin/backups/latest  → download latest backup as JSON
 * - POST /api/admin/backups/restore → DEV-only: restore from a specific backup date
 * - POST /api/admin/backups/run     → trigger an immediate backup
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireRole } from "../middleware/rbac";
import { runDailyBackup, listBackups, getBackupData } from "../backup-service";
import { IS_PROD } from "../env";
import { prisma } from "../prisma";

export const adminBackupRouter = new Hono();

// ─── List backups ─────────────────────────────────────────────────────────────
adminBackupRouter.get("/", requireRole("OWNER"), (c) => {
  const backups = listBackups();
  return c.json({
    backups,
    count: backups.length,
    isProd: IS_PROD,
  });
});

// ─── Download latest backup ───────────────────────────────────────────────────
adminBackupRouter.get("/latest", requireRole("OWNER"), (c) => {
  const backups = listBackups();
  if (backups.length === 0) {
    return c.json({ error: "No backups available" }, 404);
  }
  const latest = backups[0]!;
  const data = getBackupData(latest.date);
  if (!data) {
    return c.json({ error: "Backup data not found" }, 404);
  }
  return c.json({ date: latest.date, manifest: latest.manifest, data });
});

// ─── Download specific backup ─────────────────────────────────────────────────
adminBackupRouter.get("/:date", requireRole("OWNER"), (c) => {
  const date = c.req.param("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: "Invalid date format (expected YYYY-MM-DD)" }, 400);
  }
  const data = getBackupData(date);
  if (!data) {
    return c.json({ error: "Backup not found for this date" }, 404);
  }
  return c.json({ date, data });
});

// ─── Trigger immediate backup ─────────────────────────────────────────────────
adminBackupRouter.post("/run", requireRole("OWNER"), async (c) => {
  console.log("[AdminBackup] Manual backup triggered by OWNER");
  try {
    await runDailyBackup();
    const backups = listBackups();
    return c.json({ success: true, message: "Backup created successfully", backupCount: backups.length });
  } catch (err) {
    console.error("[AdminBackup] Manual backup failed:", err);
    return c.json({ success: false, error: "Backup failed" }, 500);
  }
});

// ─── Restore from backup (DEV only) ──────────────────────────────────────────
const restoreSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  confirm: z.literal("RESTORE_DEV_DATA"),
});

adminBackupRouter.post("/restore", requireRole("OWNER"), zValidator("json", restoreSchema), async (c) => {
  if (IS_PROD) {
    console.error("[AdminBackup] ⛔ Restore attempted in PRODUCTION — BLOCKED.");
    return c.json(
      {
        error: "Restore is BLOCKED in production. Download the backup and restore manually.",
        isProd: true,
      },
      403
    );
  }

  const { date } = c.req.valid("json");
  const data = getBackupData(date);

  if (!data) {
    return c.json({ error: `No backup found for ${date}` }, 404);
  }

  const backupData = data as Record<string, any[]>;

  console.log(`[AdminBackup] Starting DEV restore from backup ${date}...`);

  try {
    // Restore users
    if (Array.isArray(backupData.users)) {
      for (const user of backupData.users) {
        await prisma.user.upsert({
          where: { id: user.id },
          update: {
            nickname: user.nickname,
            role: user.role,
            avatarId: user.avatarId,
            frameId: user.frameId,
            titleId: user.titleId,
            themeId: user.themeId,
            selectedMusicId: user.selectedMusicId,
            points: user.points,
            streakCurrent: user.streakCurrent,
            streakBest: user.streakBest,
            devotionalsCompleted: user.devotionalsCompleted,
            totalTimeSeconds: user.totalTimeSeconds,
            communityOptIn: user.communityOptIn,
            prayerDisplayOptIn: user.prayerDisplayOptIn,
            supportCount: user.supportCount,
            countryCode: user.countryCode,
            showCountry: user.showCountry,
            activeBadgeId: user.activeBadgeId,
          },
          create: {
            id: user.id,
            nickname: user.nickname,
            nicknameLower: user.nickname.toLowerCase(),
            role: user.role,
            avatarId: user.avatarId,
            frameId: user.frameId,
            titleId: user.titleId,
            themeId: user.themeId,
            selectedMusicId: user.selectedMusicId,
            points: user.points,
            streakCurrent: user.streakCurrent,
            streakBest: user.streakBest,
            devotionalsCompleted: user.devotionalsCompleted,
            totalTimeSeconds: user.totalTimeSeconds,
            communityOptIn: user.communityOptIn,
            prayerDisplayOptIn: user.prayerDisplayOptIn,
            supportCount: user.supportCount,
            countryCode: user.countryCode,
            showCountry: user.showCountry,
            activeBadgeId: user.activeBadgeId,
            deviceId: user.deviceId,
          },
        });
      }
      console.log(`[AdminBackup] Restored ${backupData.users.length} users`);
    }

    // Restore devotionals
    if (Array.isArray(backupData.devotionals)) {
      for (const d of backupData.devotionals) {
        await prisma.devotional.upsert({
          where: { id: d.id },
          update: d,
          create: d,
        });
      }
      console.log(`[AdminBackup] Restored ${backupData.devotionals.length} devotionals`);
    }

    // Restore inventory
    if (Array.isArray(backupData.inventory)) {
      for (const item of backupData.inventory) {
        await prisma.userInventory.upsert({
          where: { id: item.id },
          update: item,
          create: item,
        }).catch(() => {/* ignore duplicates */});
      }
      console.log(`[AdminBackup] Restored ${backupData.inventory.length} inventory items`);
    }

    // Restore devotional completions
    if (Array.isArray(backupData.devotional_completions)) {
      for (const dc of backupData.devotional_completions) {
        await prisma.devotionalCompletion.upsert({
          where: { id: dc.id },
          update: dc,
          create: dc,
        }).catch(() => {/* ignore duplicates */});
      }
      console.log(`[AdminBackup] Restored ${backupData.devotional_completions.length} devotional completions`);
    }

    // Restore support tickets
    if (Array.isArray(backupData.support_tickets)) {
      for (const ticket of backupData.support_tickets) {
        await prisma.supportTicket.upsert({
          where: { id: ticket.id },
          update: ticket,
          create: ticket,
        }).catch(() => {/* ignore duplicates */});
      }
      console.log(`[AdminBackup] Restored ${backupData.support_tickets.length} support tickets`);
    }

    console.log(`[AdminBackup] DEV restore from ${date} completed successfully ✅`);
    return c.json({
      success: true,
      message: `Restored from backup ${date}`,
      restoredCounts: {
        users: backupData.users?.length ?? 0,
        devotionals: backupData.devotionals?.length ?? 0,
        inventoryItems: backupData.inventory?.length ?? 0,
        devotionalCompletions: backupData.devotional_completions?.length ?? 0,
        supportTickets: backupData.support_tickets?.length ?? 0,
      },
    });
  } catch (err) {
    console.error("[AdminBackup] Restore failed:", err);
    return c.json({ success: false, error: "Restore failed", details: String(err) }, 500);
  }
});

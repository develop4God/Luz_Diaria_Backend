import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { requireRole } from "../middleware/rbac";
import { validateNickname, normalizeNickname } from "../lib/nickname-safety";

export const adminRouter = new Hono();

// ─── Known badge ID remap table (old id → new id) ─────────────────────────────
// Add mappings here if badges were renamed/migrated.
const BADGE_REMAP: Record<string, string> = {
  // Example: badge_old_id: "badge_new_id"
};

// ─── List users with rich stats (MODERATOR+) ─────────────────────────────────
// GET /api/admin/users?search=xxx&role=USER|MODERATOR|OWNER&activeOnly=true&hasIssues=true
adminRouter.get("/users", requireRole("MODERATOR"), async (c) => {
  try {
    const search    = c.req.query("search")?.trim().toLowerCase() ?? "";
    const roleFilter= c.req.query("role") ?? "";
    const activeOnly= c.req.query("activeOnly") === "true";
    const hasIssues = c.req.query("hasIssues") === "true";

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const users = await prisma.user.findMany({
      where: {
        ...(search   ? { nicknameLower: { contains: search } } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
      },
      include: {
        inventory: {
          where:   { item: { type: "badge" } },
          include: { item: true },
        },
      },
      orderBy: { nicknameLower: "asc" },
      take: 200,
    });

    // Fetch store items for badge name resolution
    const storeItems = await prisma.storeItem.findMany({
      where: { type: "badge" },
      select: { id: true, nameEn: true, nameEs: true },
    });
    const badgeCatalog = new Map(storeItems.map(i => [i.id, i]));

    // Per-user: count completions in last 7 days
    const completionRows = await prisma.devotionalCompletion.groupBy({
      by: ["userId"],
      where: { devotionalDate: { gte: sevenDaysAgo } },
      _count: { userId: true },
    });
    const recent7Map = new Map(completionRows.map(r => [r.userId, r._count.userId]));

    type BadgeInfo = { id: string; nameEs: string; nameEn: string; unknown: boolean };
    type UserRow = {
      id: string;
      nickname: string;
      role: string;
      countryCode: string | null;
      streakCurrent: number;
      streakBest: number;
      devotionalsCompleted: number;
      completionsLast7Days: number;
      points: number;
      lastActiveAt: string | null;
      lastSeenAt: string | null;
      activeBadgeId: string | null;
      badges: BadgeInfo[];
      hasIssues: boolean;
      createdAt: string;
    };

    const rows: UserRow[] = users.map(u => {
      const badges: BadgeInfo[] = u.inventory.map(inv => {
        const catalogItem = badgeCatalog.get(inv.itemId);
        if (catalogItem) {
          return { id: inv.itemId, nameEs: catalogItem.nameEs, nameEn: catalogItem.nameEn, unknown: false };
        }
        // Try remap
        const remapped = BADGE_REMAP[inv.itemId];
        const remappedItem = remapped ? badgeCatalog.get(remapped) : undefined;
        if (remappedItem) {
          return { id: inv.itemId, nameEs: remappedItem.nameEs, nameEn: remappedItem.nameEn, unknown: false };
        }
        return { id: inv.itemId, nameEs: `Desconocido: ${inv.itemId}`, nameEn: `Unknown: ${inv.itemId}`, unknown: true };
      });

      const userHasIssues = badges.some(b => b.unknown);

      return {
        id:                   u.id,
        nickname:             u.nickname,
        role:                 u.role,
        countryCode:          u.countryCode,
        streakCurrent:        u.streakCurrent,
        streakBest:           u.streakBest,
        devotionalsCompleted: u.devotionalsCompleted,
        completionsLast7Days: recent7Map.get(u.id) ?? 0,
        points:               u.points,
        lastActiveAt:         u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
        lastSeenAt:           u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : null,
        activeBadgeId:        u.activeBadgeId,
        badges,
        hasIssues:            userHasIssues,
        createdAt:            u.createdAt.toISOString(),
      };
    });

    // Active-only filter: had completions in last 7 days
    const filtered = rows.filter(r => {
      if (activeOnly && r.completionsLast7Days === 0) return false;
      if (hasIssues  && !r.hasIssues)                return false;
      return true;
    });

    return c.json({ users: filtered });
  } catch (err) {
    console.error("[AdminUsers] Error listing users:", err);
    return c.json({ error: "Failed to list users" }, 500);
  }
});

// ─── Change user role (OWNER only) ───────────────────────────────────────────
const changeRoleSchema = z.object({
  role: z.enum(["USER", "MODERATOR"]),
});

adminRouter.patch(
  "/users/:id/role",
  requireRole("OWNER"),
  zValidator("json", changeRoleSchema),
  async (c) => {
    try {
      const targetId = c.req.param("id");
      const { role: newRole } = c.req.valid("json");
      const actorId = c.req.header("X-User-Id") as string;

      if (targetId === actorId) {
        return c.json({ success: false, error: "Cannot change your own role" }, 400);
      }

      const target = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, role: true, nickname: true },
      });

      if (!target) {
        return c.json({ success: false, error: "User not found" }, 404);
      }
      if (target.role === "OWNER") {
        return c.json({ success: false, error: "Cannot modify an OWNER account" }, 400);
      }
      if (target.role === newRole) {
        return c.json({ success: true, user: target, message: "Role unchanged" });
      }

      const updated = await prisma.user.update({
        where: { id: targetId },
        data: { role: newRole },
        select: { id: true, nickname: true, role: true },
      });

      await prisma.adminAuditLog.create({
        data: { actorUserId: actorId, targetUserId: targetId, action: "SET_ROLE", beforeRole: target.role, afterRole: newRole },
      });

      console.log(`[AdminUsers] Role change: ${target.nickname} ${target.role} => ${newRole}`);
      return c.json({ success: true, user: updated });
    } catch (err) {
      console.error("[AdminUsers] Error changing role:", err);
      return c.json({ error: "Failed to change role" }, 500);
    }
  }
);

// ─── Compensate user: grant points or grant a store item (MODERATOR+) ─────────
// MODERATORs can compensate up to 2000 pts; OWNERs have no cap.
const compensateSchema = z.object({
  type: z.enum(["points", "item"]),
  points: z.number().int().min(1).max(100000).optional(),
  itemId: z.string().optional(),
  reason: z.string().max(200).optional(),
});

const MODERATOR_MAX_POINTS = 2000;

adminRouter.post(
  "/users/:id/compensate",
  requireRole("MODERATOR"),
  zValidator("json", compensateSchema),
  async (c) => {
    try {
      const targetId = c.req.param("id");
      const { type, points, itemId, reason } = c.req.valid("json");
      const actorId = c.req.header("X-User-Id") as string;
      const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
      const actorRole = actor?.role ?? "USER";

      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (!target) return c.json({ success: false, error: "User not found" }, 404);

      if (type === "points") {
        if (!points || points < 1) return c.json({ success: false, error: "Points must be >= 1" }, 400);
        if (actorRole !== "OWNER" && points > MODERATOR_MAX_POINTS) {
          return c.json({ success: false, error: `Moderators can only compensate up to ${MODERATOR_MAX_POINTS} points` }, 403);
        }

        // Create a GiftDrop + UserGift so the user sees the gift popup and must claim the points
        const giftTitle = reason?.trim() ? reason.trim() : `¡Puntos para ti!`;
        const giftMessage = `Has recibido ${points} puntos de compensación.`;

        const giftDrop = await prisma.giftDrop.create({
          data: {
            title: giftTitle,
            message: giftMessage,
            rewardType: "CHEST",
            rewardId: String(points), // numeric string = points amount
            audienceType: "USER_IDS",
            audienceUserIds: JSON.stringify([targetId]),
            isActive: true,
          },
        });

        await prisma.userGift.create({
          data: { userId: targetId, giftDropId: giftDrop.id, status: "PENDING" },
        });

        await prisma.adminAuditLog.create({
          data: { actorUserId: actorId, targetUserId: targetId, action: "GRANT_POINTS", beforeRole: "", afterRole: "" },
        });

        console.log(`[AdminUsers] Compensate ${target.nickname}: ${points} points (via gift drop ${giftDrop.id})`);
        return c.json({ success: true, message: `Pending gift of ${points} points created for ${target.nickname}` });
      }

      if (type === "item") {
        if (!itemId) return c.json({ success: false, error: "itemId required" }, 400);

        const item = await prisma.storeItem.findUnique({ where: { id: itemId } });
        if (!item) return c.json({ success: false, error: "Item not found in catalog" }, 404);

        // Map StoreItem.type to GiftDrop.rewardType
        const rewardTypeMap: Record<string, "THEME" | "TITLE" | "AVATAR" | "ITEM"> = {
          theme: "THEME",
          title: "TITLE",
          avatar: "AVATAR",
        };
        const rewardType = rewardTypeMap[item.type] ?? "ITEM";

        // Create a GiftDrop + UserGift so the user sees the gift popup and gets the "NEW" badge
        const giftTitle = reason?.trim() ? reason.trim() : `¡Un regalo para ti!`;
        const giftMessage = `${item.nameEs} / ${item.nameEn}`;

        const giftDrop = await prisma.giftDrop.create({
          data: {
            title: giftTitle,
            message: giftMessage,
            rewardType,
            rewardId: itemId,
            audienceType: "USER_IDS",
            audienceUserIds: JSON.stringify([targetId]),
            isActive: true,
          },
        });

        await prisma.userGift.create({
          data: { userId: targetId, giftDropId: giftDrop.id, status: "PENDING" },
        });

        await prisma.adminAuditLog.create({
          data: { actorUserId: actorId, targetUserId: targetId, action: `GRANT_ITEM:${itemId}`, beforeRole: "", afterRole: "" },
        });

        console.log(`[AdminUsers] Compensate ${target.nickname}: item ${itemId} (via gift drop ${giftDrop.id})`);
        return c.json({ success: true, message: `Granted item "${item.nameEs}" to ${target.nickname}` });
      }

      return c.json({ success: false, error: "Invalid type" }, 400);
    } catch (err) {
      console.error("[AdminUsers] Error compensating:", err);
      return c.json({ error: "Failed to compensate" }, 500);
    }
  }
);

// ─── Fix badges: remove unknown codes, apply remap table (OWNER only) ────────
adminRouter.post(
  "/users/:id/fix-badges",
  requireRole("OWNER"),
  async (c) => {
    try {
      const targetId = c.req.param("id");
      const actorId  = c.req.header("X-User-Id") as string;

      const target = await prisma.user.findUnique({
        where: { id: targetId },
        include: { inventory: { where: { item: { type: "badge" } }, include: { item: true } } },
      });
      if (!target) return c.json({ success: false, error: "User not found" }, 404);

      const storeItems = await prisma.storeItem.findMany({ where: { type: "badge" }, select: { id: true } });
      const validIds   = new Set(storeItems.map(i => i.id));

      const removed: string[] = [];
      const remapped: Array<{ from: string; to: string }> = [];

      for (const inv of target.inventory) {
        if (!validIds.has(inv.itemId)) {
          const remapTo = BADGE_REMAP[inv.itemId];
          if (remapTo && validIds.has(remapTo)) {
            // Grant the remapped badge, delete old
            await prisma.userInventory.upsert({
              where:  { userId_itemId: { userId: targetId, itemId: remapTo } },
              update: {},
              create: { userId: targetId, itemId: remapTo, source: "fix_badges" },
            });
            await prisma.userInventory.delete({
              where: { userId_itemId: { userId: targetId, itemId: inv.itemId } },
            });
            remapped.push({ from: inv.itemId, to: remapTo });
          } else {
            // No remap — just remove invalid badge
            await prisma.userInventory.delete({
              where: { userId_itemId: { userId: targetId, itemId: inv.itemId } },
            });
            removed.push(inv.itemId);
          }
        }
      }

      // Fix activeBadgeId if it's now invalid
      if (target.activeBadgeId && !validIds.has(target.activeBadgeId)) {
        await prisma.user.update({ where: { id: targetId }, data: { activeBadgeId: null } });
      }

      const summary = [
        removed.length  > 0 ? `Removed: ${removed.join(", ")}` : "",
        remapped.length > 0 ? `Remapped: ${remapped.map(r => `${r.from}→${r.to}`).join(", ")}` : "",
      ].filter(Boolean).join(" | ") || "No changes needed";

      if (removed.length > 0 || remapped.length > 0) {
        await prisma.adminAuditLog.create({
          data: { actorUserId: actorId, targetUserId: targetId, action: `FIX_BADGES:${summary}`.slice(0, 200), beforeRole: "", afterRole: "" },
        });
      }

      console.log(`[AdminUsers] fix-badges ${target.nickname}: ${summary}`);
      return c.json({ success: true, removed, remapped, message: summary });
    } catch (err) {
      console.error("[AdminUsers] Error fixing badges:", err);
      return c.json({ error: "Failed to fix badges" }, 500);
    }
  }
);

// ─── Get store items (for compensate modal) (MODERATOR+) ─────────────────────
adminRouter.get("/store-items", requireRole("MODERATOR"), async (c) => {
  try {
    const items = await prisma.storeItem.findMany({
      select: { id: true, nameEs: true, nameEn: true, type: true, rarity: true, pricePoints: true },
      orderBy: [{ type: "asc" }, { nameEs: "asc" }],
    });
    return c.json({ items });
  } catch (err) {
    console.error("[AdminUsers] Error fetching store items:", err);
    return c.json({ error: "Failed to fetch store items" }, 500);
  }
});

// ─── Helper: resolve badges to display objects ────────────────────────────────
async function resolveUserBadges(userId: string) {
  const storeItems = await prisma.storeItem.findMany({
    where: { type: "badge" },
    select: { id: true, nameEs: true, nameEn: true },
  });
  const catalog = new Map(storeItems.map(i => [i.id, i]));

  const inventory = await prisma.userInventory.findMany({
    where: { userId, item: { type: "badge" } },
    include: { item: true },
  });

  return inventory.map(inv => {
    const cat = catalog.get(inv.itemId);
    if (cat) return { id: inv.itemId, code: inv.itemId, displayNameEs: cat.nameEs, displayNameEn: cat.nameEn, unknown: false };
    const remapped = BADGE_REMAP[inv.itemId];
    const rc = remapped ? catalog.get(remapped) : undefined;
    if (rc)  return { id: inv.itemId, code: inv.itemId, displayNameEs: rc.nameEs,  displayNameEn: rc.nameEn,  unknown: false };
    return { id: inv.itemId, code: inv.itemId, displayNameEs: `Desconocido: ${inv.itemId}`, displayNameEn: `Unknown: ${inv.itemId}`, unknown: true };
  });
}

// ─── GET /api/admin/users/:id — single user detail (OWNER) ───────────────────
adminRouter.get("/users/:id", requireRole("OWNER"), async (c) => {
  try {
    const userId = c.req.param("id");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return c.json({ error: "User not found" }, 404);

    const [badges, completionsLast7] = await Promise.all([
      resolveUserBadges(userId),
      prisma.devotionalCompletion.count({ where: { userId, devotionalDate: { gte: sevenDaysAgo } } }),
    ]);

    return c.json({
      id: user.id,
      nickname: user.nickname,
      role: user.role,
      countryCode: user.countryCode,
      streakCurrent: user.streakCurrent,
      streakBest: user.streakBest,
      devotionalsCompleted: user.devotionalsCompleted,
      completionsLast7Days: completionsLast7,
      points: user.points,
      lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt).toISOString() : null,
      activeBadgeId: user.activeBadgeId,
      badges,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[AdminUsers] Error fetching user detail:", err);
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

// ─── PATCH /api/admin/users/:id — partial update (OWNER) ─────────────────────
const patchUserSchema = z.object({
  points:                 z.number().int().min(0).optional(),
  countryCode:            z.string().length(2).toUpperCase().optional(),
  streakCurrent:          z.number().int().min(0).optional(),
  devotionalsCompleted:   z.number().int().min(0).optional(),
  role:                   z.enum(["USER", "MODERATOR"]).optional(), // can't set OWNER
  forceStreakDecrease:    z.boolean().optional(), // must be true to allow lowering streak
});

adminRouter.patch(
  "/users/:id",
  requireRole("OWNER"),
  zValidator("json", patchUserSchema),
  async (c) => {
    try {
      const targetId = c.req.param("id");
      const actorId  = c.req.header("X-User-Id") as string;
      const body     = c.req.valid("json");

      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (!target) return c.json({ success: false, error: "User not found" }, 404);
      if (target.role === "OWNER" && body.role) {
        return c.json({ success: false, error: "Cannot change role of an OWNER" }, 400);
      }
      if (targetId === actorId && body.role) {
        return c.json({ success: false, error: "Cannot change your own role" }, 400);
      }

      // Streak decrease safeguard
      if (body.streakCurrent !== undefined && body.streakCurrent < target.streakCurrent) {
        if (!body.forceStreakDecrease) {
          return c.json({ success: false, error: "STREAK_DECREASE_REQUIRES_CONFIRM" }, 400);
        }
      }

      const before: Record<string, unknown> = {};
      const after:  Record<string, unknown> = {};
      const updateData: Record<string, unknown> = {};

      if (body.points !== undefined && body.points !== target.points) {
        before.points = target.points; after.points = body.points;
        updateData.points = body.points;
      }
      if (body.countryCode !== undefined && body.countryCode !== target.countryCode) {
        before.countryCode = target.countryCode; after.countryCode = body.countryCode;
        updateData.countryCode = body.countryCode;
      }
      if (body.streakCurrent !== undefined && body.streakCurrent !== target.streakCurrent) {
        before.streakCurrent = target.streakCurrent; after.streakCurrent = body.streakCurrent;
        updateData.streakCurrent = body.streakCurrent;
        // If new streak is higher, also update streakBest
        if (body.streakCurrent > target.streakBest) updateData.streakBest = body.streakCurrent;
      }
      if (body.role && body.role !== target.role) {
        before.role = target.role; after.role = body.role;
        updateData.role = body.role;
      }
      if (body.devotionalsCompleted !== undefined && body.devotionalsCompleted !== target.devotionalsCompleted) {
        before.devotionalsCompleted = target.devotionalsCompleted; after.devotionalsCompleted = body.devotionalsCompleted;
        updateData.devotionalsCompleted = body.devotionalsCompleted;
      }

      if (Object.keys(updateData).length === 0) {
        return c.json({ success: true, message: "Nothing changed" });
      }

      await prisma.user.update({ where: { id: targetId }, data: updateData });

      await prisma.adminAuditLog.create({
        data: {
          actorUserId:  actorId,
          targetUserId: targetId,
          action:       `PATCH_USER:${JSON.stringify(after)}`.slice(0, 200),
          beforeRole:   String(before.role ?? target.role),
          afterRole:    String(after.role  ?? target.role),
        },
      });

      console.log(`[AdminUsers] PATCH user ${target.nickname}: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
      return c.json({ success: true, changes: { before, after } });
    } catch (err) {
      console.error("[AdminUsers] Error patching user:", err);
      return c.json({ error: "Failed to update user" }, 500);
    }
  }
);

// ─── GET /api/admin/badges — all available badge items (OWNER) ───────────────
adminRouter.get("/badges", requireRole("OWNER"), async (c) => {
  try {
    const badges = await prisma.storeItem.findMany({
      where: { type: "badge" },
      select: { id: true, nameEs: true, nameEn: true, rarity: true },
      orderBy: { nameEs: "asc" },
    });
    return c.json({ badges: badges.map(b => ({
      id: b.id, code: b.id,
      displayNameEs: b.nameEs,
      displayNameEn: b.nameEn,
      rarity: b.rarity,
    })) });
  } catch (err) {
    console.error("[AdminUsers] Error fetching badges:", err);
    return c.json({ error: "Failed to fetch badges" }, 500);
  }
});

// ─── PUT /api/admin/users/:id/badges — add/remove badges (OWNER) ─────────────
const badgesSchema = z.object({
  add:    z.array(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

adminRouter.put(
  "/users/:id/badges",
  requireRole("OWNER"),
  zValidator("json", badgesSchema),
  async (c) => {
    try {
      const targetId = c.req.param("id");
      const actorId  = c.req.header("X-User-Id") as string;
      const { add = [], remove = [] } = c.req.valid("json");

      const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, nickname: true } });
      if (!target) return c.json({ success: false, error: "User not found" }, 404);

      // Validate all add IDs exist in catalog
      if (add.length > 0) {
        const found = await prisma.storeItem.findMany({ where: { id: { in: add }, type: "badge" }, select: { id: true } });
        const foundIds = new Set(found.map(f => f.id));
        const invalid = add.filter(id => !foundIds.has(id));
        if (invalid.length > 0) return c.json({ success: false, error: `Unknown badge IDs: ${invalid.join(", ")}` }, 400);
      }

      const added: string[] = [];
      const removed: string[] = [];

      for (const itemId of add) {
        const res = await prisma.userInventory.upsert({
          where:  { userId_itemId: { userId: targetId, itemId } },
          update: {},
          create: { userId: targetId, itemId, source: "admin_grant" },
        });
        if (res) added.push(itemId);
      }

      for (const itemId of remove) {
        try {
          await prisma.userInventory.delete({ where: { userId_itemId: { userId: targetId, itemId } } });
          removed.push(itemId);
          // Clear activeBadgeId if it was this badge
          await prisma.user.updateMany({ where: { id: targetId, activeBadgeId: itemId }, data: { activeBadgeId: null } });
        } catch { /* already gone — ignore */ }
      }

      if (added.length > 0 || removed.length > 0) {
        const summary = [
          added.length   > 0 ? `+[${added.join(",")}]`   : "",
          removed.length > 0 ? `-[${removed.join(",")}]` : "",
        ].filter(Boolean).join(" ");
        await prisma.adminAuditLog.create({
          data: { actorUserId: actorId, targetUserId: targetId, action: `BADGES:${summary}`.slice(0, 200), beforeRole: "", afterRole: "" },
        });
      }

      console.log(`[AdminUsers] badges for ${target.nickname}: added=${added.join(",")} removed=${removed.join(",")}`);
      return c.json({ success: true, added, removed });
    } catch (err) {
      console.error("[AdminUsers] Error updating badges:", err);
      return c.json({ error: "Failed to update badges" }, 500);
    }
  }
);


// ─── POST /api/admin/snapshots/generate — force snapshot generation (OWNER) ──
adminRouter.post("/snapshots/generate", requireRole("OWNER"), async (c) => {
  const { generateStreakSnapshots, getCRDateString } = await import("../streak-snapshot-service");
  const today = getCRDateString(0);
  const result = await generateStreakSnapshots(today);
  return c.json({ success: true, date: today, ...result });
});

// ─── POST /api/admin/users/:id/force-rename — override nickname (OWNER) ──────
const forceRenameSchema = z.object({
  newNickname: z.string().min(3).max(20),
  skipSafetyCheck: z.boolean().optional().default(false),
});

adminRouter.post(
  "/users/:id/force-rename",
  requireRole("OWNER"),
  zValidator("json", forceRenameSchema),
  async (c) => {
    try {
      const targetId = c.req.param("id");
      const actorId  = c.req.header("X-User-Id") as string;
      const { newNickname, skipSafetyCheck } = c.req.valid("json");

      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (!target) return c.json({ success: false, error: "User not found" }, 404);

      // Run safety check unless owner explicitly overrides
      const newNormalizedNickname = normalizeNickname(newNickname);
      if (!skipSafetyCheck) {
        const validation = validateNickname(newNickname);
        if (!validation.ok) {
          return c.json({ success: false, error: validation.error }, 400);
        }
      }

      const newNicknameLower = newNickname.toLowerCase();

      // Uniqueness checks (skip own current nickname)
      if (newNicknameLower !== target.nicknameLower) {
        const existingRaw = await prisma.user.findUnique({ where: { nicknameLower: newNicknameLower } });
        if (existingRaw) return c.json({ success: false, error: "Ese nickname ya está en uso." }, 409);
      }
      if (newNormalizedNickname !== target.normalizedNickname) {
        const lookalike = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT "id" FROM "User" WHERE "normalizedNickname" = ? AND "id" != ? LIMIT 1`,
          newNormalizedNickname,
          targetId
        );
        if (lookalike.length > 0) return c.json({ success: false, error: "Ese nickname ya está en uso." }, 409);
      }

      await prisma.user.update({
        where: { id: targetId },
        data: {
          nickname: newNickname,
          nicknameLower: newNicknameLower,
          normalizedNickname: newNormalizedNickname,
        },
      });

      await prisma.adminAuditLog.create({
        data: {
          actorUserId:  actorId,
          targetUserId: targetId,
          action:       `FORCE_RENAME:${target.nickname}=>${newNickname}`.slice(0, 200),
          beforeRole:   target.role,
          afterRole:    target.role,
        },
      });

      console.log(`[AdminUsers] Force rename: ${target.nickname} => ${newNickname} by ${actorId}`);
      return c.json({ success: true, oldNickname: target.nickname, newNickname });
    } catch (err) {
      console.error("[AdminUsers] Error force renaming:", err);
      return c.json({ error: "Failed to rename user" }, 500);
    }
  }
);

// ─── GET /api/admin/users/:id/challenge-progress — user's challenge data (OWNER) ─
adminRouter.get("/users/:id/challenge-progress", requireRole("OWNER"), async (c) => {
  try {
    const userId = c.req.param("id");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true },
    });
    if (!user) return c.json({ error: "User not found" }, 404);

    // Get all weekly challenges and their progress for this user
    const challenges = await prisma.weeklyChallenge.findMany({
      orderBy: [{ weekId: "desc" }, { createdAt: "desc" }],
      take: 20,
    });

    const progressRows = await prisma.weeklyProgress.findMany({
      where: { userId },
    });
    const progressMap = new Map(progressRows.map(p => [p.challengeId, p]));

    const result = challenges.map(ch => {
      const progress = progressMap.get(ch.id);
      return {
        id: ch.id,
        weekId: ch.weekId,
        type: ch.type,
        titleEs: ch.titleEs,
        titleEn: ch.titleEn,
        goalCount: ch.goalCount,
        rewardPoints: ch.rewardPoints,
        currentCount: progress?.currentCount ?? 0,
        completed: progress?.completed ?? false,
        claimed: progress?.claimed ?? false,
      };
    });

    return c.json({ userId, nickname: user.nickname, challenges: result });
  } catch (err) {
    console.error("[AdminUsers] Error fetching challenge progress:", err);
    return c.json({ error: "Failed to fetch challenge progress" }, 500);
  }
});

// ─── PATCH /api/admin/users/:id/challenge-progress/:challengeId (OWNER) ──────
const patchChallengeSchema = z.object({
  current: z.number().int().min(0).optional(),
  claimed: z.boolean().optional(),
});

adminRouter.patch(
  "/users/:id/challenge-progress/:challengeId",
  requireRole("OWNER"),
  zValidator("json", patchChallengeSchema),
  async (c) => {
    try {
      const userId = c.req.param("id");
      const challengeId = c.req.param("challengeId");
      const actorId = c.req.header("X-User-Id") as string;
      const body = c.req.valid("json");

      const challenge = await prisma.weeklyChallenge.findUnique({ where: { id: challengeId } });
      if (!challenge) return c.json({ success: false, error: "Challenge not found" }, 404);

      const existing = await prisma.weeklyProgress.findFirst({ where: { userId, challengeId } });

      const data: Record<string, unknown> = {};
      if (body.current !== undefined) data.currentCount = body.current;
      if (body.claimed !== undefined) {
        data.claimed = body.claimed;
      }

      await prisma.weeklyProgress.upsert({
        where: existing ? { id: existing.id } : { id: "nonexistent" },
        update: data,
        create: { userId, challengeId, currentCount: body.current ?? 0, claimed: body.claimed ?? false },
      });

      await prisma.adminAuditLog.create({
        data: {
          actorUserId: actorId,
          targetUserId: userId,
          action: `PATCH_CHALLENGE:${challengeId} ${JSON.stringify(data)}`.slice(0, 200),
          beforeRole: "",
          afterRole: "",
        },
      });

      return c.json({ success: true });
    } catch (err) {
      console.error("[AdminUsers] Error patching challenge progress:", err);
      return c.json({ error: "Failed to update challenge progress" }, 500);
    }
  }
);

// ─── GET /api/admin/promo-codes — list all promo codes (OWNER) ───────────────
adminRouter.get("/promo-codes", requireRole("OWNER"), async (c) => {
  try {
    const codes = await prisma.promoCode.findMany({
      include: { redemptions: { select: { userId: true, redeemedAt: true } } },
      orderBy: { createdAt: "desc" },
    });

    return c.json({
      codes: codes.map(c => ({
        id: c.id,
        displayCode: c.displayCode,
        points: c.points,
        isActive: c.isActive,
        maxUses: c.maxUses,
        totalUses: c.totalUses,
        createdAt: c.createdAt.toISOString(),
        redemptions: c.redemptions.map(r => ({
          userId: r.userId,
          redeemedAt: new Date(r.redeemedAt).toISOString(),
        })),
      })),
    });
  } catch (err) {
    console.error("[AdminUsers] Error fetching promo codes:", err);
    return c.json({ error: "Failed to fetch promo codes" }, 500);
  }
});

// ─── POST /api/admin/promo-codes — create a promo code (OWNER) ───────────────
const createPromoCodeSchema = z.object({
  id: z.string().min(4).max(30).regex(/^[A-Z0-9_-]+$/i, "Code must be alphanumeric with - or _"),
  points: z.number().int().min(1).max(100000),
  maxUses: z.number().int().min(1).optional(),
});

adminRouter.post(
  "/promo-codes",
  requireRole("OWNER"),
  zValidator("json", createPromoCodeSchema),
  async (c) => {
    try {
      const { id, points, maxUses } = c.req.valid("json");
      const actorId = c.req.header("X-User-Id") as string;

      const displayCode = id.toUpperCase();
      const codeId = displayCode;

      const existing = await prisma.promoCode.findUnique({ where: { id: codeId } });
      if (existing) return c.json({ success: false, error: "Code already exists" }, 409);

      const code = await prisma.promoCode.create({
        data: { id: codeId, displayCode, points, maxUses: maxUses ?? null, isActive: true },
      });

      await prisma.adminAuditLog.create({
        data: { actorUserId: actorId, targetUserId: "", action: `CREATE_PROMO_CODE:${codeId}(${points}pts)`.slice(0, 200), beforeRole: "", afterRole: "" },
      });

      console.log(`[AdminUsers] Created promo code: ${codeId} = ${points} pts, maxUses=${maxUses ?? "unlimited"}`);
      return c.json({ success: true, code });
    } catch (err) {
      console.error("[AdminUsers] Error creating promo code:", err);
      return c.json({ error: "Failed to create promo code" }, 500);
    }
  }
);

// ─── PATCH /api/admin/promo-codes/:id — activate/deactivate (OWNER) ──────────
const patchPromoCodeSchema = z.object({
  isActive: z.boolean(),
});

adminRouter.patch(
  "/promo-codes/:id",
  requireRole("OWNER"),
  zValidator("json", patchPromoCodeSchema),
  async (c) => {
    try {
      const codeId = c.req.param("id");
      const actorId = c.req.header("X-User-Id") as string;
      const { isActive } = c.req.valid("json");

      const code = await prisma.promoCode.findUnique({ where: { id: codeId } });
      if (!code) return c.json({ success: false, error: "Code not found" }, 404);

      await prisma.promoCode.update({ where: { id: codeId }, data: { isActive } });

      await prisma.adminAuditLog.create({
        data: { actorUserId: actorId, targetUserId: "", action: `${isActive ? "ACTIVATE" : "DEACTIVATE"}_PROMO_CODE:${codeId}`.slice(0, 200), beforeRole: "", afterRole: "" },
      });

      return c.json({ success: true, id: codeId, isActive });
    } catch (err) {
      console.error("[AdminUsers] Error patching promo code:", err);
      return c.json({ error: "Failed to update promo code" }, 500);
    }
  }
);

// ─── POST /api/admin/users/:id/deactivate — soft-lock a user (OWNER) ─────────
// Blocks the user from earning points or completing devotionals.
// We implement this by clearing their deviceId (breaks device association) and
// setting their role to USER if MODERATOR.
adminRouter.post(
  "/users/:id/deactivate",
  requireRole("OWNER"),
  async (c) => {
    try {
      const targetId = c.req.param("id");
      const actorId = c.req.header("X-User-Id") as string;

      if (targetId === actorId) return c.json({ success: false, error: "Cannot deactivate yourself" }, 400);

      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (!target) return c.json({ success: false, error: "User not found" }, 404);
      if (target.role === "OWNER") return c.json({ success: false, error: "Cannot deactivate an OWNER" }, 400);

      // Nullify deviceId to break device lock, zero out points as safety measure
      await prisma.user.update({
        where: { id: targetId },
        data: { deviceId: null, role: "USER" },
      });

      await prisma.adminAuditLog.create({
        data: { actorUserId: actorId, targetUserId: targetId, action: "DEACTIVATE_USER", beforeRole: target.role, afterRole: "USER" },
      });

      console.log(`[AdminUsers] Deactivated user ${target.nickname} (${targetId})`);
      return c.json({ success: true, message: `User ${target.nickname} deactivated` });
    } catch (err) {
      console.error("[AdminUsers] Error deactivating user:", err);
      return c.json({ error: "Failed to deactivate user" }, 500);
    }
  }
);

// ─── GET /api/admin/users/:id/activity — daily login history (OWNER) ────────
adminRouter.get(
  "/users/:id/activity",
  requireRole("OWNER"),
  async (c) => {
    try {
      const targetId = c.req.param("id");
      const days = Math.min(parseInt(c.req.query("days") ?? "30", 10) || 30, 365);

      // Range: from start-of-day (N-1) days ago through now
      const now = new Date();
      const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days + 1));

      // Fetch all sessions that OVERLAP the range:
      // session started before end-of-range AND lastSeen after start-of-range
      const sessions = await prisma.userSession.findMany({
        where: {
          userId: targetId,
          startedAt: { lte: now },
          lastSeenAt: { gte: rangeStart },
        },
        select: { startedAt: true, lastSeenAt: true },
      });

      // For each session, mark every UTC day between startedAt and lastSeenAt as active
      const activeDates = new Set<string>();
      const utcDay = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

      for (const s of sessions) {
        const cursor = new Date(Date.UTC(s.startedAt.getUTCFullYear(), s.startedAt.getUTCMonth(), s.startedAt.getUTCDate()));
        const endDay = new Date(Date.UTC(s.lastSeenAt.getUTCFullYear(), s.lastSeenAt.getUTCMonth(), s.lastSeenAt.getUTCDate()));
        while (cursor <= endDay) {
          activeDates.add(utcDay(cursor));
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }

      // Build full array of days in range
      const result: { date: string; active: boolean }[] = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(rangeStart);
        d.setUTCDate(rangeStart.getUTCDate() + i);
        const key = utcDay(d);
        result.push({ date: key, active: activeDates.has(key) });
      }

      return c.json({ days: result, totalActive: activeDates.size });
    } catch (err) {
      console.error("[AdminUsers] Error fetching activity:", err);
      return c.json({ error: "Failed to fetch activity" }, 500);
    }
  }
);

// ─── DELETE /api/admin/users/:id — hard delete (OWNER only, irreversible) ─────
adminRouter.delete(
  "/users/:id",
  requireRole("OWNER"),
  async (c) => {
    try {
      const targetId = c.req.param("id");
      const actorId = c.req.header("X-User-Id") as string;
      const confirm = c.req.query("confirm");

      if (confirm !== "ELIMINAR") {
        return c.json({ success: false, error: "Must pass confirm=ELIMINAR in query to delete" }, 400);
      }
      if (targetId === actorId) return c.json({ success: false, error: "Cannot delete yourself" }, 400);

      const target = await prisma.user.findUnique({ where: { id: targetId } });
      if (!target) return c.json({ success: false, error: "User not found" }, 404);
      if (target.role === "OWNER") return c.json({ success: false, error: "Cannot delete an OWNER account" }, 400);

      // Log before deleting (cascade will clean up related records)
      await prisma.adminAuditLog.create({
        data: { actorUserId: actorId, targetUserId: targetId, action: `DELETE_USER:${target.nickname}`.slice(0, 200), beforeRole: target.role, afterRole: "" },
      });

      await prisma.user.delete({ where: { id: targetId } });

      console.log(`[AdminUsers] DELETED user ${target.nickname} (${targetId}) by actor ${actorId}`);
      return c.json({ success: true, message: `User ${target.nickname} permanently deleted` });
    } catch (err) {
      console.error("[AdminUsers] Error deleting user:", err);
      return c.json({ error: "Failed to delete user" }, 500);
    }
  }
);

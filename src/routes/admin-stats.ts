import { Hono } from "hono";
import { prisma } from "../prisma";

const adminStatsRouter = new Hono();

// Shared helper: resolve period filter
function periodFilter(period: string): { since: Date | undefined; df: { gte: Date } | undefined } {
  const now = new Date();
  let since: Date | undefined;

  if (period === "day") {
    const crNow = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const crDateStr = crNow.toISOString().split("T")[0];
    since = new Date(crDateStr + "T06:00:00.000Z");
  } else if (period === "week") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (period === "year") {
    since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  const df = since ? { gte: since } : undefined;
  return { since, df };
}

function requireOwner(role: string | undefined) {
  return role !== "OWNER";
}

// GET /api/admin/stats?period=day|week|month|year|all
adminStatsRouter.get("/", async (c) => {
  const requesterId = c.req.header("X-User-Id");
  if (!requesterId) return c.json({ error: "Unauthorized" }, 401);

  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    select: { role: true },
  });
  if (requireOwner(requester?.role)) return c.json({ error: "Forbidden" }, 403);

  const period = c.req.query("period") ?? "all";
  const { df } = periodFilter(period);

  const [
    nuevosUsuarios,
    visitas,
    visitasUnicasRaw,
    tiempoResult,
    devocionales,
    duelosPersona,
    duelosBot,
    estudios,
    puntosAsigResult,
    puntosConsResult,
    sobresTotal,
    sobresGratis,
    onlineUsers,
    totalUsers,
    ttsUsersRaw,
  ] = await Promise.all([
    prisma.user.count({ where: df ? { createdAt: df } : {} }),
    prisma.userSession.count({ where: df ? { startedAt: df } : {} }),
    prisma.userSession.findMany({
      where: df ? { startedAt: df } : {},
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.userSession.aggregate({
      where: df ? { startedAt: df } : {},
      _sum: { totalSeconds: true },
    }),
    prisma.devotionalCompletion.count({ where: df ? { completedAt: df } : {} }),
    prisma.duelMatch.count({
      where: { isBotMatch: false, status: "completed", ...(df ? { createdAt: df } : {}) },
    }),
    prisma.duelMatch.count({
      where: { isBotMatch: true, status: "completed", ...(df ? { createdAt: df } : {}) },
    }),
    prisma.pointLedger.count({ where: { type: "study_complete", ...(df ? { createdAt: df } : {}) } }),
    prisma.pointLedger.aggregate({
      where: { amount: { gt: 0 }, ...(df ? { createdAt: df } : {}) },
      _sum: { amount: true },
    }),
    prisma.pointLedger.aggregate({
      where: { amount: { lt: 0 }, ...(df ? { createdAt: df } : {}) },
      _sum: { amount: true },
    }),
    prisma.pointLedger.count({
      where: { type: "pack_open", ...(df ? { createdAt: df } : {}) },
    }),
    prisma.pointLedger.count({
      where: { type: "pack_open", metadata: { contains: '"free"' }, ...(df ? { createdAt: df } : {}) },
    }),
    prisma.user.findMany({
      where: { lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
      select: { id: true, nickname: true, role: true, countryCode: true, lastSeenAt: true },
      orderBy: { lastSeenAt: "desc" },
      take: 30,
    }),
    prisma.user.count(),
    // Unique users who activated TTS in the period
    prisma.appEvent.findMany({
      where: { type: "tts_used", ...(df ? { createdAt: df } : {}) },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  return c.json({
    period,
    stats: {
      nuevosUsuarios,
      totalUsers,
      visitas,
      visitasUnicas: visitasUnicasRaw.length,
      tiempoAppSeconds: tiempoResult._sum.totalSeconds ?? 0,
      devocionales,
      duelosPersona,
      duelosBot,
      estudios,
      puntosAsignados: puntosAsigResult._sum.amount ?? 0,
      puntosConsumidos: Math.abs(puntosConsResult._sum.amount ?? 0),
      sobresTotal,
      sobresGratis,
      ttsUsers: ttsUsersRaw.length,
    },
    onlineUsers,
  });
});

// GET /api/admin/stats/tabs?period=day|week|month|year|all
// Returns per-tab usage: unique users and total time spent
adminStatsRouter.get("/tabs", async (c) => {
  const requesterId = c.req.header("X-User-Id");
  if (!requesterId) return c.json({ error: "Unauthorized" }, 401);

  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    select: { role: true },
  });
  if (requireOwner(requester?.role)) return c.json({ error: "Forbidden" }, 403);

  const period = c.req.query("period") ?? "all";
  const { df } = periodFilter(period);

  const [records, ttsRecords, translatorRecords] = await Promise.all([
    prisma.appEvent.findMany({
      where: { type: "tab_time", ...(df ? { createdAt: df } : {}) },
      select: { screen: true, userId: true, seconds: true },
    }),
    prisma.appEvent.findMany({
      where: { type: "tts_used", ...(df ? { createdAt: df } : {}) },
      select: { userId: true },
    }),
    prisma.appEvent.findMany({
      where: { type: "translator_used", ...(df ? { createdAt: df } : {}) },
      select: { userId: true },
    }),
  ]);

  // Aggregate tab_time: unique users + total seconds per screen
  const agg = new Map<string, { userIds: Set<string>; totalSeconds: number }>();
  for (const r of records) {
    const entry = agg.get(r.screen) ?? { userIds: new Set<string>(), totalSeconds: 0 };
    entry.userIds.add(r.userId);
    entry.totalSeconds += r.seconds;
    agg.set(r.screen, entry);
  }

  // Collect all unique user IDs across all screens + tts + translator
  const allUserIds = new Set<string>();
  for (const data of agg.values()) {
    for (const uid of data.userIds) allUserIds.add(uid);
  }
  const ttsUserIds = new Set(ttsRecords.map((r) => r.userId));
  const translatorUserIds = new Set(translatorRecords.map((r) => r.userId));
  for (const uid of ttsUserIds) allUserIds.add(uid);
  for (const uid of translatorUserIds) allUserIds.add(uid);

  // Fetch nicknames for all users in one query
  const userRecords = await prisma.user.findMany({
    where: { id: { in: Array.from(allUserIds) } },
    select: { id: true, nickname: true },
  });
  const nicknameMap = new Map(userRecords.map((u) => [u.id, u.nickname]));

  const items: Array<{ screen: string; users: number; totalSeconds: number; userNames: string[]; isCount?: boolean }> =
    Array.from(agg.entries())
      .map(([screen, data]) => ({
        screen,
        users: data.userIds.size,
        totalSeconds: data.totalSeconds,
        userNames: Array.from(data.userIds).map((uid) => nicknameMap.get(uid) ?? uid),
      }))
      .sort((a, b) => b.users - a.users);

  // Append TTS as a count-based item
  if (ttsRecords.length > 0) {
    items.push({
      screen: "tts",
      users: ttsUserIds.size,
      totalSeconds: ttsRecords.length,
      userNames: Array.from(ttsUserIds).map((uid) => nicknameMap.get(uid) ?? uid),
      isCount: true,
    });
  }

  // Append Translator as a count-based item
  if (translatorRecords.length > 0) {
    items.push({
      screen: "translator",
      users: translatorUserIds.size,
      totalSeconds: translatorRecords.length,
      userNames: Array.from(translatorUserIds).map((uid) => nicknameMap.get(uid) ?? uid),
      isCount: true,
    });
  }

  return c.json({ period, items });
});

export { adminStatsRouter };

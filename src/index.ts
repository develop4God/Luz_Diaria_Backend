import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import "./env";
import { env, IS_PROD } from "./env";
import { prisma } from "./prisma";
import { initDatabase } from "./db-init";
import { sampleRouter } from "./routes/sample";
import { devotionalRouter } from "./routes/devotional";
import { gamificationRouter } from "./routes/gamification";
import { bibleRouter } from "./routes/bible";
import { prayerRouter } from "./routes/prayer";
import { brandingRouter } from "./routes/branding";
import { supportRouter } from "./routes/support";
import { giftsRouter } from "./routes/gifts";
import { storeGiftsRouter } from "./routes/store-gifts";
import { adminRouter } from "./routes/admin-users";
import { adminBackupRouter } from "./routes/admin-backup";
import { imageGenRouter } from "./routes/image-gen";
import { testimoniesRouter } from "./routes/testimonies";
import { translateRouter } from "./routes/translate";
import { commentsRouter } from "./routes/comments";
import { duelRouter } from "./routes/duel";
import { queueRouter } from "./routes/duel-queue";
import { adminStatsRouter } from "./routes/admin-stats";
import { metricsRouter } from "./routes/metrics";
import { startDevotionalCron } from "./cron";
import { initializeWeeklyChallenges } from "./weekly-challenges";
import { seedPromoCodes } from "./seed-promo-codes";
import { seedBadges } from "./seed-badges";
import { seedSeasons } from "./seed-seasons";
import { seedStoreItems } from "./seed-store-items";
import { runStartupSanityCheck, runDailyBackup } from "./backup-service";
import { logger } from "hono/logger";

const app = new Hono();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging
app.use("*", logger());

// Health check endpoint (includes APP_ENV so clients can verify)
app.get("/health", (c) =>
  c.json({ status: "ok", appEnv: env.APP_ENV, isProd: IS_PROD })
);

// Debug endpoint — returns environment, DB identity, and community members
// This is intentionally public (no auth) for cross-environment diagnosis
app.get("/api/debug/env", async (c) => {
  const [allUsers, communityMembers, communityTotal] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, nickname: true, role: true, communityOptIn: true, points: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { communityOptIn: true },
      select: { id: true, nickname: true },
    }),
    prisma.user.count({ where: { communityOptIn: true } }),
  ]);
  return c.json({
    backendUrl: process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.BACKEND_URL ?? "unknown",
    appEnv: env.APP_ENV,
    isProd: IS_PROD,
    databaseUrl: env.DATABASE_URL ?? "unknown",
    totalUsers: allUsers.length,
    allUsers,
    communityOptInTotal: communityTotal,
    communityNicknames: communityMembers.map((u: { nickname: string }) => u.nickname),
  });
});

// Static file serving for card images
app.use("/cards/*", serveStatic({ root: "./public" }));

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/devotional", devotionalRouter);
app.route("/api/gamification", gamificationRouter);
app.route("/api/bible", bibleRouter);
app.route("/api/prayer", prayerRouter);
app.route("/api/branding", brandingRouter);
app.route("/api/support", supportRouter);
app.route("/api/gifts", giftsRouter);
app.route("/api/store", storeGiftsRouter);
app.route("/api/admin", adminRouter);
app.route("/api/admin/backups", adminBackupRouter);
app.route("/api/admin/stats", adminStatsRouter);
app.route("/api/metrics", metricsRouter);
app.route("/api/image-gen", imageGenRouter);
app.route("/api/testimonies", testimoniesRouter);
app.route("/api/translate", translateRouter);
app.route("/api/comments", commentsRouter);
app.route("/api/duel", duelRouter);
app.route("/api/duel/queue", queueRouter);

// Bootstrap endpoint — seed the full store item catalog.
// Protected by the same hardcoded secret token.
app.post("/api/bootstrap/seed-store", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { secret } = body as { secret?: string };

  const BOOTSTRAP_SECRET = "viti-bootstrap-2026-owner";

  if (secret !== BOOTSTRAP_SECRET) {
    return c.json({ error: "Invalid secret" }, 403);
  }

  try {
    await seedStoreItems();
    const totalItems = await prisma.storeItem.count();
    console.log(`[Bootstrap] seedStoreItems complete. Total items: ${totalItems}`);
    return c.json({ success: true, totalItems });
  } catch (err) {
    console.error("[Bootstrap] seedStoreItems failed:", err);
    return c.json({ error: "Seed failed", detail: String(err) }, 500);
  }
});

// Bootstrap endpoint — promote a user to OWNER by userId or nickname.
// Protected by a hardcoded secret token.
app.post("/api/bootstrap/promote-owner", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { secret, userId, nickname } = body as { secret?: string; userId?: string; nickname?: string };

  const BOOTSTRAP_SECRET = "viti-bootstrap-2026-owner";

  if (secret !== BOOTSTRAP_SECRET) {
    return c.json({ error: "Invalid secret" }, 403);
  }

  if (!userId && !nickname) {
    return c.json({ error: "userId or nickname required" }, 400);
  }

  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findFirst({ where: { nickname } });
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "OWNER" } });

  console.log(`[Bootstrap] Promoted ${user.nickname} (${user.id}) to OWNER`);

  return c.json({ success: true, promoted: { id: user.id, nickname: user.nickname, role: "OWNER" } });
});

// Prod guard: block any request to reset/nuke endpoints
app.all("/api/admin/reset*", (c) => {
  if (IS_PROD) {
    console.error("[Guard] ⛔ Destructive reset endpoint blocked in production.");
    return c.json({ error: "Forbidden in production" }, 403);
  }
  return c.json({ error: "Not found" }, 404);
});

// Initialize DB + run startup checks + start cron
initDatabase().then(async () => {
  // Sanity check: prod will exit if tables are unexpectedly empty
  await runStartupSanityCheck();

  startDevotionalCron();
  initializeWeeklyChallenges();
  seedPromoCodes();
  seedBadges();
  seedSeasons();
  seedStoreItems().catch((err) => console.error("[Startup] seedStoreItems failed:", err));

  // Run an initial backup shortly after startup (non-blocking)
  setTimeout(async () => {
    try {
      await runDailyBackup();
    } catch (err) {
      console.error("[Startup] Failed to run initial backup:", err);
    }
  }, 30_000); // 30 seconds after startup
});

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, // 2 minutes timeout for long requests like AI generation
};

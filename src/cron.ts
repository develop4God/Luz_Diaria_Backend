import { generateDevotionalForDate, ensureDevotionalsAhead, ensureNewFormatAhead, generateNextNewFormatDevotional } from "./devotional-service";
import { generateWeeklyChallenges } from "./weekly-challenges";
import { generateTodayDailyPrayer } from "./prayer-service";
import { generateStreakSnapshots } from "./streak-snapshot-service";
import { runDailyBackup } from "./backup-service";

// Costa Rica timezone is UTC-6
// 00:00 AM Costa Rica (midnight) = 6:00 AM UTC
const CRON_HOUR_UTC = 6;
const CRON_MINUTE = 0;

// Number of historical days to seed on startup
const SEED_DAYS = 7;

let cronInterval: ReturnType<typeof setInterval> | null = null;

function getNextRunTime(): Date {
  const now = new Date();
  const next = new Date(now);

  next.setUTCHours(CRON_HOUR_UTC, CRON_MINUTE, 0, 0);

  // If we've already passed today's scheduled time, schedule for tomorrow
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}

function getCostaRicaTime(): string {
  return new Date().toLocaleString("es-CR", { timeZone: "America/Costa_Rica" });
}

async function runCronJob(): Promise<void> {
  console.log(`[Cron] Running at ${getCostaRicaTime()} (Costa Rica time)`);

  // Ensure 30-day rolling window of devotionals is always pre-generated (old format)
  try {
    await ensureDevotionalsAhead(30);
    console.log(`[Cron] ensureDevotionalsAhead(30) completed`);
  } catch (error) {
    console.error(`[Cron] Failed to ensure devotionals ahead:`, error);
  }

  // Generate exactly 1 new-format devotional per day (next after frontier)
  try {
    await generateNextNewFormatDevotional();
    console.log(`[Cron] generateNextNewFormatDevotional completed`);
  } catch (error) {
    console.error(`[Cron] Failed to generate next new-format devotional:`, error);
  }

  // Generate daily prayer (includes community prayer requests)
  try {
    await generateTodayDailyPrayer();
    console.log(`[Cron] Daily prayer generation completed successfully`);
  } catch (error) {
    console.error(`[Cron] Failed to generate daily prayer:`, error);
  }

  // Check for new week challenges every run (idempotent — skips if already created)
  try {
    await generateWeeklyChallenges();
    console.log(`[Cron] Weekly challenges check completed`);
  } catch (error) {
    console.error(`[Cron] Failed to generate weekly challenges:`, error);
  }

  // Generate daily streak snapshots for all users
  try {
    const today = new Date().toISOString().split("T")[0]!;
    await generateStreakSnapshots(today);
    console.log(`[Cron] Streak snapshots generated successfully`);
  } catch (error) {
    console.error(`[Cron] Failed to generate streak snapshots:`, error);
  }

  // Run daily backup after all other cron tasks
  try {
    await runDailyBackup();
    console.log(`[Cron] Daily backup completed successfully`);
  } catch (error) {
    console.error(`[Cron] Failed to run daily backup:`, error);
  }
}

export function startDevotionalCron(): void {
  console.log(`[Cron] Starting devotional cron job`);
  console.log(`[Cron] Scheduled to run daily at 00:00 (midnight) Costa Rica (6:00 AM UTC)`);

  const nextRun = getNextRunTime();
  const msUntilNextRun = nextRun.getTime() - Date.now();

  console.log(`[Cron] Next run scheduled for: ${nextRun.toISOString()} (${Math.round(msUntilNextRun / 1000 / 60)} minutes from now)`);

  // Set initial timeout for first run
  setTimeout(() => {
    runCronJob();

    // After first run, set up daily interval (24 hours)
    cronInterval = setInterval(runCronJob, 24 * 60 * 60 * 1000);
    console.log(`[Cron] Daily interval set up for every 24 hours`);
  }, msUntilNextRun);

  // On startup: ensure 30-day queue immediately (idempotent, non-blocking)
  console.log(`[Cron] Startup: running ensureDevotionalsAhead(30)…`);
  ensureDevotionalsAhead(30).catch((err) => {
    console.error(`[Cron] Startup ensureDevotionalsAhead failed:`, err);
  });

  // On startup: generate next new-format devotional if frontier hasn't moved today
  console.log(`[Cron] Startup: running generateNextNewFormatDevotional…`);
  generateNextNewFormatDevotional().catch((err) => {
    console.error(`[Cron] Startup generateNextNewFormatDevotional failed:`, err);
  });

  // Also seed 7 days of historical devotionals (past) in background
  seedHistoricalDevotionals();
}

async function seedHistoricalDevotionals(): Promise<void> {
  console.log(`[Seed] Starting to seed ${SEED_DAYS} days of historical devotionals...`);

  for (let i = 1; i <= SEED_DAYS; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0]!;

    try {
      console.log(`[Seed] Generating devotional for ${dateStr}...`);
      await generateDevotionalForDate(dateStr);
    } catch (error) {
      console.error(`[Seed] Failed to generate devotional for ${dateStr}:`, error);
    }
  }

  console.log(`[Seed] Historical devotional seeding completed`);
}

export function stopDevotionalCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    console.log(`[Cron] Devotional cron job stopped`);
  }
}

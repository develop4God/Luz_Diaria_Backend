import { Hono } from "hono";
import {
  generateTodayDevotional,
  generateDevotionalForDate,
  getTodayDevotional,
  getDevotionalByDate,
  getAllDevotionals,
  generateDevotionalWithAI,
  getTopicForDate,
  ensureDevotionalsAhead,
  ensureNewFormatAhead,
} from "../devotional-service";
import { prisma } from "../prisma";

// Category labels for the community prayer paragraph
const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  work:        { en: "Work and Provision", es: "Trabajo y Provisión" },
  health:      { en: "Health",              es: "Salud" },
  family:      { en: "Family",              es: "Familia" },
  peace:       { en: "Peace",               es: "Paz" },
  wisdom:      { en: "Wisdom",              es: "Sabiduría" },
  studies:     { en: "Studies",             es: "Estudios" },
  restoration: { en: "Restoration",         es: "Restauración" },
  gratitude:   { en: "Gratitude",           es: "Gratitud" },
  salvation:   { en: "Salvation",           es: "Salvación" },
  strength:    { en: "Strength",            es: "Fortaleza" },
  friend_strength: { en: "Strength for a Friend", es: "Fortaleza para un amigo" },
};

/**
 * Fetch the distinct active prayer categories (non-expired petitions)
 * and build a pastoral sentence to append to the devotional prayer.
 * Returns { en, es } or null if no active petitions.
 */
async function buildCommunityPrayerSentence(): Promise<{ en: string; es: string } | null> {
  try {
    const now = new Date();
    const activeRequests = await prisma.prayerRequest.findMany({
      where: { expiresAt: { gt: now } },
      select: { categoryKey: true },
    });

    if (activeRequests.length === 0) return null;

    // Deduplicate and sort deterministically
    const uniqueKeys = [...new Set(activeRequests.map((r) => r.categoryKey))].sort();
    if (uniqueKeys.length === 0) return null;

    const labelsEs = uniqueKeys
      .map((k) => CATEGORY_LABELS[k]?.es ?? k)
      .filter(Boolean);
    const labelsEn = uniqueKeys
      .map((k) => CATEGORY_LABELS[k]?.en ?? k)
      .filter(Boolean);

    // Build a natural list (Oxford-style)
    const joinEs = labelsEs.length === 1
      ? labelsEs[0]!
      : labelsEs.slice(0, -1).join(", ") + " y " + labelsEs[labelsEs.length - 1];
    const joinEn = labelsEn.length === 1
      ? labelsEn[0]!
      : labelsEn.slice(0, -1).join(", ") + " and " + labelsEn[labelsEn.length - 1];

    const es = `Hoy elevamos en oración a nuestra comunidad, presentando ante Dios las peticiones por ${joinEs}, confiando en que Él escucha y obra en cada corazón.`;
    const en = `Today we lift our community in prayer, presenting before God the petitions for ${joinEn}, trusting that He hears and works in every heart.`;

    return { en, es };
  } catch (err) {
    // Non-blocking — if this fails, we still return the devotional normally
    console.error("[API] Could not build community prayer sentence:", err);
    return null;
  }
}

export const devotionalRouter = new Hono();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Costa Rica today as YYYY-MM-DD — uses Intl.DateTimeFormat for correctness across DST changes on host */
function getCRToday(): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')?.value ?? '';
    const m = parts.find(p => p.type === 'month')?.value ?? '';
    const d = parts.find(p => p.type === 'day')?.value ?? '';
    const result = `${y}-${m}-${d}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(result)) return result;
  } catch {}
  // Static UTC-6 fallback (CR has no DST, so this is always correct for CR time)
  const now = new Date();
  const crMs = now.getTime() - 6 * 60 * 60 * 1000;
  const cr = new Date(crMs);
  return `${cr.getUTCFullYear()}-${String(cr.getUTCMonth() + 1).padStart(2, '0')}-${String(cr.getUTCDate()).padStart(2, '0')}`;
}

/** Returns devotional enriched with community prayer, or the plain row */
async function withCommunityPrayer(devotional: Awaited<ReturnType<typeof getDevotionalByDate>>) {
  if (!devotional) return null;
  const communityPrayer = await buildCommunityPrayerSentence();
  if (communityPrayer) {
    return {
      ...devotional,
      prayer: devotional.prayer + "\n\n" + communityPrayer.en,
      prayerEs: devotional.prayerEs + "\n\n" + communityPrayer.es,
    };
  }
  return devotional;
}

// ─── GET /api/devotional/today ─────────────────────────────────────────────
// Returns today's devotional (CR timezone). If missing, kicks off ensure-ahead
// and returns the just-generated row. Never triggers on-demand AI for the mobile.
devotionalRouter.get("/today", async (c) => {
  try {
    const today = getCRToday();
    let devotional = await getDevotionalByDate(today);

    if (!devotional) {
      // Should never happen when cron is healthy — run ensure-ahead as recovery
      console.warn(`[API] /today: devotional for ${today} missing — running ensureDevotionalsAhead`);
      await ensureDevotionalsAhead(7);
      devotional = await getDevotionalByDate(today);
    }

    if (!devotional) {
      return c.json({ error: "Failed to get devotional" }, 500);
    }

    return c.json(await withCommunityPrayer(devotional));
  } catch (error) {
    console.error("[API] Error getting today's devotional:", error);
    return c.json({ error: "Failed to get devotional" }, 500);
  }
});

// ─── GET /api/devotional?date=YYYY-MM-DD ──────────────────────────────────
// Returns devotional for a specific date. Also handles /date/:date for compat.
// If the date is within the 7-day ahead window and missing, runs ensure-ahead.
devotionalRouter.get("/", async (c) => {
  const dateParam = c.req.query("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return c.json({ error: "date query param required (YYYY-MM-DD)" }, 400);
  }
  try {
    let devotional = await getDevotionalByDate(dateParam);

    if (!devotional) {
      // If within 7-day window, try to generate it
      const today = getCRToday();
      const diffMs = new Date(dateParam).getTime() - new Date(today).getTime();
      const diffDays = Math.round(diffMs / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        console.warn(`[API] /?date=${dateParam}: missing ahead devotional — running ensureDevotionalsAhead`);
        await ensureDevotionalsAhead(7);
        devotional = await getDevotionalByDate(dateParam);
      }
    }

    if (!devotional) {
      return c.json({ error: "Devotional not found" }, 404);
    }

    return c.json(await withCommunityPrayer(devotional));
  } catch (error) {
    console.error("[API] Error getting devotional by date:", error);
    return c.json({ error: "Failed to get devotional" }, 500);
  }
});

// ─── GET /api/devotional/date/:date (compat) ──────────────────────────────
devotionalRouter.get("/date/:date", async (c) => {
  try {
    const date = c.req.param("date");
    const devotional = await getDevotionalByDate(date);

    if (!devotional) {
      return c.json({ error: "Devotional not found" }, 404);
    }

    return c.json(await withCommunityPrayer(devotional));
  } catch (error) {
    console.error("[API] Error getting devotional by date:", error);
    return c.json({ error: "Failed to get devotional" }, 500);
  }
});

// Get all devotionals (for library) — returns all including future for review
devotionalRouter.get("/all", async (c) => {
  try {
    const devotionals = await getAllDevotionals();
    return c.json(devotionals);
  } catch (error) {
    console.error("[API] Error getting all devotionals:", error);
    return c.json({ error: "Failed to get devotionals" }, 500);
  }
});

// Get upcoming devotionals (for library "Próximos" section) — date > todayCR, up to 7 days ahead
devotionalRouter.get("/upcoming", async (c) => {
  try {
    const today = getCRToday();
    const devotionals = await getAllDevotionals();
    // Return future entries with only safe metadata (no content — they're locked)
    const upcoming = devotionals
      .filter((d: { date: string }) => d.date > today)
      .slice(0, 7)
      .map((d: { date: string; topic: string; topicEs: string; imageUrl: string }) => ({
        date: d.date,
        topic: d.topic,
        topicEs: d.topicEs,
        imageUrl: d.imageUrl,
      }));
    return c.json(upcoming);
  } catch (error) {
    console.error("[API] Error getting upcoming devotionals:", error);
    return c.json({ error: "Failed to get upcoming devotionals" }, 500);
  }
});

// Generate today's devotional (can be called manually or by cron)
devotionalRouter.post("/generate/today", async (c) => {
  try {
    await generateTodayDevotional();
    const devotional = await getTodayDevotional();
    return c.json({ success: true, devotional });
  } catch (error) {
    console.error("[API] Error generating today's devotional:", error);
    return c.json({ error: "Failed to generate devotional" }, 500);
  }
});

// Generate devotional for specific date
devotionalRouter.post("/generate/:date", async (c) => {
  try {
    const date = c.req.param("date");
    await generateDevotionalForDate(date);
    const devotional = await getDevotionalByDate(date);
    return c.json({ success: true, devotional });
  } catch (error) {
    console.error("[API] Error generating devotional:", error);
    return c.json({ error: "Failed to generate devotional" }, 500);
  }
});

// Seed historical devotionals (generate for past N days)
devotionalRouter.post("/seed/:days", async (c) => {
  try {
    const days = parseInt(c.req.param("days"), 10);
    if (isNaN(days) || days < 1 || days > 30) {
      return c.json({ error: "Days must be between 1 and 30" }, 400);
    }

    const results: string[] = [];
    for (let i = 1; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0]!;

      try {
        await generateDevotionalForDate(dateStr);
        results.push(`${dateStr}: Generated`);
      } catch (err) {
        results.push(`${dateStr}: Failed - ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return c.json({ success: true, results });
  } catch (error) {
    console.error("[API] Error seeding devotionals:", error);
    return c.json({ error: "Failed to seed devotionals" }, 500);
  }
});

// Ensure N devotionals ahead (admin trigger) — idempotent, skips existing dates
devotionalRouter.post("/ensure-ahead/:days", async (c) => {
  try {
    const days = parseInt(c.req.param("days"), 10);
    if (isNaN(days) || days < 1 || days > 200) {
      return c.json({ error: "Days must be between 1 and 200" }, 400);
    }
    await ensureDevotionalsAhead(days);
    await ensureNewFormatAhead(days);
    return c.json({ success: true, message: `Ensured ${days} devotionals ahead` });
  } catch (error) {
    console.error("[API] Error ensuring devotionals ahead:", error);
    return c.json({ error: "Failed to ensure devotionals ahead" }, 500);
  }
});

// Preview endpoint — generates N stories without saving to DB
// GET /api/devotional/preview?count=5
devotionalRouter.get("/preview", async (c) => {
  const countParam = c.req.query("count");
  const count = Math.min(Math.max(parseInt(countParam ?? "1", 10) || 1, 1), 10);

  // Start from tomorrow's date and go forward
  const results: Array<{ index: number; topic: string; topicEs: string; story: string; storyEs: string; title: string; titleEs: string }> = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < count; i++) {
    const date = new Date();
    date.setDate(date.getDate() + 1 + i); // tomorrow, day after, etc.
    const dateStr = date.toISOString().split("T")[0]!;
    const topic = getTopicForDate(dateStr);

    try {
      console.log(`[Preview] Generating preview #${i + 1} — topic: ${topic.es}`);
      const content = await generateDevotionalWithAI(topic);
      results.push({
        index: i + 1,
        topic: topic.en,
        topicEs: topic.es,
        title: content.title,
        titleEs: content.titleEs,
        story: content.story,
        storyEs: content.storyEs,
      });
    } catch (err) {
      errors.push({ index: i + 1, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return c.json({ generated: results.length, errors, results });
});

// Apply a pre-committed migration file (run on PRD after deploy)
// POST /api/devotional/apply-migration
// Body: { file: "future-devotionals-2026-09-18-plus.json" } (optional, defaults to that file)
devotionalRouter.post("/apply-migration", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const filename = (body as Record<string, string>).file ?? "future-devotionals-2026-09-18-plus.json";
    const filePath = new URL(`../../migration/${filename}`, import.meta.url).pathname;

    const { readFileSync } = await import("fs");
    let raw: string;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch {
      return c.json({ error: `Migration file not found: ${filename}` }, 404);
    }

    const migration = JSON.parse(raw) as { devotionals: Array<Record<string, unknown>>; count: number; dateRange: { min: string | null; max: string | null } };
    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const d of migration.devotionals) {
      const date = d.date as string;
      if (!date) { errors.push("missing date"); continue; }
      const exists = await prisma.devotional.findUnique({ where: { date }, select: { id: true } });
      if (exists) { skipped++; continue; }
      const { id: _id, sourceKey: _sk, createdAt: _ca, updatedAt: _ua, ...fields } = d;
      try {
        await prisma.devotional.create({ data: fields as Parameters<typeof prisma.devotional.create>[0]["data"] });
        inserted++;
      } catch (err) {
        errors.push(`${date}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    const totalNow = await prisma.devotional.count();
    const maxRow = await prisma.devotional.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
    const today = new Date().toISOString().split("T")[0]!;
    const futureCount = await prisma.devotional.count({ where: { date: { gt: today } } });

    return c.json({ inserted, skipped, errors, totalInDb: totalNow, maxDate: maxRow?.date, futureCount });
  } catch (error) {
    return c.json({ error: "Failed to apply migration" }, 500);
  }
});

// Bulk upsert devotionals by date (migration/sync endpoint)
// POST /api/devotional/bulk-upsert
// Body: { devotionals: Devotional[] }
// Only inserts dates that don't exist yet (skip_existing = true by default)
devotionalRouter.post("/bulk-upsert", async (c) => {
  try {
    const body = await c.req.json();
    const items: Array<Record<string, unknown>> = body.devotionals;
    if (!Array.isArray(items)) {
      return c.json({ error: "Expected { devotionals: [] }" }, 400);
    }

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const item of items) {
      const date = item.date as string;
      if (!date) { errors.push(`Missing date on item`); continue; }
      try {
        const existing = await prisma.devotional.findUnique({ where: { date } });
        if (existing) { skipped++; continue; }
        await prisma.devotional.create({
          data: {
            date,
            title: (item.title as string) ?? "",
            bibleVerse: (item.bibleVerse as string) ?? "",
            bibleReference: (item.bibleReference as string) ?? "",
            reflection: (item.reflection as string) ?? "",
            story: (item.story as string) ?? "",
            biblicalCharacter: (item.biblicalCharacter as string) ?? "",
            application: (item.application as string) ?? "",
            prayer: (item.prayer as string) ?? "",
            topic: (item.topic as string) ?? "",
            titleEs: (item.titleEs as string) ?? "",
            bibleVerseEs: (item.bibleVerseEs as string) ?? "",
            bibleReferenceEs: (item.bibleReferenceEs as string) ?? "",
            reflectionEs: (item.reflectionEs as string) ?? "",
            storyEs: (item.storyEs as string) ?? "",
            biblicalCharacterEs: (item.biblicalCharacterEs as string) ?? "",
            applicationEs: (item.applicationEs as string) ?? "",
            prayerEs: (item.prayerEs as string) ?? "",
            topicEs: (item.topicEs as string) ?? "",
            imageUrl: (item.imageUrl as string) ?? null,
          },
        });
        inserted++;
      } catch (err) {
        errors.push(`${date}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    return c.json({ inserted, skipped, errors, total: items.length });
  } catch (error) {
    return c.json({ error: "Failed to bulk upsert" }, 500);
  }
});

// One-time reimport: deletes corrupt range and reimports from GitHub
// POST /api/devotional/admin/reimport-github
// Body: { deleteFrom: "2026-09-19", deleteTo: "2026-12-11", importDays: 140 }
devotionalRouter.post("/admin/reimport-github", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as Record<string, string | number>;
    const deleteFrom = (body.deleteFrom as string) ?? "2026-09-19";
    const deleteTo = (body.deleteTo as string) ?? "2026-12-11";
    const importDays = Number(body.importDays ?? 140);

    const deleted = await prisma.devotional.deleteMany({
      where: { date: { gte: deleteFrom, lte: deleteTo } },
    });
    console.log(`[Reimport] Deleted ${deleted.count} devotionals (${deleteFrom} → ${deleteTo})`);

    await ensureNewFormatAhead(importDays);

    const count = await prisma.devotional.count({
      where: { date: { gte: deleteFrom } },
    });
    return c.json({ deleted: deleted.count, imported: count, importDays });
  } catch (error) {
    console.error("[Reimport] Failed:", error);
    return c.json({ error: "Reimport failed" }, 500);
  }
});

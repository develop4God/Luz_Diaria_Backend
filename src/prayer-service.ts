import { prisma } from "./prisma";
import { env } from "./env";

// Prayer categories with translations (must match frontend constants)
const PRAYER_CATEGORIES: Record<string, { en: string; es: string }> = {
  work: { en: "Work / Provision", es: "Trabajo / Provisión" },
  health: { en: "Health", es: "Salud" },
  family: { en: "Family", es: "Familia" },
  peace: { en: "Peace / Anxiety", es: "Paz / Ansiedad" },
  wisdom: { en: "Wisdom / Direction", es: "Sabiduría / Dirección" },
  studies: { en: "Studies", es: "Estudios" },
  restoration: { en: "Restoration", es: "Restauración" },
  gratitude: { en: "Gratitude", es: "Gratitud" },
  salvation: { en: "Salvation", es: "Salvación" },
  strength: { en: "Strength", es: "Fortaleza" },
  friend_strength: { en: "Strength for a Friend", es: "Fortaleza para un amig@" },
};

function getCostaRicaDateString(): string {
  const now = new Date();
  const costaRicaTime = new Date(now.getTime() - (6 * 60 * 60 * 1000));
  return costaRicaTime.toISOString().split('T')[0]!;
}

interface PrayerContent {
  title: string;
  titleEs: string;
  prayerText: string;
  prayerTextEs: string;
}

async function generateDailyPrayerWithAI(
  categoryStats: Record<string, number>
): Promise<PrayerContent> {
  const categoryList = Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => {
      const cat = PRAYER_CATEGORIES[key];
      return cat ? `${cat.en} (${count})` : null;
    })
    .filter(Boolean)
    .join(", ");

  const categoryListEs = Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => {
      const cat = PRAYER_CATEGORIES[key];
      return cat ? `${cat.es} (${count})` : null;
    })
    .filter(Boolean)
    .join(", ");

  const prompt = `You are a Christian prayer writer for a Spanish-speaking community devotional app called "Luz Diaria".
Generate a warm, brief community prayer that covers the active prayer needs of the congregation today.

${categoryList ? `Active prayer categories from the community: ${categoryList}` : "No specific prayer requests today."}

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):

{
  "title": "A brief prayer title in English (3-6 words)",
  "titleEs": "Same title in Spanish",
  "prayerText": "A heartfelt community prayer in English (100-160 words). Weave each category naturally. Warm, pastoral tone. End with 'Amen.'",
  "prayerTextEs": "Same prayer in natural Latin American Spanish (not formal Castilian). End with 'Amén.'"
}

Guidelines:
- Do NOT mention any user names or nicknames
- The prayer should feel like a pastor praying over their congregation
- If no categories, write a prayer of gratitude and trust
- Keep it simple, reverent, and personal`;

  console.log(`[DailyPrayer] Generating prayer with categories: ${categoryList || 'none'}`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[DailyPrayer] OpenAI API error: ${response.status} - ${errorText}`);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const textContent = data.choices?.[0]?.message?.content ?? "";

  if (!textContent) {
    throw new Error("No text content in OpenAI response");
  }

  let cleaned = textContent.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  try {
    const content = JSON.parse(cleaned) as PrayerContent;
    console.log(`[DailyPrayer] Generated: "${content.titleEs}"`);
    return content;
  } catch (parseError) {
    console.error(`[DailyPrayer] Failed to parse JSON:`, cleaned.substring(0, 500));
    throw new Error("Failed to parse daily prayer content as JSON");
  }
}

export async function generateTodayDailyPrayer(): Promise<void> {
  const today = getCostaRicaDateString();

  const existing = await prisma.dailyPrayer.findUnique({ where: { dateId: today } });
  if (existing) {
    console.log(`[DailyPrayer] Prayer for ${today} already exists: "${existing.titleEs}"`);
    return;
  }

  // Aggregate ALL currently active petition categories (not expired)
  const now = new Date();
  const requests = await prisma.prayerRequest.findMany({
    where: { expiresAt: { gt: now } },
    select: { categoryKey: true },
  });

  const categoryStats: Record<string, number> = {};
  for (const r of requests) {
    categoryStats[r.categoryKey] = (categoryStats[r.categoryKey] ?? 0) + 1;
  }

  const includedCategories = Object.keys(categoryStats);

  try {
    const content = await generateDailyPrayerWithAI(categoryStats);

    await prisma.dailyPrayer.upsert({
      where: { dateId: today },
      update: {},
      create: {
        dateId: today,
        title: content.title,
        titleEs: content.titleEs,
        prayerText: content.prayerText,
        prayerTextEs: content.prayerTextEs,
        includedCategories: JSON.stringify(includedCategories),
        categoryStats: JSON.stringify(categoryStats),
        totalRequests: requests.length,
      },
    });

    console.log(`[DailyPrayer] Created prayer for ${today}: "${content.titleEs}" (${requests.length} petitions)`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      console.log(`[DailyPrayer] Prayer for ${today} was created by another process`);
      return;
    }
    console.error(`[DailyPrayer] Failed to generate prayer for ${today}:`, error);
    throw error;
  }
}

export async function getTodayDailyPrayer() {
  const today = getCostaRicaDateString();
  const prayer = await prisma.dailyPrayer.findUnique({ where: { dateId: today } });
  if (!prayer) return null;
  return {
    ...prayer,
    includedCategories: JSON.parse(prayer.includedCategories),
    categoryStats: JSON.parse(prayer.categoryStats),
  };
}

export async function getDailyPrayerByDate(dateId: string) {
  const prayer = await prisma.dailyPrayer.findUnique({ where: { dateId } });
  if (!prayer) return null;
  return {
    ...prayer,
    includedCategories: JSON.parse(prayer.includedCategories),
    categoryStats: JSON.parse(prayer.categoryStats),
  };
}

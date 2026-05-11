import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================
// SEASONS — 3 próximas temporadas (desde 2026-03-04)
// 1. Semana Santa   2026-03-23 → 2026-04-06
// 2. Pentecostés    2026-05-17 → 2026-05-24
// 3. Adviento       2026-11-29 → 2026-12-24
// ============================================

const SEASONS = [
  // ── 1. Semana Santa ───────────────────────────────────────────
  {
    id: "season_easter",
    name: "Semana Santa",
    startDate: new Date("2026-03-23T00:00:00.000Z"),
    endDate: new Date("2026-04-06T23:59:59.000Z"),
    priority: 10,
    storeSlot: "featured_adventure",
    bannerTitle: "Camino de la Cruz",
    bannerDescription:
      "Revive la pasión, muerte y resurrección de Cristo.",
    accentColor: "#7A1F1F",
    isActive: true,
    preview: false,
  },

  // ── 2. Pentecostés ────────────────────────────────────────────
  {
    id: "season_pentecost",
    name: "Pentecostés",
    startDate: new Date("2026-05-17T00:00:00.000Z"),
    endDate: new Date("2026-05-24T23:59:59.000Z"),
    priority: 9,
    storeSlot: "featured_store",
    bannerTitle: "Fuego del Espíritu",
    bannerDescription:
      "El Espíritu Santo desciende con poder. Celebra el nacimiento de la Iglesia.",
    accentColor: "#B84500",
    isActive: true,
    preview: false,
  },

  // ── 3. Adviento ───────────────────────────────────────────────
  {
    id: "season_advent",
    name: "Adviento",
    startDate: new Date("2026-11-29T00:00:00.000Z"),
    endDate: new Date("2026-12-24T23:59:59.000Z"),
    priority: 8,
    storeSlot: "featured_adventure",
    bannerTitle: "Espera con Fe",
    bannerDescription:
      "Cuatro semanas de esperanza, paz, gozo y amor mientras aguardamos la venida del Salvador.",
    accentColor: "#1A3A6B",
    isActive: true,
    preview: false, // only active by real date
  },
];

// ============================================
// SEASON STORE ITEMS
// ============================================

const SEASON_ITEMS = [
  // ════════════════════════════════════════
  // SEMANA SANTA — season_easter
  // ════════════════════════════════════════

  // Bundle principal
  {
    id: "bundle_easter_path",
    type: "bundle",
    nameEn: "Path of the Cross",
    nameEs: "Camino de la Cruz",
    descriptionEn: "A special Holy Week bundle with exclusive Easter rewards.",
    descriptionEs:
      "Un paquete especial de Semana Santa con recompensas exclusivas de Pascua.",
    pricePoints: 3000,
    rarity: "epic",
    assetRef: "bundle_easter_path",
    sortOrder: 1,
    available: true,
    category: "Paquetes",
    subcategory: "Aventuras",
    isNew: true,
    animationType: "glow",
    badge: "✝ Semana Santa",
    bundleId: null,
    comingSoon: false,
    seasonId: "season_easter",
    releasedAt: new Date("2026-03-10T00:00:00.000Z"),
    metadata: JSON.stringify({
      isAdventure: true,
      adventureNumber: 10,
      rewards: [
        "avatar_easter_cross_light",
        "frame_easter_resurrection",
        "title_resurrection_power",
      ],
      descriptionEn:
        "Walk the path of the Cross this Holy Week. Unlock exclusive avatar, frame and title.",
      descriptionEs:
        "Camina el sendero de la Cruz esta Semana Santa. Desbloquea avatar, marco y título exclusivos.",
    }),
  },

  // Avatar recompensa
  {
    id: "avatar_easter_cross_light",
    type: "avatar",
    nameEn: "Cross of Light",
    nameEs: "Cruz de Luz",
    descriptionEn:
      "A radiant cross bathed in resurrection light. Holy Week exclusive.",
    descriptionEs:
      "Una cruz radiante bañada en la luz de la resurrección. Exclusivo Semana Santa.",
    pricePoints: 0,
    rarity: "epic",
    assetRef: "avatar_easter_cross_light",
    sortOrder: 2,
    available: true,
    category: "Avatares",
    subcategory: "V3 Premium",
    isNew: true,
    animationType: "glow",
    badge: "✝ Semana Santa",
    bundleId: "bundle_easter_path",
    comingSoon: false,
    seasonId: "season_easter",
    releasedAt: new Date("2026-03-10T00:00:00.000Z"),
    metadata: JSON.stringify({ emoji: "✝️", illustratedStyle: "v3", color: "#C0392B" }),
  },

  // Marco recompensa
  {
    id: "frame_easter_resurrection",
    type: "frame",
    nameEn: "Resurrection Frame",
    nameEs: "Marco Resurrección",
    descriptionEn:
      "Golden frame adorned with lilies and a morning light — the symbol of the Risen Christ.",
    descriptionEs:
      "Marco dorado adornado con lirios y luz de amanecer, símbolo del Cristo Resucitado.",
    pricePoints: 0,
    rarity: "epic",
    assetRef: "frame_easter_resurrection",
    sortOrder: 3,
    available: true,
    category: "Marcos",
    subcategory: "V3 Premium",
    isNew: true,
    animationType: "sparkle",
    badge: "✝ Semana Santa",
    bundleId: "bundle_easter_path",
    comingSoon: false,
    seasonId: "season_easter",
    releasedAt: new Date("2026-03-10T00:00:00.000Z"),
    metadata: JSON.stringify({ color: "#C0392B", style: "easter_lily" }),
  },

  // Título recompensa
  {
    id: "title_resurrection_power",
    type: "title",
    nameEn: "I Am the Resurrection",
    nameEs: "Yo Soy la Resurrección",
    descriptionEn: '"I am the resurrection and the life." – John 11:25',
    descriptionEs: '"Yo soy la resurrección y la vida." – Juan 11:25',
    pricePoints: 0,
    rarity: "rare",
    assetRef: "title_resurrection_power",
    sortOrder: 4,
    available: true,
    category: "Títulos",
    subcategory: "V2 Citas Bíblicas",
    isNew: true,
    animationType: "none",
    badge: "✝ Semana Santa",
    bundleId: "bundle_easter_path",
    comingSoon: false,
    seasonId: "season_easter",
    releasedAt: new Date("2026-03-10T00:00:00.000Z"),
    metadata: JSON.stringify({
      visibleText: "Yo soy la resurrección y la vida",
      reference: "Juan 11:25",
      color: "#C0392B",
    }),
  },

  // ════════════════════════════════════════
  // PENTECOSTÉS — season_pentecost
  // ════════════════════════════════════════

  // Bundle placeholder (comingSoon)
  {
    id: "bundle_pentecost_fire",
    type: "bundle",
    nameEn: "Fire of the Spirit",
    nameEs: "Fuego del Espíritu",
    descriptionEn:
      "Receive the power from on high. Exclusive Pentecost bundle with avatar, frame and title.",
    descriptionEs:
      "Recibe el poder de lo alto. Paquete exclusivo de Pentecostés con avatar, marco y título.",
    pricePoints: 2800,
    rarity: "epic",
    assetRef: "bundle_pentecost_fire",
    sortOrder: 5,
    available: true,
    category: "Paquetes",
    subcategory: "Aventuras",
    isNew: true,
    animationType: "flame",
    badge: "🔥 Pentecostés",
    bundleId: null,
    comingSoon: true,
    seasonId: "season_pentecost",
    releasedAt: new Date("2026-05-01T00:00:00.000Z"),
    metadata: JSON.stringify({
      isAdventure: true,
      adventureNumber: 11,
      rewards: ["avatar_pentecost_flame", "frame_pentecost_tongues", "title_spirit_bearer"],
      descriptionEn: "Coming May 17 — Walk in the power of the Spirit.",
      descriptionEs: "Llega el 17 de mayo — Camina en el poder del Espíritu.",
    }),
  },

  // ════════════════════════════════════════
  // ADVIENTO — season_advent
  // ════════════════════════════════════════

  // Bundle placeholder (comingSoon)
  {
    id: "bundle_advent_light",
    type: "bundle",
    nameEn: "Light of Advent",
    nameEs: "Luz del Adviento",
    descriptionEn:
      "Four weeks of hope. Exclusive Advent bundle with avatar, frame and title.",
    descriptionEs:
      "Cuatro semanas de esperanza. Paquete exclusivo de Adviento con avatar, marco y título.",
    pricePoints: 2800,
    rarity: "epic",
    assetRef: "bundle_advent_light",
    sortOrder: 6,
    available: true,
    category: "Paquetes",
    subcategory: "Aventuras",
    isNew: true,
    animationType: "sparkle",
    badge: "🕯️ Adviento",
    bundleId: null,
    comingSoon: true,
    seasonId: "season_advent",
    releasedAt: new Date("2026-11-15T00:00:00.000Z"),
    metadata: JSON.stringify({
      isAdventure: true,
      adventureNumber: 12,
      rewards: ["avatar_advent_candle", "frame_advent_star", "title_hope_keeper"],
      descriptionEn: "Coming November 29 — Prepare your heart for Christmas.",
      descriptionEs: "Llega el 29 de noviembre — Prepara tu corazón para la Navidad.",
    }),
  },
];

// ============================================
// UPSERT HELPER (reusable for items)
// ============================================

async function upsertItem(item: (typeof SEASON_ITEMS)[number]) {
  const { releasedAt, ...rest } = item;
  return prisma.storeItem.upsert({
    where: { id: item.id },
    update: {
      nameEn: item.nameEn,
      nameEs: item.nameEs,
      descriptionEn: item.descriptionEn,
      descriptionEs: item.descriptionEs,
      pricePoints: item.pricePoints,
      rarity: item.rarity,
      assetRef: item.assetRef,
      sortOrder: item.sortOrder,
      available: item.available,
      category: item.category,
      subcategory: item.subcategory,
      isNew: item.isNew,
      animationType: item.animationType,
      badge: item.badge,
      bundleId: item.bundleId,
      comingSoon: item.comingSoon,
      seasonId: item.seasonId,
      metadata: item.metadata,
    },
    create: { ...rest, releasedAt: releasedAt ?? new Date() },
  });
}

// ============================================
// SEED FUNCTION
// ============================================

export async function seedSeasons() {
  console.log("[SeedSeasons] Starting season seed...");

  let seasonCount = 0;
  let itemCount = 0;
  let skippedSeasons = 0;
  let skippedItems = 0;

  // Seed seasons (upsert — idempotent)
  for (const season of SEASONS) {
    try {
      await prisma.season.upsert({
        where: { id: season.id },
        update: {
          name: season.name,
          startDate: season.startDate,
          endDate: season.endDate,
          priority: season.priority,
          storeSlot: season.storeSlot,
          bannerTitle: season.bannerTitle,
          bannerDescription: season.bannerDescription,
          accentColor: season.accentColor,
          isActive: season.isActive,
          preview: season.preview,
        },
        create: season,
      });
      seasonCount++;
    } catch (err) {
      console.warn(`[SeedSeasons] Skipping season ${season.id}:`, err);
      skippedSeasons++;
    }
  }

  // Seed all season items (upsert — idempotent)
  for (const item of SEASON_ITEMS) {
    try {
      await upsertItem(item);
      itemCount++;
    } catch (err) {
      console.warn(`[SeedSeasons] Skipping item ${item.id}:`, err);
      skippedItems++;
    }
  }

  console.log(
    `[SeedSeasons] Done. Seasons: ${seasonCount} (skipped: ${skippedSeasons}), Items: ${itemCount} (skipped: ${skippedItems})`
  );
  return { seasonCount, itemCount };
}

// Run directly if executed standalone
if (import.meta.main) {
  seedSeasons()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}

import { prisma } from "./prisma";

// Initial promo codes to seed
const INITIAL_PROMO_CODES = [
  { id: "fe", displayCode: "Fe", points: 250 },
  { id: "amor", displayCode: "Amor", points: 300 },
  { id: "cristo", displayCode: "Cristo", points: 5000 },
  { id: "cielo", displayCode: "Cielo", points: 10000 },
];

export async function seedPromoCodes(): Promise<void> {
  console.log("[PromoCodes] Checking and seeding initial promo codes...");

  for (const promoCode of INITIAL_PROMO_CODES) {
    try {
      // Check if code already exists
      const existing = await prisma.promoCode.findUnique({
        where: { id: promoCode.id },
      });

      if (existing) {
        console.log(`[PromoCodes] Code "${promoCode.displayCode}" already exists (${existing.points} points, ${existing.totalUses} uses)`);
        continue;
      }

      // Create new promo code
      await prisma.promoCode.create({
        data: {
          id: promoCode.id,
          displayCode: promoCode.displayCode,
          points: promoCode.points,
          isActive: true,
          maxUses: null, // Unlimited total uses
          totalUses: 0,
        },
      });

      console.log(`[PromoCodes] Created code "${promoCode.displayCode}" worth ${promoCode.points} points`);
    } catch (error) {
      console.error(`[PromoCodes] Error seeding code "${promoCode.displayCode}":`, error);
    }
  }

  console.log("[PromoCodes] Promo code seeding complete");
}

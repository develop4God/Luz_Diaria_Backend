// Batch 1 — 7 cards for Héroes de la Fe
// Cards: noe, abraham_cree, abraham_isaac, jacob, jose, moises, mar_rojo
import { writeFileSync, mkdirSync } from "fs";

const BACKEND_URL = "http://localhost:3000";
const OUTPUT_DIR = "/home/user/workspace/backend/public/cards/heroes";
mkdirSync(OUTPUT_DIR, { recursive: true });

const STYLE = `Pixar Disney cinematographic realistic style, full-body biblical character centered and fully visible, epic golden divine light from above, deep atmospheric background with particles and mystical fog, predominant blue and gold colors, centered dynamic composition, intense and determined expression, ultra high quality, ultra detailed, volumetric lighting, depth of field, spiritual heroic style, ancient biblical setting, portrait trading card format 2:3. IMPORTANT: character must be fully visible from head to toe, no body parts cut off, centered in frame with breathing room on all sides`;

const CARDS = [
  {
    id: "noe_contra_corriente",
    prompt: `Noah, a weathered righteous old man with long grey beard and simple robes, standing tall before his massive wooden ark under dark stormy clouds with divine golden light breaking through, animals walking two by two in the background, Noah's expression calm and determined in the face of ridicule, rainbow faintly visible in the stormy sky. Full body centered. ${STYLE}`,
  },
  {
    id: "abraham_cree_imposible",
    prompt: `Abraham, an elderly man with white beard and desert robes, standing alone in the desert at night looking up at a vast starry sky filled with countless bright stars, divine golden light surrounding him, his aged face filled with awe and deep faith, arms slightly raised, the infinite stars stretching above him representing God's promise. Full body centered. ${STYLE}`,
  },
  {
    id: "abraham_isaac_entrega",
    prompt: `Abraham and his young son Isaac on Mount Moriah, Abraham kneeling with arms raised toward the sky in prayer and surrender, a radiant glowing angel descending from above in brilliant golden divine light, a ram visible caught in nearby thorny bushes, Isaac standing safely beside a stone altar, both figures expressions showing awe and profound relief, dramatic divine light from heavens. Both figures fully visible. ${STYLE}`,
  },
  {
    id: "jacob_marcado_cambiar",
    prompt: `Jacob wrestling intensely with a divine angelic figure at the bank of a river at night, both locked in struggle, Jacob's torn robe and determined exhausted face, golden divine light emanating from the angel, river water shimmering in the background, dawn light beginning on the horizon, Jacob's posture showing desperate perseverance. Both figures fully visible. ${STYLE}`,
  },
  {
    id: "jose_del_pozo",
    prompt: `Young Joseph in a colorful decorated robe standing at the edge of a deep stone well in the desert, his brothers in the background plotting with jealous expressions, divine golden light shining down specifically on Joseph from above highlighting him, Joseph's face showing quiet trust despite the betrayal, Egypt's pyramids faintly visible in the far distance as a hint of his destiny. Full body centered. ${STYLE}`,
  },
  {
    id: "moises_llamado_inesperado",
    prompt: `Moses as an 80-year-old shepherd standing barefoot before a bush that burns supernaturally with brilliant golden-orange divine fire without being consumed, Moses removing his sandals in holy awe, sheep in background, Mount Horeb rugged desert landscape, divine fire illuminating his weathered face with wonder and sacred fear, staff in hand. Full body centered. ${STYLE}`,
  },
  {
    id: "mar_rojo_camino",
    prompt: `Moses standing tall with staff raised dramatically as the Red Sea parts before him, two massive towering walls of dark blue-green water held back on both sides, a clear dry path opening through the sea bed, throngs of Israelites beginning to cross behind him, a divine pillar of fire and light leading the way, Egyptian army visible in distant background. Full body centered, Moses fully visible. ${STYLE}`,
  },
];

async function generate(cardId: string, prompt: string): Promise<string | null> {
  console.log(`\n[${cardId}] Generating...`);
  const res = await fetch(`${BACKEND_URL}/api/image-gen/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size: "1024x1536", quality: "medium" }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ Error ${res.status}: ${err.slice(0, 200)}`);
    return null;
  }

  const data = await res.json() as { b64_json?: string; error?: string };
  if (data.error) { console.error(`  ✗ API error: ${data.error}`); return null; }
  return data.b64_json ?? null;
}

async function uploadToCDN(id: string, filePath: string): Promise<string> {
  const { readFileSync } = await import("fs");
  const bytes = readFileSync(filePath);
  const blob = new Blob([bytes], { type: "image/png" });
  const form = new FormData();
  form.append("file", blob, `${id}.png`);

  const res = await fetch("https://storage.vibecodeapp.com/v1/files/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new Error(`CDN upload failed: ${res.status}`);
  const json = await res.json() as { file: { url: string } };
  return json.file.url;
}

async function main() {
  const results: Record<string, string> = {};

  for (const card of CARDS) {
    const b64 = await generate(card.id, card.prompt);
    if (!b64) { console.error(`  Skipping ${card.id}`); continue; }

    const filePath = `${OUTPUT_DIR}/${card.id}.png`;
    writeFileSync(filePath, Buffer.from(b64, "base64"));
    console.log(`  ✓ Saved: ${filePath}`);

    try {
      const url = await uploadToCDN(card.id, filePath);
      results[card.id] = url;
      console.log(`  ✓ CDN: ${url}`);
    } catch (err) {
      console.error(`  ✗ CDN upload failed for ${card.id}:`, err);
    }

    // Rate limit pause
    await new Promise((r) => setTimeout(r, 500));
  }

  const outFile = `${OUTPUT_DIR}/batch1-results.json`;
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n✅ Batch 1 done! Results saved to ${outFile}`);
  console.log("Generated:", Object.keys(results).length, "/", CARDS.length, "cards");
  console.log("\nURLs to add to biblical-cards.ts:");
  for (const [id, url] of Object.entries(results)) {
    console.log(`  ${id}: "${url}"`);
  }
}

main().catch(console.error);

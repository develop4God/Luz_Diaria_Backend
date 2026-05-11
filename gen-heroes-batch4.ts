// Batch 4 — 5 cards for Héroes de la Fe (epics + legendaries + secret)
// Cards: daniel, horno_fuego, ester, nehemias, jesus_autor_fe (secret)
import { writeFileSync, mkdirSync } from "fs";

const BACKEND_URL = "http://localhost:3000";
const OUTPUT_DIR = "/home/user/workspace/backend/public/cards/heroes";
mkdirSync(OUTPUT_DIR, { recursive: true });

const STYLE = `Pixar Disney cinematographic realistic style, full-body biblical character centered and fully visible, epic golden divine light from above, deep atmospheric background with particles and mystical fog, predominant blue and gold colors, centered dynamic composition, intense and determined expression, ultra high quality, ultra detailed, volumetric lighting, depth of field, spiritual heroic style, ancient biblical setting, portrait trading card format 2:3. IMPORTANT: character must be fully visible from head to toe, no body parts cut off, centered in frame with breathing room on all sides`;

const CARDS = [
  {
    id: "daniel_fe_firme",
    prompt: `The prophet Daniel standing calmly in the center of a large stone pit surrounded by several enormous lions, the lions lying peacefully around him as if tamed, a glowing divine angel beside him with wings spread and a protective gentle glow, Daniel's posture serene and prayerful looking upward, a shaft of golden divine light descending from an opening above, ancient Babylonian stone walls. Full body centered. ${STYLE}`,
  },
  {
    id: "horno_fuego_firme",
    prompt: `Three young Hebrew men standing upright inside a blazing furnace of fire, completely unharmed, their robes and hair unsinged, a glorious fourth figure beside them radiating brilliant white and gold divine light that outshines the flames, their expressions showing absolute peace and faith, a stunned king watching through the opening in awe, flames swirling dramatically around all four figures. All figures fully visible. ${STYLE}`,
  },
  {
    id: "ester_para_este_momento",
    prompt: `Queen Esther in magnificent royal Persian robes and golden crown, standing in a grand throne room, approaching the king with absolute regal courage, the king extending his golden scepter toward her in acceptance, divine golden light shining specifically on Esther from above, her expression showing courageous determination and royal grace, opulent Persian palace columns and tapestries behind her. Full body centered. ${STYLE}`,
  },
  {
    id: "nehemias_reconstruir",
    prompt: `Nehemiah as a noble leader directing the rebuilding of Jerusalem's massive stone walls, workers building with tools and swords at their sides, Jerusalem's ruins being transformed into rising walls behind him, Nehemiah gesturing with confident leadership and faith, divine golden light pouring from above over the construction, his expression showing determined hope and purpose, ancient Middle Eastern city reconstruction scene. Full body centered. ${STYLE}`,
  },
  {
    id: "jesus_autor_fe",
    prompt: `Jesus the Messiah in glorious divine majesty, standing in radiant white and gold light at the center, his arms slightly outstretched in welcoming grace, a crown of many crowns above him, all the heroes of faith — Abraham, Moses, David, Elijah, Daniel — depicted as tiny silhouettes in the glowing background pointing toward him, transcendent divine light radiating from his figure, golden particles and heavenly atmosphere, majestic portrait composition. Full body centered. IMPORTANT: ultra divine radiance, predominant white and gold, ethereal spiritual glory, beyond earthly style, sacred and majestic, portrait trading card format 2:3, character must be fully visible from head to toe, centered with breathing room on all sides`,
  },
];

async function generate(cardId: string, prompt: string): Promise<string | null> {
  console.log(`\n[${cardId}] Generating...`);
  const res = await fetch(`${BACKEND_URL}/api/image-gen/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size: "1024x1536", quality: "high" }),
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

    await new Promise((r) => setTimeout(r, 500));
  }

  const outFile = `${OUTPUT_DIR}/batch4-results.json`;
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n✅ Batch 4 done! Results saved to ${outFile}`);
  console.log("Generated:", Object.keys(results).length, "/", CARDS.length, "cards");
  console.log("\nURLs to add to biblical-cards.ts:");
  for (const [id, url] of Object.entries(results)) {
    console.log(`  ${id}: "${url}"`);
  }
}

main().catch(console.error);

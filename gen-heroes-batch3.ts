// Batch 3 — 7 cards for Héroes de la Fe
// Cards: david_corazon, david_gigantes, elias_fuego, elias_secreto, eliseo_provee, jonas_huir, jonas_misericordia
import { writeFileSync, mkdirSync } from "fs";

const BACKEND_URL = "http://localhost:3000";
const OUTPUT_DIR = "/home/user/workspace/backend/public/cards/heroes";
mkdirSync(OUTPUT_DIR, { recursive: true });

const STYLE = `Pixar Disney cinematographic realistic style, full-body biblical character centered and fully visible, epic golden divine light from above, deep atmospheric background with particles and mystical fog, predominant blue and gold colors, centered dynamic composition, intense and determined expression, ultra high quality, ultra detailed, volumetric lighting, depth of field, spiritual heroic style, ancient biblical setting, portrait trading card format 2:3. IMPORTANT: character must be fully visible from head to toe, no body parts cut off, centered in frame with breathing room on all sides`;

const CARDS = [
  {
    id: "david_corazon_correcto",
    prompt: `Young David as a teenage shepherd boy in simple robes, sitting on a hillside playing a golden harp, sheep grazing peacefully around him, divine golden light streaming down from above illuminating him specifically among his flock, his face serene and devoted in worship, gentle rolling hills of ancient Israel, a staff lying beside him. Full body centered. ${STYLE}`,
  },
  {
    id: "david_gigantes_caen",
    prompt: `Young David, a small shepherd boy with a sling, standing defiantly before the massive armored giant Goliath, David's posture bold and unafraid, his sling raised ready to throw, Goliath towering above in full Philistine battle armor, the Israelite and Philistine armies watching from behind in the valley of Elah, divine golden light shining specifically on David, dust swirling dramatically. Both figures fully visible. ${STYLE}`,
  },
  {
    id: "elias_fuego_cielo",
    prompt: `The prophet Elijah standing on Mount Carmel with arms raised to the sky in prayer and faith, a massive column of divine fire descending from the heavens and consuming the water-soaked sacrifice on the stone altar, the 450 prophets of Baal falling back in awe and terror, Elijah's expression showing absolute confidence in God, dramatic skies with parting clouds and golden divine light. Full body centered. ${STYLE}`,
  },
  {
    id: "elias_en_secreto",
    prompt: `The exhausted prophet Elijah resting under a single leafy tree in the vast empty desert, an angel kneeling gently beside him offering a round loaf of bread and a jug of water, Elijah's face showing deep exhaustion and inner peace, soft gentle ethereal divine glow rather than dramatic fire, starry night sky above, desert stretching to the horizon, mood of tender divine care. Full body centered. ${STYLE}`,
  },
  {
    id: "eliseo_dios_provee",
    prompt: `The prophet Elisha standing in a humble stone home, extending his hand in blessing over a poor widow who is joyfully pouring oil from one small jar into many large jars, the oil miraculously multiplying and overflowing, jars filling all around the room, the widow's face showing wonder and relief, Elisha's expression showing confident faith, warm golden divine glow filling the room. Full body centered. ${STYLE}`,
  },
  {
    id: "jonas_huir_no_funciona",
    prompt: `Jonah inside the belly of a massive great fish, sitting in a dark cavernous space with bioluminescent glow, praying with hands clasped upward toward a shaft of divine light filtering through the water above, his expression showing deep repentance and renewed faith, dramatic underwater light rays, seaweed and ocean creatures visible around the edges, spiritual atmospheric scene. Full body centered. ${STYLE}`,
  },
  {
    id: "jonas_dios_misericordia",
    prompt: `The prophet Jonah standing on a hill overlooking the great city of Nineveh, the city below showing crowds of people kneeling in repentance wearing sackcloth, smoke of prayer rising from the city, divine golden light pouring down over the entire city from parting clouds above, Jonah's expression showing surprise and God's mercy prevailing, ancient Mesopotamian architecture visible. Full body centered. ${STYLE}`,
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

    await new Promise((r) => setTimeout(r, 500));
  }

  const outFile = `${OUTPUT_DIR}/batch3-results.json`;
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n✅ Batch 3 done! Results saved to ${outFile}`);
  console.log("Generated:", Object.keys(results).length, "/", CARDS.length, "cards");
  console.log("\nURLs to add to biblical-cards.ts:");
  for (const [id, url] of Object.entries(results)) {
    console.log(`  ${id}: "${url}"`);
  }
}

main().catch(console.error);

// Generates 3 test card images for Milagros de Jesús
// Run: cd /home/user/workspace/backend && bun run gen-test-cards.ts
// Images saved to: public/cards/milagros/

import { writeFileSync, mkdirSync } from "fs";

const BACKEND_URL = "http://localhost:3000";
const OUTPUT_DIR = "/home/user/workspace/backend/public/cards/milagros";

mkdirSync(OUTPUT_DIR, { recursive: true });

const STYLE = `Pixar Disney animation style, dramatic cinematic lighting, epic biblical scene, golden divine light rays, volumetric atmosphere, rich textures, semi-cartoon realistic characters, film-quality composition, vertical portrait trading card format, sacred majestic mood, highly detailed`;

const TEST_CARDS = [
  {
    id: "agua_en_vino",
    prompt: `Jesus at the wedding of Cana turning water into wine. Large stone jars glowing with red wine, servants pouring, amazed wedding guests in colorful robes watching in wonder, warm candlelit hall, golden divine light from Jesus' hands. ${STYLE}`,
  },
  {
    id: "caminar_agua",
    prompt: `Jesus walking calmly on stormy dark ocean waves at night, surrounded by divine glow, Peter sinking into the churning water reaching out his hand desperately toward Jesus, disciples watching in awe from a wooden boat tossed by waves, dramatic stormy sky with divine light breaking through. ${STYLE}`,
  },
  {
    id: "resurreccion_lazaro",
    prompt: `Lazarus emerging from a stone tomb wrapped in white burial cloths, radiant divine light pouring from the dark tomb entrance, Mary and Martha weeping with joy and shock, crowd of onlookers stepping back in awe, Jesus standing with arm raised commanding, ancient Judean landscape. ${STYLE}`,
  },
];

async function generate(cardId: string, prompt: string): Promise<string | null> {
  console.log(`\n[${cardId}] Sending request to backend...`);
  const res = await fetch(`${BACKEND_URL}/api/image-gen/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size: "1024x1536", quality: "medium" }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[${cardId}] Error ${res.status}: ${err}`);
    return null;
  }

  const data = await res.json() as { b64_json?: string; error?: string };
  if (data.error) {
    console.error(`[${cardId}] API error: ${data.error}`);
    return null;
  }
  return data.b64_json ?? null;
}

async function main() {
  console.log("=== Milagros de Jesús — 3 Test Card Images ===");
  console.log("Model: gpt-image-1.5 | Size: 1024x1536 | Quality: medium");
  console.log("Output:", OUTPUT_DIR);

  const results: Record<string, string> = {};

  for (const card of TEST_CARDS) {
    try {
      const b64 = await generate(card.id, card.prompt);
      if (b64) {
        const filePath = `${OUTPUT_DIR}/${card.id}.png`;
        writeFileSync(filePath, Buffer.from(b64, "base64"));
        results[card.id] = `/cards/milagros/${card.id}.png`;
        console.log(`[${card.id}] ✓ Saved: ${filePath}`);
      }
    } catch (e) {
      console.error(`[${card.id}] Exception:`, e);
    }
  }

  // Save results summary
  const summaryPath = `${OUTPUT_DIR}/test-results.json`;
  writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\n=== Done ===`);
  console.log(`Generated: ${Object.keys(results).length}/${TEST_CARDS.length}`);
  console.log(`Summary saved to: ${summaryPath}`);
  console.log("\nImage URLs (served by backend):");
  for (const [id, path] of Object.entries(results)) {
    console.log(`  ${id}: ${path}`);
  }
}

main().catch(console.error);

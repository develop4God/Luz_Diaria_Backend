// Batch 3 — 10 cards
import { writeFileSync, mkdirSync } from "fs";

const BACKEND_URL = "http://localhost:3000";
const OUTPUT_DIR = "/home/user/workspace/backend/public/cards/milagros";
mkdirSync(OUTPUT_DIR, { recursive: true });

const STYLE = `Pixar Disney animation style, dramatic cinematic lighting, epic biblical scene, golden divine light rays, volumetric atmosphere, rich detailed textures, semi-cartoon realistic characters, film-quality rendering, vertical portrait 2:3 trading card format, sacred majestic mood. CRITICAL: all human figures must be FULLY VISIBLE — head to toe — centered in frame with generous space around them, no body parts cropped or cut off at edges`;

const CARDS = [
  {
    id: "sordomudo",
    prompt: `Jesus standing before a man who has been deaf and mute his whole life, Jesus gently placing his fingertips on the man's ears and touching his tongue, the man's face transforming with overwhelming joy as he hears and speaks for the first time, heavenly light descending from above, amazed crowd surrounding them. Both figures fully visible from head to toe centered in frame. ${STYLE}`,
  },
  {
    id: "ciego_betsaida",
    prompt: `Jesus carefully placing both hands over a blind man's eyes outside the village of Bethsaida, the man's face bathed in golden healing light as sight slowly returns to him, gentle countryside landscape with rolling hills, disciples watching quietly in the background. Both figures completely visible, well-centered, no cropping. ${STYLE}`,
  },
  {
    id: "higuera_maldita",
    prompt: `A large fig tree dramatically withering and drying from roots to branches in seconds on a dusty road, leaves curling and falling, bark cracking, disciples watching in wide-eyed shock, Jesus walking calmly ahead with Jerusalem visible in the distance, warm golden sunlight, dusty biblical landscape. All figures fully visible. ${STYLE}`,
  },
  {
    id: "red_peces",
    prompt: `Two wooden fishing boats on a calm misty morning sea nearly capsizing under the miraculous weight of 153 large fish overflowing from their nets, disciples straining and laughing with joy, the risen Jesus standing serenely on the shore with a small fire beside him, peaceful golden dawn light reflecting on glassy water. Jesus fully visible on shore. ${STYLE}`,
  },
  {
    id: "alimenta_4000",
    prompt: `Jesus standing on a hillside at golden sunset holding up seven loaves of bread as divine light multiplies the food, thousands of people seated on the grassy hillside stretching into the distance receiving bread from disciples, baskets overflowing, epic wide composition with warm amber sky. Jesus fully visible and centered. ${STYLE}`,
  },
  {
    id: "liberacion_demonio",
    prompt: `Inside an ancient synagogue, a man violently convulsing as a dark spiritual oppression leaves him in a burst of white divine light, Jesus standing nearby with calm commanding authority, arm extended, crowd pressing back against the stone walls in shock and awe, dramatic contrast of darkness and light. Both figures fully visible. ${STYLE}`,
  },
  {
    id: "nina_resucitada",
    prompt: `Jesus tenderly holding the hand of a young girl as she rises from her bed back to life, her parents kneeling beside the bed weeping with overwhelming joy, warm golden light filling the simple stone room, Jesus smiling gently with compassion, soft miraculous atmosphere. All figures fully visible, no cropping. ${STYLE}`,
  },
  {
    id: "ciego_nacimiento",
    prompt: `A young man born blind opening his eyes for the very first time beside the Pool of Siloam, his face filled with wonder and tears of joy as radiant golden light illuminates his eyes, Jesus nearby watching with a warm smile, ancient pool with stone steps behind them, disciples watching. Both figures fully visible head to toe. ${STYLE}`,
  },
  {
    id: "hijo_viuda_nain",
    prompt: `A funeral procession on a dusty road outside the city of Nain suddenly interrupted — a young man sitting upright alive on his funeral stretcher, Jesus touching it gently, the widow mother reaching toward her son with tears of disbelief and joy, crowd frozen in stunned amazement, warm afternoon golden light. All figures fully visible. ${STYLE}`,
  },
  {
    id: "endemoniado_gadareno",
    prompt: `A wild-eyed man standing on a dramatic cliff overlooking the stormy Sea of Galilee, broken chains at his feet, his expression shifting from torment to peace as demonic oppression leaves him, a herd of pigs rushing off the cliff in the background, Jesus standing calmly before him with divine authority, epic storm sky. Both figures fully visible. ${STYLE}`,
  },
];

async function generate(cardId: string, prompt: string): Promise<string | null> {
  console.log(`\n[${cardId}] Generating...`);
  const res = await fetch(`${BACKEND_URL}/api/image-gen/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size: "1024x1536", quality: "medium" }),
  });
  if (!res.ok) { console.error(`  ✗ HTTP ${res.status}`); return null; }
  const data = await res.json() as { b64_json?: string; error?: string };
  if (data.error) { console.error(`  ✗ ${data.error}`); return null; }
  return data.b64_json ?? null;
}

async function uploadToCDN(id: string, filePath: string): Promise<string> {
  const { readFileSync } = await import("fs");
  const bytes = readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "image/png" }), `${id}.png`);
  const res = await fetch("https://storage.vibecodeapp.com/v1/files/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error(`CDN ${res.status}`);
  const data = await res.json() as { file: { url: string } };
  return data.file.url;
}

async function main() {
  console.log("=== Batch 3 — 10 cards ===");
  const results: Record<string, string> = {};
  const failed: string[] = [];

  for (const card of CARDS) {
    try {
      const b64 = await generate(card.id, card.prompt);
      if (!b64) { failed.push(card.id); continue; }
      const filePath = `${OUTPUT_DIR}/${card.id}.png`;
      writeFileSync(filePath, Buffer.from(b64, "base64"));
      const url = await uploadToCDN(card.id, filePath);
      results[card.id] = url;
      console.log(`  ✓ ${url}`);
    } catch (e) {
      console.error(`  ✗ ${card.id}: ${e}`);
      failed.push(card.id);
    }
  }

  console.log("\n=== BATCH 3 RESULTS ===");
  console.log(JSON.stringify(results, null, 2));
  if (failed.length) console.log("Failed:", failed);
  writeFileSync(`${OUTPUT_DIR}/batch3-results.json`, JSON.stringify(results, null, 2));
}

main().catch(console.error);

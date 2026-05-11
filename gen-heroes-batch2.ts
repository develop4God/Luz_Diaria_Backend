// Batch 2 — 7 cards for Héroes de la Fe
// Cards: sinai, josue, rahab, gedeon, debora, sanson, samuel
import { writeFileSync, mkdirSync } from "fs";

const BACKEND_URL = "http://localhost:3000";
const OUTPUT_DIR = "/home/user/workspace/backend/public/cards/heroes";
mkdirSync(OUTPUT_DIR, { recursive: true });

const STYLE = `Pixar Disney cinematographic realistic style, full-body biblical character centered and fully visible, epic golden divine light from above, deep atmospheric background with particles and mystical fog, predominant blue and gold colors, centered dynamic composition, intense and determined expression, ultra high quality, ultra detailed, volumetric lighting, depth of field, spiritual heroic style, ancient biblical setting, portrait trading card format 2:3. IMPORTANT: character must be fully visible from head to toe, no body parts cut off, centered in frame with breathing room on all sides`;

const CARDS = [
  {
    id: "sinai_dios_habla",
    prompt: `Moses standing on the summit of Mount Sinai holding two stone tablets, dramatic divine storm above with lightning and thick golden cloud descending, the mountain trembling and enveloped in fire and smoke, divine golden light piercing through the clouds illuminating Moses and the tablets, his expression awe-struck and reverent, ancient desert landscape below. Full body centered. ${STYLE}`,
  },
  {
    id: "josue_obediencia_ilogica",
    prompt: `Joshua standing tall before the massive walls of Jericho, priests blowing ram's horn trumpets beside him, Israelite army circling the walls, divine golden light descending from above, Joshua's face showing absolute confident faith, walls beginning to crack and crumble dramatically in the background, ancient city walls towering above. Full body centered. ${STYLE}`,
  },
  {
    id: "rahab_fe_rescata",
    prompt: `Rahab, a brave woman in ancient Canaanite robes, standing in a window of the Jericho city wall at night, a scarlet red cord hanging from the window, two Israelite scouts visible climbing safely below, a look of determined faith on her face, city of Jericho walls and torchlight behind her, stars and divine light above. Full body centered. ${STYLE}`,
  },
  {
    id: "gedeon_menos_es_mas",
    prompt: `Gideon standing heroically holding a blazing torch in one hand and a trumpet in the other, 300 warriors spread behind him with torches illuminating the night, enemy camp in the valley below in chaos and confusion, divine golden light surrounding Gideon specifically, his expression bold and victorious despite the small army, night battle scene. Full body centered. ${STYLE}`,
  },
  {
    id: "debora_liderar_fe",
    prompt: `Deborah, a majestic prophetess and judge in flowing robes, seated under a tall palm tree on an elevated throne-like seat, commanding presence with divine authority, a warrior general Barak standing behind her awaiting orders, golden divine light surrounding her, ancient Israelite landscape, her expression calm and certain with prophetic wisdom. Full body centered. ${STYLE}`,
  },
  {
    id: "sanson_fuerza_sin_control",
    prompt: `Samson, a massively strong man with very long dark hair, standing between two massive stone pillars of a great Philistine temple, pushing the pillars with both arms extended outward, the ceiling beginning to crack and crumble above him, divine supernatural strength emanating from his figure, chains broken on his wrists, dramatic collapse scene with crowd fleeing. Full body centered. ${STYLE}`,
  },
  {
    id: "samuel_habla_senor",
    prompt: `Young Samuel as a child in a long white priestly robe, kneeling on the floor of the dark temple at night beside a small oil lamp, looking up with wide eyes full of wonder and holy fear as a divine golden glow descends from above, ancient temple pillars around him, his expression showing reverent awe as he hears God's voice for the first time. Full body centered. ${STYLE}`,
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

  const outFile = `${OUTPUT_DIR}/batch2-results.json`;
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n✅ Batch 2 done! Results saved to ${outFile}`);
  console.log("Generated:", Object.keys(results).length, "/", CARDS.length, "cards");
  console.log("\nURLs to add to biblical-cards.ts:");
  for (const [id, url] of Object.entries(results)) {
    console.log(`  ${id}: "${url}"`);
  }
}

main().catch(console.error);

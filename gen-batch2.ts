// Batch 2 — 10 more cards for Milagros de Jesús
// Cards: pesca_milagrosa, sanidad_leproso, sanidad_paralitico, sanidad_centurion,
//        sanidad_suegra_pedro, mano_seca, diez_leprosos, multiplicacion_panes,
//        moneda_pez, calma_tormenta
import { writeFileSync, mkdirSync } from "fs";

const BACKEND_URL = "http://localhost:3000";
const OUTPUT_DIR = "/home/user/workspace/backend/public/cards/milagros";
mkdirSync(OUTPUT_DIR, { recursive: true });

// Key rule: full-body centered composition, no cropping of figures
const STYLE = `Pixar Disney animation style, dramatic cinematic lighting, epic biblical scene composition, golden divine light rays, volumetric atmosphere, rich textures, semi-cartoon realistic characters, film-quality rendering, vertical portrait trading card format 2:3, sacred majestic mood, highly detailed. IMPORTANT: all characters fully visible and centered in frame, no body parts cut off, wide enough framing to show complete figures with breathing room around them`;

const CARDS = [
  {
    id: "pesca_milagrosa",
    prompt: `Fishermen hauling an impossibly full fishing net bursting with silver fish from the Sea of Galilee, two wooden boats nearly sinking under the miraculous weight, Jesus standing calmly on the shore at sunrise with golden morning light behind him, disciples' faces filled with awe and wonder. All figures fully visible from head to toe with space around them. ${STYLE}`,
  },
  {
    id: "sanidad_leproso",
    prompt: `Jesus tenderly extending his hand to touch a man with leprosy kneeling before him on a dusty road, golden divine healing light radiating from Jesus' hand, the man's skin visibly being restored, small crowd watching in stunned silence in the background, warm compassionate atmosphere. Both figures fully visible and centered. ${STYLE}`,
  },
  {
    id: "sanidad_paralitico",
    prompt: `Inside a crowded home in ancient Judea, a paralyzed man on a mat being lowered through a hole in the clay roof by four friends with ropes, Jesus standing below looking up calmly surrounded by people, divine golden light streaming down through the opening, dust particles floating in the light. All figures fully visible. ${STYLE}`,
  },
  {
    id: "sanidad_centurion",
    prompt: `A Roman centurion in polished armor kneeling humbly before Jesus on a sunlit road outside the city, helmet held in his hands, head bowed in faith, Jesus looking at him with compassion and authority, golden afternoon light casting long shadows, Roman architecture in the background. Both figures fully visible from head to toe. ${STYLE}`,
  },
  {
    id: "sanidad_suegra_pedro",
    prompt: `Jesus gently taking the hand of an elderly woman lying in bed with fever, lifting her up as golden healing light flows through his touch, Peter standing nearby watching with gratitude and wonder, warm interior of a simple stone home, oil lamp flickering, tender emotional moment. All figures fully visible. ${STYLE}`,
  },
  {
    id: "mano_seca",
    prompt: `A man standing in a synagogue stretching out his miraculously healed hand, golden divine glow surrounding his restored arm, expression of joy and disbelief on his face, Jesus standing nearby with calm authority, Pharisees watching in the background with shock and indignation, ancient stone synagogue interior. All figures fully visible. ${STYLE}`,
  },
  {
    id: "diez_leprosos",
    prompt: `Ten men walking away on a dusty road through rolling hills, their bodies glowing with golden light as leprosy visibly disappears from their skin, one man turning back toward Jesus in the far distance, arms raised in gratitude, late afternoon golden sun, vast open landscape. All ten figures fully visible from head to toe. ${STYLE}`,
  },
  {
    id: "multiplicacion_panes",
    prompt: `Jesus standing on a hillside raising his hands over a small basket of five loaves of bread and two fish, golden divine light bursting upward as the food multiplies, disciples distributing bread to thousands of people seated on the grass stretching into the distance, warm sunset sky, epic wide scene. Jesus fully visible centered. ${STYLE}`,
  },
  {
    id: "moneda_pez",
    prompt: `Peter sitting on a dock pulling a large fish out of the sparkling sea, the fish's mouth open revealing a gleaming silver coin inside, Jesus standing nearby smiling gently, golden morning light reflecting off the water, fishing nets and boats in the background. Both figures fully visible. ${STYLE}`,
  },
  {
    id: "calma_tormenta",
    prompt: `Jesus standing upright in a small wooden boat on a violent stormy sea, one hand raised toward the sky as massive dark waves instantly freeze and go mirror-calm around the boat, disciples clinging to the sides in awe, dramatic sky split between storm and sudden peace, divine white light around Jesus. All figures fully visible. ${STYLE}`,
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
  const data = await res.json() as { file: { url: string } };
  return data.file.url;
}

async function main() {
  console.log("=== Milagros de Jesús — Batch 2 (10 cards) ===");
  const results: Record<string, string> = {};
  const failed: string[] = [];

  for (const card of CARDS) {
    try {
      const b64 = await generate(card.id, card.prompt);
      if (!b64) { failed.push(card.id); continue; }

      const filePath = `${OUTPUT_DIR}/${card.id}.png`;
      writeFileSync(filePath, Buffer.from(b64, "base64"));
      console.log(`  ✓ Saved locally`);

      const cdnUrl = await uploadToCDN(card.id, filePath);
      results[card.id] = cdnUrl;
      console.log(`  ✓ CDN: ${cdnUrl}`);
    } catch (e) {
      console.error(`  ✗ ${card.id}: ${e}`);
      failed.push(card.id);
    }
  }

  console.log("\n=== BATCH 2 RESULTS ===");
  console.log(JSON.stringify(results, null, 2));
  if (failed.length) console.log("Failed:", failed);

  writeFileSync(`${OUTPUT_DIR}/batch2-results.json`, JSON.stringify(results, null, 2));
}

main().catch(console.error);

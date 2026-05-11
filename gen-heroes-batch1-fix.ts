// Fix: upload already-generated images + regenerate abraham_isaac_entrega
import { writeFileSync, existsSync } from "fs";

const BACKEND_URL = "http://localhost:3000";
const OUTPUT_DIR = "/home/user/workspace/backend/public/cards/heroes";

const STYLE = `Pixar Disney cinematographic realistic style, full-body biblical character centered and fully visible, epic golden divine light from above, deep atmospheric background with particles and mystical fog, predominant blue and gold colors, centered dynamic composition, intense and determined expression, ultra high quality, ultra detailed, volumetric lighting, depth of field, spiritual heroic style, ancient biblical setting, portrait trading card format 2:3. IMPORTANT: character must be fully visible from head to toe, no body parts cut off, centered in frame with breathing room on all sides`;

const ALREADY_GENERATED = [
  "noe_contra_corriente",
  "abraham_cree_imposible",
  "jacob_marcado_cambiar",
  "jose_del_pozo",
  "moises_llamado_inesperado",
  "mar_rojo_camino",
];

const REGENERATE = [
  {
    id: "abraham_isaac_entrega",
    prompt: `Abraham and his young son Isaac on Mount Moriah, Abraham kneeling with arms raised toward the sky in prayer and surrender, a radiant glowing angel descending from above in brilliant golden divine light, a ram visible caught in nearby thorny bushes, Isaac standing safely beside a stone altar, both figures expressions showing awe and profound relief, dramatic divine light from heavens. Both figures fully visible. ${STYLE}`,
  },
];

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
  if (!res.ok) throw new Error(`CDN upload failed: ${res.status} — ${await res.text()}`);
  const data = await res.json() as { file: { url: string } };
  return data.file.url;
}

async function generate(cardId: string, prompt: string): Promise<string | null> {
  console.log(`\n[${cardId}] Generating...`);
  const res = await fetch(`${BACKEND_URL}/api/image-gen/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size: "1024x1536", quality: "medium" }),
  });
  if (!res.ok) {
    console.error(`  ✗ Error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }
  const data = await res.json() as { b64_json?: string; error?: string };
  if (data.error) { console.error(`  ✗ API error: ${data.error}`); return null; }
  return data.b64_json ?? null;
}

async function main() {
  const results: Record<string, string> = {};

  // Upload already-generated images
  console.log("=== Uploading pre-generated images ===");
  for (const id of ALREADY_GENERATED) {
    const filePath = `${OUTPUT_DIR}/${id}.png`;
    if (!existsSync(filePath)) { console.error(`  Missing: ${filePath}`); continue; }
    try {
      const url = await uploadToCDN(id, filePath);
      results[id] = url;
      console.log(`  ✓ ${id}: ${url}`);
    } catch (err) {
      console.error(`  ✗ Upload failed for ${id}:`, err);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // Regenerate and upload failed cards
  console.log("\n=== Regenerating failed cards ===");
  for (const card of REGENERATE) {
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

  writeFileSync(`${OUTPUT_DIR}/batch1-results.json`, JSON.stringify(results, null, 2));
  console.log(`\n✅ Done! ${Object.keys(results).length}/7 cards`);
  console.log("\nCopy these imageUrl values to biblical-cards.ts:");
  for (const [id, url] of Object.entries(results)) {
    console.log(`  ${id}: "${url}"`);
  }
}

main().catch(console.error);

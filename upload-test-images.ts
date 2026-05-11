// Upload the 3 test card images to storage.vibecodeapp.com
import { readFileSync } from "fs";

const IMAGES = [
  { id: "agua_en_vino", path: "public/cards/milagros/agua_en_vino.png" },
  { id: "caminar_agua", path: "public/cards/milagros/caminar_agua.png" },
  { id: "resurreccion_lazaro", path: "public/cards/milagros/resurreccion_lazaro.png" },
];

async function upload(id: string, filePath: string): Promise<string> {
  const bytes = readFileSync(filePath);
  const blob = new Blob([bytes], { type: "image/png" });
  const form = new FormData();
  form.append("file", blob, `${id}.png`);

  const res = await fetch("https://storage.vibecodeapp.com/v1/files/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed for ${id}: ${res.status} ${err}`);
  }

  const data = await res.json() as { file: { url: string; id: string } };
  return data.file.url;
}

async function main() {
  const results: Record<string, string> = {};

  for (const img of IMAGES) {
    console.log(`Uploading ${img.id}...`);
    try {
      const url = await upload(img.id, img.path);
      results[img.id] = url;
      console.log(`  ✓ ${url}`);
    } catch (e) {
      console.error(`  ✗ ${e}`);
    }
  }

  console.log("\n=== CDN URLs ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);

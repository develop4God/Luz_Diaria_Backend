#!/usr/bin/env bun
/**
 * generate-long-es.ts
 *
 * Generates longDefinitionEs for all Strong's entries that already have
 * shortDefinitionEs. Reads the English longDefinition and produces a
 * natural Spanish translation, preserving Strong ID cross-references.
 *
 * Usage:
 *   bun run generate-long-es.ts [options]
 *
 * Options:
 *   --limit <n>     Max total new entries (default: unlimited)
 *   --block <key>   Process only one block key, e.g. h_0001_1000
 *   --dry-run       Preview without writing files
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dir   = import.meta.dir;
const MOBILE  = resolve(__dir, '../mobile/src/lib/strong');
const DATA_DIR  = join(MOBILE, 'data');
const LOCALE_ES = join(MOBILE, 'locale/es');

// ─── Config ───────────────────────────────────────────────────────────────────

const API_KEY   = process.env.ANTHROPIC_API_KEY ?? '';
const BASE_URL  = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
const MODEL     = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 30; // entries per API call (long defs are short so more fits)

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const DRY_RUN    = args.includes('--dry-run');
const LIMIT      = (() => { const i = args.indexOf('--limit');  return i >= 0 ? parseInt(args[i + 1] ?? '0') : Infinity; })();
const BLOCK_ONLY = (() => { const i = args.indexOf('--block');  return i >= 0 ? args[i + 1] : null; })();

// ─── Block map ────────────────────────────────────────────────────────────────

const BLOCK_MAP = [
  { base: 'strong_h_0001_1000.json', es: 'strong_es_h_0001_1000.json', key: 'h_0001_1000' },
  { base: 'strong_h_1001_2000.json', es: 'strong_es_h_1001_2000.json', key: 'h_1001_2000' },
  { base: 'strong_h_2001_3000.json', es: 'strong_es_h_2001_3000.json', key: 'h_2001_3000' },
  { base: 'strong_h_3001_4000.json', es: 'strong_es_h_3001_4000.json', key: 'h_3001_4000' },
  { base: 'strong_h_4001_5000.json', es: 'strong_es_h_4001_5000.json', key: 'h_4001_5000' },
  { base: 'strong_h_5001_6000.json', es: 'strong_es_h_5001_6000.json', key: 'h_5001_6000' },
  { base: 'strong_h_6001_7000.json', es: 'strong_es_h_6001_7000.json', key: 'h_6001_7000' },
  { base: 'strong_h_7001_8000.json', es: 'strong_es_h_7001_8000.json', key: 'h_7001_8000' },
  { base: 'strong_h_8001_8674.json', es: 'strong_es_h_8001_8674.json', key: 'h_8001_8674' },
  { base: 'strong_g_0001_1000.json', es: 'strong_es_g_0001_1000.json', key: 'g_0001_1000' },
  { base: 'strong_g_1001_2000.json', es: 'strong_es_g_1001_2000.json', key: 'g_1001_2000' },
  { base: 'strong_g_2001_3001.json', es: 'strong_es_g_2001_3001.json', key: 'g_2001_3001' },
  { base: 'strong_g_3002_4101.json', es: 'strong_es_g_3002_4101.json', key: 'g_3002_4101' },
  { base: 'strong_g_4102_5101.json', es: 'strong_es_g_4102_5101.json', key: 'g_4102_5101' },
  { base: 'strong_g_5102_5624.json', es: 'strong_es_g_5102_5624.json', key: 'g_5102_5624' },
];

// ─── Claude API call ──────────────────────────────────────────────────────────

interface BatchEntry {
  id: string;
  shortEs: string;
  longEn: string;
}

async function generateLongBatch(entries: BatchEntry[]): Promise<Record<string, string>> {
  const payload = entries.map(e => ({
    id: e.id,
    shortEs: e.shortEs,
    longEn: e.longEn,
  }));

  const prompt = `Eres un lexicógrafo bíblico. Traduce estas definiciones largas del diccionario Strong al español.

Para cada entrada ya tienes la definición corta en español (shortEs) como referencia de vocabulario.
Traduce "longEn" (la definición larga en inglés) al español de forma natural y fiel al original.

REGLAS:
1. Mantén referencias cruzadas como "de H1234" o "de G567" tal cual (solo traduce el texto descriptivo)
2. Usa vocabulario bíblico estándar hispanohablante (RVR/NVI)
3. Traduce con naturalidad — no es traducción literal sino lexicográfica
4. Máximo 200 caracteres por longDefinitionEs
5. Si longEn es muy similar a shortEn, amplíala ligeramente con la etimología mencionada

Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "ID": "definición larga en español",
  ...
}

Entradas:
${JSON.stringify(payload, null, 2)}`;

  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 300)}`);
  }

  const result = (await res.json()) as { content: { text: string }[] };
  const text = result.content[0]?.text ?? '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON found:\n${text.slice(0, 500)}`);
  return JSON.parse(jsonMatch[0]) as Record<string, string>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Strong — Long Definition ES Generator   ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Model   : ${MODEL}`);
  console.log(`  Batch   : ${BATCH_SIZE} entries/call`);
  if (DRY_RUN)    console.log('  Mode    : DRY RUN');
  if (LIMIT !== Infinity) console.log(`  Limit   : ${LIMIT} entries`);
  if (BLOCK_ONLY) console.log(`  Block   : ${BLOCK_ONLY}`);
  console.log('');

  if (!API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  const blocks = BLOCK_ONLY
    ? BLOCK_MAP.filter(b => b.key === BLOCK_ONLY || b.key.startsWith(BLOCK_ONLY))
    : BLOCK_MAP;

  let totalGenerated = 0;
  let totalSkipped = 0;

  for (const block of blocks) {
    if (totalGenerated >= LIMIT) break;

    console.log(`\n━━ ${block.key} ━━`);

    // Load English base block
    const baseData = JSON.parse(
      readFileSync(join(DATA_DIR, block.base), 'utf-8')
    ) as Record<string, any>;

    // Load existing Spanish overlay
    const esPath = join(LOCALE_ES, block.es);
    let esData: Record<string, any> = {};
    try {
      esData = JSON.parse(readFileSync(esPath, 'utf-8'));
    } catch { /* fresh */ }

    // Find entries that have shortDefinitionEs but no longDefinitionEs
    const needsLong = Object.keys(esData).filter(id => {
      const overlay = esData[id];
      return overlay?.shortDefinitionEs && !overlay?.longDefinitionEs;
    });

    console.log(`  ${Object.keys(esData).length} entries | ${needsLong.length} need longDefinitionEs`);

    if (needsLong.length === 0) {
      console.log('  ✅ Already complete, skipping');
      continue;
    }

    const toProcess = needsLong.slice(0, Math.max(0, LIMIT - totalGenerated));
    let blockGenerated = 0;
    const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batchIds = toProcess.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const batchEntries: BatchEntry[] = batchIds
        .filter(id => baseData[id] && esData[id]?.shortDefinitionEs)
        .map(id => ({
          id,
          shortEs: esData[id].shortDefinitionEs as string,
          longEn: (baseData[id]['longDefinition'] as string) || (baseData[id]['shortDefinition'] as string) || '',
        }));

      process.stdout.write(`  Batch ${batchNum}/${totalBatches} [${batchIds[0]}…${batchIds[batchIds.length - 1]}] `);

      if (DRY_RUN) {
        console.log(`→ DRY RUN (${batchEntries.length} entries)`);
        blockGenerated += batchEntries.length;
        continue;
      }

      try {
        const generated = await generateLongBatch(batchEntries);
        let valid = 0;

        for (const [id, longEs] of Object.entries(generated)) {
          if (!longEs || typeof longEs !== 'string' || longEs.trim() === '') {
            totalSkipped++;
            continue;
          }
          const trimmed = longEs.trim().slice(0, 200);
          if (esData[id]) {
            esData[id] = { ...esData[id], longDefinitionEs: trimmed };
            valid++;
          }
        }

        blockGenerated += valid;
        totalGenerated += valid;
        console.log(`→ ✓ ${valid}/${batchEntries.length}`);

        if (i + BATCH_SIZE < toProcess.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (err) {
        console.log(`→ ✗ ${String(err).slice(0, 100)}`);
      }
    }

    // Write block
    if (!DRY_RUN && blockGenerated > 0) {
      // Sort by numeric Strong ID
      const sorted: Record<string, any> = {};
      for (const key of Object.keys(esData).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))) {
        sorted[key] = esData[key];
      }
      writeFileSync(esPath, JSON.stringify(sorted, null, 2) + '\n');
      console.log(`  💾 Saved → ${block.es}`);
    }
  }

  // Update manifest longDefinitionEs count
  if (!DRY_RUN && totalGenerated > 0) {
    const manifestPath = join(LOCALE_ES, 'manifest-es.json');
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      manifest.coverage.entriesWithLongDefinitionEs = totalGenerated;
      manifest.coverage.lastLongGeneratedAt = new Date().toISOString().slice(0, 10);
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    } catch { /* ok */ }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Coverage Report');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Generated : +${totalGenerated.toLocaleString()} longDefinitionEs entries`);
  if (totalSkipped > 0) console.log(`  Skipped   : ${totalSkipped} (empty/invalid)`);
  if (DRY_RUN) console.log('\n  ⚠️  DRY RUN — no files modified');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});

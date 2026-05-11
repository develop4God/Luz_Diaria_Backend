#!/usr/bin/env bun
/**
 * generate-strong-es.ts
 *
 * Mass generation pipeline for Spanish Strong's dictionary overlays.
 * Reads English base blocks, generates shortDefinitionEs + glossesEs via
 * Claude Haiku in batches, writes to locale/es/ JSON files.
 * Protects existing curated entries (never overwrites).
 *
 * Usage:
 *   bun run generate-strong-es.ts [options]
 *
 * Options:
 *   --limit <n>     Max total new entries to generate (default: unlimited)
 *   --block <key>   Process only a specific block key, e.g. h_0001_1000
 *   --dry-run       Preview without writing files
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dir = import.meta.dir;
const MOBILE_STRONG = resolve(__dir, '../mobile/src/lib/strong');
const DATA_DIR     = join(MOBILE_STRONG, 'data');
const LOCALE_ES    = join(MOBILE_STRONG, 'locale/es');
const ALIGN_DIR    = join(MOBILE_STRONG, 'alignment');

// ─── Config ───────────────────────────────────────────────────────────────────

const API_KEY      = process.env.ANTHROPIC_API_KEY ?? '';
const BASE_URL     = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
const MODEL        = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? 'claude-haiku-4-5-20251001';
const BATCH_SIZE   = 50; // entries per API call

// ─── CLI Args ─────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const LIMIT       = (() => { const i = args.indexOf('--limit');  return i >= 0 ? parseInt(args[i + 1] ?? '0') : Infinity; })();
const BLOCK_ONLY  = (() => { const i = args.indexOf('--block');  return i >= 0 ? args[i + 1] : null; })();

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnglishEntry {
  id: string;
  transliteration: string;
  shortDefinition: string;
  kjvRenderings: string[];
}

interface SpanishOverlay {
  shortDefinitionEs: string;
  glossesEs?: string[];
}

type BlockData = Record<string, SpanishOverlay>;

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

// ─── Occurrence counter ───────────────────────────────────────────────────────

function buildOccurrenceMap(): Map<string, number> {
  const map = new Map<string, number>();
  const files = readdirSync(ALIGN_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(ALIGN_DIR, file), 'utf-8')) as Record<string, any[]>;
    for (const verse of Object.values(data)) {
      for (const entry of verse) {
        const id = entry.strongId as string;
        map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
  }
  return map;
}

// ─── Claude API call ──────────────────────────────────────────────────────────

async function generateBatch(entries: EnglishEntry[]): Promise<Record<string, SpanishOverlay>> {
  const payload = entries.map(e => ({
    id: e.id,
    translit: e.transliteration,
    def: e.shortDefinition || e.kjvRenderings.slice(0, 4).join(', '),
    kjv: e.kjvRenderings.slice(0, 5),
  }));

  const prompt = `Eres un lexicógrafo bíblico experto en hebreo y griego bíblico. Traduce estas entradas del diccionario Strong al español para lectores de la Biblia en español.

Para cada entrada genera:
- "shortDefinitionEs": definición concisa en español (máx 75 caracteres). Termina con la transliteración entre paréntesis. Ejemplo: "padre, ancestro, fundador (ʼâb)"
- "glossesEs": array de 1-3 palabras clave en español que un lector podría buscar. Solo palabras sueltas o frases muy cortas.

REGLAS:
1. Usa vocabulario bíblico hispanohablante estándar (RVR/NVI)
2. Nombres propios: "Nombre: descripción breve (translit)"
3. Si def está vacía, usa las kjvRenderings como referencia
4. No incluyas connotaciones teológicas complejas en glossesEs
5. shortDefinitionEs debe ser autoexplicativa sin el inglés

Responde ÚNICAMENTE con JSON válido (sin markdown, sin explicaciones):
{
  "ID": { "shortDefinitionEs": "...", "glossesEs": ["..."] },
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

  // Extract JSON — model sometimes wraps in ```json
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON found in response:\n${text.slice(0, 500)}`);
  return JSON.parse(jsonMatch[0]) as Record<string, SpanishOverlay>;
}

// ─── Sort block data by numeric Strong ID ─────────────────────────────────────

function sortBlock(data: BlockData): BlockData {
  const sorted: BlockData = {};
  for (const key of Object.keys(data).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))) {
    const entry = data[key];
    if (entry) sorted[key] = entry;
  }
  return sorted;
}

// ─── Update manifest ──────────────────────────────────────────────────────────

function updateManifest(): void {
  const TOTAL = 14197;
  let totalEs = 0;
  const blocks: any[] = [];

  for (const block of BLOCK_MAP) {
    let count = 0;
    try {
      const data = JSON.parse(readFileSync(join(LOCALE_ES, block.es), 'utf-8')) as BlockData;
      count = Object.keys(data).length;
    } catch { /* block may not exist */ }

    // Build human-readable range label
    const rangeParts = block.key.split('_');
    const lang = (rangeParts[0] ?? 'H').toUpperCase();
    const from = parseInt(rangeParts[1] ?? '0');
    const to   = parseInt(rangeParts[2] ?? '0');
    blocks.push({ file: block.es, range: `${lang}${from}–${lang}${to}`, entries: count });
    totalEs += count;
  }

  const manifest = {
    _comment: 'Coverage manifest for the Spanish locale overlay. Auto-generated — do not edit by hand.',
    generatedAt: new Date().toISOString().slice(0, 10),
    totalStrongEntries: TOTAL,
    blocks,
    coverage: {
      entriesWithShortDefinitionEs: totalEs,
      entriesWithLongDefinitionEs: 0,
      entriesWithGlossesEs: totalEs,
      entriesEnglishOnly: TOTAL - totalEs,
      percentageWithSpanish: `${((totalEs / TOTAL) * 100).toFixed(1)}%`,
      note: 'Coverage grows by adding entries to the JSON block files — no code changes required.',
    },
  };

  writeFileSync(join(LOCALE_ES, 'manifest-es.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n📄 Manifest updated → ${manifest.coverage.percentageWithSpanish} coverage (${totalEs}/${TOTAL} entries)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Strong ES Generator — mass localization  ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Model   : ${MODEL}`);
  console.log(`  Batch   : ${BATCH_SIZE} entries/call`);
  if (DRY_RUN)    console.log('  Mode    : DRY RUN (no files written)');
  if (LIMIT !== Infinity) console.log(`  Limit   : ${LIMIT} entries`);
  if (BLOCK_ONLY) console.log(`  Block   : ${BLOCK_ONLY}`);
  console.log('');

  if (!API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY is not set');
    process.exit(1);
  }

  // Build occurrence map
  console.log('📊 Loading alignment data...');
  const occurrences = buildOccurrenceMap();
  console.log(`   ${occurrences.size} unique Strong IDs found in alignment data\n`);

  const blocks = BLOCK_ONLY
    ? BLOCK_MAP.filter(b => b.key === BLOCK_ONLY || b.key.startsWith(BLOCK_ONLY))
    : BLOCK_MAP;

  let totalGenerated = 0;
  let totalSkipped   = 0;
  const coverageBefore = { total: 0, withEs: 0 };
  const coverageAfter  = { total: 0, withEs: 0 };

  for (const block of blocks) {
    if (totalGenerated >= LIMIT) break;

    console.log(`\n━━ ${block.key} ━━`);

    // Load English base block
    const baseData = JSON.parse(
      readFileSync(join(DATA_DIR, block.base), 'utf-8')
    ) as Record<string, any>;

    // Load existing Spanish overlay
    const esPath = join(LOCALE_ES, block.es);
    let esData: BlockData = {};
    try {
      esData = JSON.parse(readFileSync(esPath, 'utf-8')) as BlockData;
    } catch { /* fresh start */ }

    const allIds     = Object.keys(baseData);
    const missingIds = allIds.filter(id => !esData[id]);

    coverageBefore.total  += allIds.length;
    coverageBefore.withEs += allIds.length - missingIds.length;

    console.log(`  ${allIds.length} total | ${allIds.length - missingIds.length} translated | ${missingIds.length} missing`);

    if (missingIds.length === 0) {
      console.log('  ✅ Fully translated, skipping');
      coverageAfter.total  += allIds.length;
      coverageAfter.withEs += allIds.length;
      continue;
    }

    // Sort by occurrence frequency (most-used first)
    missingIds.sort((a, b) => (occurrences.get(b) ?? 0) - (occurrences.get(a) ?? 0));

    const toProcess = missingIds.slice(0, Math.max(0, LIMIT - totalGenerated));
    const topFreq   = toProcess.slice(0, 5).map(id => `${id}(×${occurrences.get(id) ?? 0})`).join(' ');
    console.log(`  Processing ${toProcess.length} entries | Top freq: ${topFreq}`);

    let blockGenerated = 0;
    const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batchIds     = toProcess.slice(i, i + BATCH_SIZE);
      const batchNum     = Math.floor(i / BATCH_SIZE) + 1;
      const batchEntries: EnglishEntry[] = batchIds
        .filter(id => baseData[id] != null)
        .map(id => {
          const e = baseData[id] as Record<string, any>;
          return {
            id,
            transliteration: (e['transliteration'] as string) ?? '',
            shortDefinition: (e['shortDefinition'] as string) ?? '',
            kjvRenderings:   Array.isArray(e['kjvRenderings']) ? (e['kjvRenderings'] as string[]) : [],
          };
        });

      process.stdout.write(`  Batch ${batchNum}/${totalBatches} [${batchIds[0]}…${batchIds[batchIds.length - 1]}] `);

      if (DRY_RUN) {
        console.log(`→ DRY RUN (${batchEntries.length} entries)`);
        blockGenerated += batchEntries.length;
        continue;
      }

      try {
        const generated = await generateBatch(batchEntries);
        let valid = 0;

        for (const [id, overlay] of Object.entries(generated)) {
          if (!overlay.shortDefinitionEs || overlay.shortDefinitionEs.trim() === '') {
            totalSkipped++;
            continue;
          }
          // Trim long definitions
          if (overlay.shortDefinitionEs.length > 120) {
            overlay.shortDefinitionEs = overlay.shortDefinitionEs.slice(0, 117) + '…';
          }
          // Ensure glossesEs is a proper array
          if (!Array.isArray(overlay.glossesEs) || overlay.glossesEs.length === 0) {
            overlay.glossesEs = [(overlay.shortDefinitionEs.split(/[,;(]/)[0] ?? overlay.shortDefinitionEs).trim().toLowerCase()];
          }
          esData[id] = { shortDefinitionEs: overlay.shortDefinitionEs, glossesEs: overlay.glossesEs };
          valid++;
        }

        blockGenerated  += valid;
        totalGenerated  += valid;
        console.log(`→ ✓ ${valid}/${batchEntries.length}`);

        // Polite pause between batches
        if (i + BATCH_SIZE < toProcess.length) {
          await new Promise(r => setTimeout(r, 400));
        }
      } catch (err) {
        console.log(`→ ✗ ${String(err).slice(0, 100)}`);
        // Continue to next batch
      }
    }

    // Write block
    if (!DRY_RUN && blockGenerated > 0) {
      const sorted = sortBlock(esData);
      writeFileSync(esPath, JSON.stringify(sorted, null, 2) + '\n');
      console.log(`  💾 Saved ${Object.keys(sorted).length} entries → ${block.es}`);
    }

    coverageAfter.total  += allIds.length;
    coverageAfter.withEs += (allIds.length - missingIds.length) + blockGenerated;
  }

  // Update manifest
  if (!DRY_RUN && totalGenerated > 0) {
    updateManifest();
  }

  // Final report
  const pct = (a: number, b: number) => b === 0 ? '0.0' : ((a / b) * 100).toFixed(1);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Coverage Report');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Before : ${coverageBefore.withEs.toLocaleString()} / ${coverageBefore.total.toLocaleString()} entries (${pct(coverageBefore.withEs, coverageBefore.total)}%)`);
  console.log(`  After  : ${coverageAfter.withEs.toLocaleString()} / ${coverageAfter.total.toLocaleString()} entries (${pct(coverageAfter.withEs, coverageAfter.total)}%)`);
  console.log(`  Added  : +${totalGenerated.toLocaleString()} new Spanish entries`);
  if (totalSkipped > 0) console.log(`  Skipped: ${totalSkipped} (empty/invalid)`);
  if (DRY_RUN) console.log('\n  ⚠️  DRY RUN — no files were modified');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});

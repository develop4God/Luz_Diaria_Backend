#!/usr/bin/env bun
/**
 * generate-strong-long-es.ts
 *
 * Generates longDefinitionEs for Strong's entries that appear in the
 * alignment data (i.e., words users can actually tap in the Bible reader).
 *
 * Produces a 2–4 sentence paragraph in Spanish explaining etymology,
 * biblical usage, and theological significance of each word.
 *
 * Usage:
 *   bun run generate-strong-long-es.ts [--dry-run] [--limit <n>]
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// ─── Paths ─────────────────────────────────────────────────────────────────────

const __dir     = import.meta.dir;
const MOBILE_STRONG = resolve(__dir, '../mobile/src/lib/strong');
const DATA_DIR  = join(MOBILE_STRONG, 'data');
const LOCALE_ES = join(MOBILE_STRONG, 'locale/es');
const ALIGN_DIR = join(MOBILE_STRONG, 'alignment');

// ─── Config ────────────────────────────────────────────────────────────────────

const API_KEY  = process.env.ANTHROPIC_API_KEY ?? '';
const BASE_URL = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
const MODEL    = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? 'claude-haiku-4-5-20251001';
const BATCH    = 20; // smaller batches since longDef is larger text

// ─── CLI ───────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT   = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i + 1] ?? '0') : Infinity; })();

// ─── Block map (same as generate-strong-es.ts) ────────────────────────────────

const BLOCK_MAP = [
  { base: 'strong_h_0001_1000.json', es: 'strong_es_h_0001_1000.json' },
  { base: 'strong_h_1001_2000.json', es: 'strong_es_h_1001_2000.json' },
  { base: 'strong_h_2001_3000.json', es: 'strong_es_h_2001_3000.json' },
  { base: 'strong_h_3001_4000.json', es: 'strong_es_h_3001_4000.json' },
  { base: 'strong_h_4001_5000.json', es: 'strong_es_h_4001_5000.json' },
  { base: 'strong_h_5001_6000.json', es: 'strong_es_h_5001_6000.json' },
  { base: 'strong_h_6001_7000.json', es: 'strong_es_h_6001_7000.json' },
  { base: 'strong_h_7001_8000.json', es: 'strong_es_h_7001_8000.json' },
  { base: 'strong_h_8001_8674.json', es: 'strong_es_h_8001_8674.json' },
  { base: 'strong_g_0001_1000.json', es: 'strong_es_g_0001_1000.json' },
  { base: 'strong_g_1001_2000.json', es: 'strong_es_g_1001_2000.json' },
  { base: 'strong_g_2001_3001.json', es: 'strong_es_g_2001_3001.json' },
  { base: 'strong_g_3002_4101.json', es: 'strong_es_g_3002_4101.json' },
  { base: 'strong_g_4102_5101.json', es: 'strong_es_g_4102_5101.json' },
  { base: 'strong_g_5102_5624.json', es: 'strong_es_g_5102_5624.json' },
];

// ─── Load all English base data into memory ───────────────────────────────────

function loadAllEnglish(): Map<string, any> {
  const map = new Map<string, any>();
  for (const block of BLOCK_MAP) {
    try {
      const data = JSON.parse(readFileSync(join(DATA_DIR, block.base), 'utf-8')) as Record<string, any>;
      for (const [id, entry] of Object.entries(data)) {
        map.set(id, { ...entry, _blockEs: block.es });
      }
    } catch { /* skip missing */ }
  }
  return map;
}

// ─── Load all Spanish overlays into memory ────────────────────────────────────

function loadAllSpanish(): Map<string, Record<string, any>> {
  const map = new Map<string, Record<string, any>>();
  for (const block of BLOCK_MAP) {
    try {
      const data = JSON.parse(readFileSync(join(LOCALE_ES, block.es), 'utf-8')) as Record<string, any>;
      map.set(block.es, data);
    } catch {
      map.set(block.es, {});
    }
  }
  return map;
}

// ─── Find Strong IDs that appear in alignment files ───────────────────────────

function getAlignmentIds(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const f of readdirSync(ALIGN_DIR).filter(f => f.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(join(ALIGN_DIR, f), 'utf-8')) as Record<string, any[]>;
    for (const links of Object.values(data)) {
      for (const link of links) {
        if (link?.strongId) counts.set(link.strongId, (counts.get(link.strongId) ?? 0) + 1);
      }
    }
  }
  return counts;
}

// ─── Claude API call for long definitions ─────────────────────────────────────

interface LongDefEntry {
  id: string;
  lemma: string;
  translit: string;
  shortEs: string;
  shortEn: string;
  longEn: string;
}

async function generateLongBatch(entries: LongDefEntry[]): Promise<Record<string, string>> {
  const payload = entries.map(e => ({
    id:       e.id,
    lemma:    e.lemma,
    translit: e.translit,
    shortEs:  e.shortEs,
    shortEn:  e.shortEn,
    longEn:   e.longEn.slice(0, 300), // cap source length
  }));

  const prompt = `Eres un teólogo y lexicógrafo bíblico experto en hebreo y griego bíblico. Escribe definiciones largas en español para estas palabras del diccionario Strong, destinadas a lectores hispanohablantes de la Biblia.

Para cada entrada genera un "longDefinitionEs": UN PÁRRAFO de 2–4 oraciones en español que explique:
1. El significado y etimología de la palabra
2. Cómo se usa en el contexto bíblico (una o dos referencias típicas si aplica)
3. Su significado teológico o espiritual si es relevante

REGLAS:
- Máximo 350 caracteres por entrada
- Usa vocabulario bíblico hispanohablante (Reina-Valera/NVI)
- Puedes mencionar la transliteración entre paréntesis
- Sé preciso pero accesible para un lector general
- No repitas la definición corta (shortEs) tal cual — amplíala
- No uses formato de lista, solo párrafo continuo
- Responde ÚNICAMENTE con JSON válido (sin markdown):

{ "ID": "definición larga en español...", ... }

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
  const text   = result.content[0]?.text ?? '';
  const match  = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in response:\n${text.slice(0, 400)}`);
  return JSON.parse(match[0]) as Record<string, string>;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Strong Long Definition Generator (Spanish)  ');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (DRY_RUN) console.log('  Mode: DRY RUN');
  if (LIMIT !== Infinity) console.log(`  Limit: ${LIMIT}`);
  console.log('');

  if (!API_KEY) { console.error('❌ ANTHROPIC_API_KEY not set'); process.exit(1); }

  console.log('📊 Loading alignment data...');
  const alignIds = getAlignmentIds();
  console.log(`   ${alignIds.size} unique Strong IDs in alignment\n`);

  console.log('📚 Loading English base data...');
  const englishData = loadAllEnglish();
  console.log(`   ${englishData.size} entries loaded\n`);

  console.log('🌐 Loading Spanish overlays...');
  const spanishBlocks = loadAllSpanish();

  // Build candidate list: ALL entries without longDefinitionEs, sorted by alignment frequency
  const candidates: { id: string; freq: number }[] = [];
  for (const [id, en] of englishData) {
    const blockEs = (en as any)._blockEs as string | undefined;
    if (!blockEs) continue;
    const esBlock = spanishBlocks.get(blockEs);
    const existing = esBlock?.[id] as any;
    // Skip if longDefinitionEs already set
    if (existing?.longDefinitionEs && String(existing.longDefinitionEs).trim()) continue;
    candidates.push({ id, freq: alignIds.get(id) ?? 0 });
  }
  // Most-used words first, then alphabetical for consistent ordering
  candidates.sort((a, b) => b.freq - a.freq || a.id.localeCompare(b.id));

  const toProcess = candidates.slice(0, Math.min(candidates.length, LIMIT));
  console.log(`🎯 Entries to generate: ${toProcess.length} (${candidates.length - toProcess.length} already done)\n`);

  if (toProcess.length === 0) {
    console.log('✅ All alignment entries already have longDefinitionEs!');
    return;
  }

  let totalGenerated = 0;

  for (let i = 0; i < toProcess.length; i += BATCH) {
    const batch = toProcess.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(toProcess.length / BATCH);

    // Build batch entries
    const entries: LongDefEntry[] = batch
      .map(({ id }) => {
        const en = englishData.get(id) as Record<string, any> | undefined;
        if (!en) return null;
        const blockEs = en._blockEs as string;
        const esEntry = spanishBlocks.get(blockEs)?.[id] as Record<string, any> | undefined;
        return {
          id,
          lemma:    String(en.lemmaOriginal ?? ''),
          translit: String(en.transliteration ?? ''),
          shortEs:  String(esEntry?.shortDefinitionEs ?? ''),
          shortEn:  String(en.shortDefinition ?? ''),
          longEn:   String(en.longDefinition ?? en.shortDefinition ?? ''),
        } as LongDefEntry;
      })
      .filter(Boolean) as LongDefEntry[];

    const ids = entries.map(e => e.id);
    process.stdout.write(`Batch ${batchNum}/${totalBatches} [${ids[0]}…${ids[ids.length - 1]}] (×${batch[0]?.freq ?? 0} freq) `);

    if (DRY_RUN) {
      console.log(`→ DRY RUN (${entries.length} entries)`);
      totalGenerated += entries.length;
      continue;
    }

    try {
      const generated = await generateLongBatch(entries);
      let valid = 0;

      for (const [id, longDef] of Object.entries(generated)) {
        if (!longDef || String(longDef).trim().length < 20) continue;

        const en     = englishData.get(id) as Record<string, any> | undefined;
        if (!en) continue;
        const blockEs = en._blockEs as string;
        const esBlock = spanishBlocks.get(blockEs);
        if (!esBlock) continue;

        const current = (esBlock[id] as Record<string, any>) ?? {};
        esBlock[id] = {
          ...current,
          longDefinitionEs: String(longDef).slice(0, 400),
        };
        valid++;
      }

      totalGenerated += valid;
      console.log(`→ ✓ ${valid}/${entries.length}`);

      // Write updated blocks to disk after each batch
      const touchedBlocks = new Set(entries.map(e => {
        const en = englishData.get(e.id) as Record<string, any> | undefined;
        return en?._blockEs as string | undefined;
      }).filter(Boolean) as string[]);

      for (const blockEs of touchedBlocks) {
        const data = spanishBlocks.get(blockEs);
        if (data) {
          writeFileSync(join(LOCALE_ES, blockEs), JSON.stringify(data, null, 2) + '\n');
        }
      }

      // Polite pause
      if (i + BATCH < toProcess.length) await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.log(`→ ✗ ${String(err).slice(0, 120)}`);
    }
  }

  console.log(`\n✅ Done! Generated ${totalGenerated} longDefinitionEs entries`);
  if (DRY_RUN) console.log('   (DRY RUN — no files written)');
}

main().catch(err => { console.error('\n❌ Fatal:', err); process.exit(1); });

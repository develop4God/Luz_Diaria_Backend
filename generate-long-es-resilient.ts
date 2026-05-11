#!/usr/bin/env bun
/**
 * generate-long-es-resilient.ts
 *
 * Resilient version: writes to disk after EVERY batch (not end-of-block),
 * retries on rate-limit/overload with exponential backoff, and logs to file.
 *
 * Usage:
 *   bun run generate-long-es-resilient.ts >> /tmp/strongs-gen.log 2>&1 &
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, resolve } from 'path';

const __dir   = import.meta.dir;
const MOBILE  = resolve(__dir, '../mobile/src/lib/strong');
const DATA_DIR  = join(MOBILE, 'data');
const LOCALE_ES = join(MOBILE, 'locale/es');
const LOG_FILE  = '/tmp/strongs-gen.log';

const API_KEY  = process.env.ANTHROPIC_API_KEY ?? '';
const BASE_URL = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com';
const MODEL    = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 30;

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

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch { /* ignore */ }
}

interface BatchEntry { id: string; shortEs: string; longEn: string; }

async function generateLongBatch(entries: BatchEntry[], attempt = 1): Promise<Record<string, string>> {
  const payload = entries.map(e => ({ id: e.id, shortEs: e.shortEs, longEn: e.longEn }));
  const prompt = `Eres un lexicógrafo bíblico. Traduce estas definiciones largas del diccionario Strong al español.

Para cada entrada ya tienes la definición corta en español (shortEs) como referencia.
Traduce "longEn" (la definición larga en inglés) al español de forma natural y fiel al original.

REGLAS:
1. Mantén referencias cruzadas como "de H1234" o "de G567" tal cual
2. Usa vocabulario bíblico estándar hispanohablante (RVR/NVI)
3. Máximo 200 caracteres por longDefinitionEs
4. Si longEn es muy similar a shortEn, amplíala con la etimología mencionada

Responde ÚNICAMENTE con JSON válido (sin markdown):
{"ID": "definición larga en español", ...}

Entradas:
${JSON.stringify(payload, null, 2)}`;

  const res = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
  });

  // Rate limit / overload — exponential backoff up to 5 attempts
  if (res.status === 429 || res.status === 529 || res.status === 503) {
    if (attempt >= 5) throw new Error(`Rate limit after 5 retries (${res.status})`);
    const wait = Math.min(60000, 5000 * Math.pow(2, attempt - 1));
    log(`  ⏳ Rate limit (${res.status}), waiting ${(wait/1000).toFixed(0)}s… (attempt ${attempt}/5)`);
    await new Promise(r => setTimeout(r, wait));
    return generateLongBatch(entries, attempt + 1);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const result = (await res.json()) as { content: { text: string }[] };
  const text = result.content[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]) as Record<string, string>;
}

function saveBlock(esPath: string, esData: Record<string, any>) {
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(esData).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))) {
    sorted[key] = esData[key];
  }
  writeFileSync(esPath, JSON.stringify(sorted, null, 2) + '\n');
}

async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('  Strong — Long Definition ES (resilient)  ');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`  Model: ${MODEL} | Batch: ${BATCH_SIZE}`);

  if (!API_KEY) { log('❌ ANTHROPIC_API_KEY not set'); process.exit(1); }

  let totalGenerated = 0;
  let grandTotal = 0;
  let grandDone = 0;

  // Count totals upfront
  for (const block of BLOCK_MAP) {
    const esPath = join(LOCALE_ES, block.es);
    try {
      const esData = JSON.parse(readFileSync(esPath, 'utf-8'));
      const keys = Object.keys(esData);
      grandTotal += keys.length;
      grandDone += keys.filter(k => esData[k]?.longDefinitionEs).length;
    } catch { /* skip */ }
  }
  log(`  Progress at start: ${grandDone}/${grandTotal} (${(grandDone/grandTotal*100).toFixed(1)}%)`);
  log('');

  for (const block of BLOCK_MAP) {
    log(`━━ Block: ${block.key} ━━`);

    const baseData = JSON.parse(readFileSync(join(DATA_DIR, block.base), 'utf-8')) as Record<string, any>;
    const esPath = join(LOCALE_ES, block.es);
    let esData: Record<string, any> = {};
    try { esData = JSON.parse(readFileSync(esPath, 'utf-8')); } catch { /* fresh */ }

    const needsLong = Object.keys(esData).filter(id => {
      const overlay = esData[id];
      return overlay?.shortDefinitionEs && !overlay?.longDefinitionEs;
    });

    log(`  ${Object.keys(esData).length} entries | ${needsLong.length} need longDefinitionEs`);

    if (needsLong.length === 0) { log('  ✅ Complete, skipping'); continue; }

    const totalBatches = Math.ceil(needsLong.length / BATCH_SIZE);
    let blockGenerated = 0;

    for (let i = 0; i < needsLong.length; i += BATCH_SIZE) {
      const batchIds = needsLong.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const batchEntries: BatchEntry[] = batchIds
        .filter(id => baseData[id] && esData[id]?.shortDefinitionEs)
        .map(id => ({
          id,
          shortEs: esData[id].shortDefinitionEs as string,
          longEn: (baseData[id]['longDefinition'] as string) || (baseData[id]['shortDefinition'] as string) || '',
        }));

      try {
        const generated = await generateLongBatch(batchEntries);
        let valid = 0;
        for (const [id, longEs] of Object.entries(generated)) {
          if (!longEs || typeof longEs !== 'string' || longEs.trim() === '') continue;
          if (esData[id]) { esData[id] = { ...esData[id], longDefinitionEs: longEs.trim().slice(0, 200) }; valid++; }
        }
        blockGenerated += valid;
        totalGenerated += valid;

        // ── Write to disk after EVERY batch ──
        saveBlock(esPath, esData);

        const overallDone = grandDone + totalGenerated;
        const pct = (overallDone / grandTotal * 100).toFixed(1);
        log(`  Batch ${batchNum}/${totalBatches} → ✓ ${valid}/${batchEntries.length} | total ${overallDone}/${grandTotal} (${pct}%)`);

        // Small pause between batches
        if (i + BATCH_SIZE < needsLong.length) await new Promise(r => setTimeout(r, 350));

      } catch (err) {
        log(`  Batch ${batchNum}/${totalBatches} → ✗ ${String(err).slice(0, 120)}`);
        // Brief pause before continuing to next batch
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    log(`  Block ${block.key} done: +${blockGenerated} entries`);
  }

  // Update manifest
  const manifestPath = join(LOCALE_ES, 'manifest-es.json');
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    manifest.coverage = manifest.coverage ?? {};
    manifest.coverage.entriesWithLongDefinitionEs = grandDone + totalGenerated;
    manifest.coverage.lastUpdated = new Date().toISOString();
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  } catch { /* ignore */ }

  log('');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log(`✅ DONE — generated ${totalGenerated} new entries`);
  log(`   Total: ${grandDone + totalGenerated}/${grandTotal} (${((grandDone + totalGenerated)/grandTotal*100).toFixed(1)}%)`);
}

main().catch(err => {
  log(`FATAL: ${err}`);
  process.exit(1);
});

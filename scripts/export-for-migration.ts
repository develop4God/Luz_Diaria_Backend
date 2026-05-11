/**
 * Export all devotionals from current DB, adding a sourceKey for each.
 * sourceKey = first 16 hex chars of SHA-256(title|bibleReference)
 * This key identifies the same devotional content across environments,
 * regardless of which date it was assigned.
 *
 * Usage:
 *   cd backend && bun run scripts/export-for-migration.ts
 *
 * Output:
 *   backend/migration/devotionals-YYYY-MM-DD.json
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const prisma = new PrismaClient();

function computeSourceKey(title: string, bibleReference: string): string {
  return createHash('sha256')
    .update(`${title.trim()}|${bibleReference.trim()}`)
    .digest('hex')
    .substring(0, 16);
}

async function main() {
  const devotionals = await prisma.devotional.findMany({
    orderBy: { date: 'asc' },
  });

  const withSourceKey = devotionals.map(d => ({
    ...d,
    sourceKey: computeSourceKey(d.title, d.bibleReference),
  }));

  const today = new Date().toISOString().split('T')[0];
  const outDir = path.join(import.meta.dir, '../migration');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `devotionals-${today}.json`);

  const output = {
    exportedAt: new Date().toISOString(),
    exportedFrom: 'dev',
    count: withSourceKey.length,
    dateRange: {
      min: withSourceKey[0]?.date ?? null,
      max: withSourceKey[withSourceKey.length - 1]?.date ?? null,
    },
    devotionals: withSourceKey,
  };

  writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n✅ Export complete`);
  console.log(`   File:       ${outFile}`);
  console.log(`   Devotionals: ${withSourceKey.length}`);
  console.log(`   Date range:  ${output.dateRange.min} → ${output.dateRange.max}`);
  console.log(`\nNext step on PRD:`);
  console.log(`   bun run scripts/import-migration.ts migration/devotionals-${today}.json`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

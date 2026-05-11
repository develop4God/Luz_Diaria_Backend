/**
 * Import devotionals from a migration JSON into the target DB.
 * - Upserts by `date` (not by id) — safe for cross-environment migration.
 * - Skips devotionals whose date already exists in target DB.
 * - Strips sourceKey (not in schema yet) and regenerates id + timestamps.
 *
 * Usage (on PRD server):
 *   cd backend && bun run scripts/import-migration.ts migration/devotionals-YYYY-MM-DD.json
 *
 * Validation queries printed at the end.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

interface MigrationFile {
  exportedAt: string;
  exportedFrom: string;
  count: number;
  dateRange: { min: string | null; max: string | null };
  devotionals: Array<Record<string, unknown>>;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: bun run scripts/import-migration.ts <path-to-json>');
    process.exit(1);
  }

  const raw = readFileSync(filePath, 'utf-8');
  const migration: MigrationFile = JSON.parse(raw);

  console.log(`\n📦 Migration file: ${filePath}`);
  console.log(`   Exported at:    ${migration.exportedAt}`);
  console.log(`   Source env:     ${migration.exportedFrom}`);
  console.log(`   Total in file:  ${migration.count}`);
  console.log(`   Date range:     ${migration.dateRange.min} → ${migration.dateRange.max}`);
  console.log(`\nImporting…`);

  let inserted = 0;
  let skipped = 0;

  for (const d of migration.devotionals) {
    const date = d.date as string;

    const exists = await prisma.devotional.findUnique({
      where: { date },
      select: { id: true },
    });

    if (exists) {
      skipped++;
      continue;
    }

    // Strip non-schema fields and let PRD generate its own id/timestamps
    const { id: _id, sourceKey: _sk, createdAt: _ca, updatedAt: _ua, ...fields } = d;

    await prisma.devotional.create({
      data: fields as Parameters<typeof prisma.devotional.create>[0]['data'],
    });

    inserted++;

    if (inserted % 25 === 0) {
      process.stdout.write(`   … ${inserted} inserted so far\n`);
    }
  }

  // Post-migration validation
  const totalInDb = await prisma.devotional.count();
  const maxRow = await prisma.devotional.findFirst({ orderBy: { date: 'desc' }, select: { date: true } });
  const minRow = await prisma.devotional.findFirst({ orderBy: { date: 'asc' }, select: { date: true } });

  console.log(`\n✅ Migration complete`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped (already existed): ${skipped}`);
  console.log(`\n📊 DB state after migration:`);
  console.log(`   Total devotionals: ${totalInDb}`);
  console.log(`   Date range:        ${minRow?.date} → ${maxRow?.date}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

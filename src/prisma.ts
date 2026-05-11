import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// IMPORTANT: SQLite optimizations for better performance
async function initSqlitePragmas(prisma: PrismaClient) {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");
  await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
}

// Ensure new SupportTicket columns exist (idempotent migration for new fields)
async function runInlineMigrations(prisma: PrismaClient) {
  try {
    const cols = (
      await prisma.$queryRawUnsafe<{ name: string }[]>(
        "PRAGMA table_info('SupportTicket')"
      )
    ).map((r) => r.name);

    if (!cols.includes("clientClaim")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "SupportTicket" ADD COLUMN "clientClaim" TEXT NOT NULL DEFAULT '{}'`
      );
      console.log("[DB] Added SupportTicket.clientClaim");
    }
    if (!cols.includes("botPreview")) {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "SupportTicket" ADD COLUMN "botPreview" TEXT NOT NULL DEFAULT '{}'`
      );
      console.log("[DB] Added SupportTicket.botPreview");
    }
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "SupportTicket_type_idx" ON "SupportTicket"("type")`
    );
  } catch (e) {
    console.warn("[DB] Inline migration skipped (table may not exist yet):", e);
  }
}

initSqlitePragmas(prisma).then(() => runInlineMigrations(prisma));

export { prisma };


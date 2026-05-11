import { generateNewFormatDevotionalForDate } from "../src/devotional-service";

const DATES = [
  "2026-08-27",
  "2026-08-28",
  "2026-08-29",
  "2026-08-30",
  "2026-09-06",
  "2026-09-08",
  "2026-09-10",
  "2026-09-11",
  "2026-09-12",
  "2026-09-13",
];

for (const date of DATES) {
  process.stdout.write(`[fill-gaps] Generando ${date}... `);
  try {
    await generateNewFormatDevotionalForDate(date);
    console.log("✓");
  } catch (err) {
    console.log(`FALLÓ: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log("[fill-gaps] Terminado.");
process.exit(0);

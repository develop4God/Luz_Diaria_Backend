import { prisma } from "../src/prisma";

const GITHUB_BASE = 'https://raw.githubusercontent.com/develop4God/devocionales-json/main';

const [esRes, enRes] = await Promise.all([
  fetch(`${GITHUB_BASE}/Devocional_year_2026.json`),
  fetch(`${GITHUB_BASE}/Devocional_year_2026_en_KJV.json`),
]);
const esData = await esRes.json() as any[];
const enData = await enRes.json() as any[];

const esMap: Record<string, any> = {};
const enMap: Record<string, any> = {};
for (const e of esData) if (e.fecha) esMap[e.fecha] = e;
for (const e of enData) if (e.fecha) enMap[e.fecha] = e;

const githubDates = Object.keys(esMap).filter(d => enMap[d]).sort();
console.log(`GitHub total (ES+EN): ${githubDates.length}`);
console.log(`Rango: ${githubDates[0]} → ${githubDates[githubDates.length-1]}`);

const dbRows = await prisma.devotional.findMany({ select: { date: true } });
const dbDates = new Set(dbRows.map((r: any) => r.date));
console.log(`DB total: ${dbDates.size}`);

const available = githubDates.filter(d => !dbDates.has(d));
console.log(`\nDisponibles (GitHub sin asignar en DB): ${available.length}`);
console.log('Primeros 20:', available.slice(0, 20).join(', '));

await prisma.$disconnect();

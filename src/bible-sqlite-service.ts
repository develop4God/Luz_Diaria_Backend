// bible-sqlite-service.ts
// Reads RVR1960 and NVI SQLite databases bundled from assets/biblia/ in the
// develop4God/devocional_nuevo repository.
//
// Database schema:
//   verses (book_number INTEGER, chapter INTEGER, verse INTEGER, text TEXT)
//   books  (book_number INTEGER, short_name TEXT, long_name TEXT)
//   info   (name TEXT, value TEXT)
//
// Book numbers use a gapped-10x scheme to reserve space for deuterocanonicals:
//   GEN=10, EXO=20, ..., MAL=460, MAT=470, ..., REV=730

import { Database } from "bun:sqlite";
import path from "path";

// ─── Book number ↔ USFM bookId mapping ────────────────────────────────────────

const BOOK_NUM_TO_USFM: Record<number, string> = {
  10: "GEN", 20: "EXO", 30: "LEV", 40: "NUM", 50: "DEU",
  60: "JOS", 70: "JDG", 80: "RUT", 90: "1SA", 100: "2SA",
  110: "1KI", 120: "2KI", 130: "1CH", 140: "2CH", 150: "EZR",
  160: "NEH", 190: "EST", 220: "JOB", 230: "PSA", 240: "PRO",
  250: "ECC", 260: "SNG", 290: "ISA", 300: "JER", 310: "LAM",
  330: "EZK", 340: "DAN", 350: "HOS", 360: "JOL", 370: "AMO",
  380: "OBA", 390: "JON", 400: "MIC", 410: "NAM", 420: "HAB",
  430: "ZEP", 440: "HAG", 450: "ZEC", 460: "MAL",
  470: "MAT", 480: "MRK", 490: "LUK", 500: "JHN", 510: "ACT",
  520: "ROM", 530: "1CO", 540: "2CO", 550: "GAL", 560: "EPH",
  570: "PHP", 580: "COL", 590: "1TH", 600: "2TH", 610: "1TI",
  620: "2TI", 630: "TIT", 640: "PHM", 650: "HEB", 660: "JAS",
  670: "1PE", 680: "2PE", 690: "1JN", 700: "2JN", 710: "3JN",
  720: "JUD", 730: "REV",
};

const USFM_TO_BOOK_NUM: Record<string, number> = Object.fromEntries(
  Object.entries(BOOK_NUM_TO_USFM).map(([k, v]) => [v, Number(k)])
);

// ─── Tag stripping ─────────────────────────────────────────────────────────────

// Remove all XML/HTML-like tags and collapse extra whitespace
function stripTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")   // remove all tags
    .replace(/\s+/g, " ")      // collapse whitespace
    .trim();
}

// ─── Supported versions ────────────────────────────────────────────────────────

export type SqliteVersion = "RVR60" | "NVI";

const DB_DIR = path.join(import.meta.dir, "../data/bible");

const DB_FILES: Record<SqliteVersion, string> = {
  RVR60: path.join(DB_DIR, "RVR1960_es.SQLite3"),
  NVI: path.join(DB_DIR, "NVI_es.SQLite3"),
};

// Lazy-loaded database instances (opened once, kept open)
const dbCache: Partial<Record<SqliteVersion, Database>> = {};

function getDb(version: SqliteVersion): Database {
  if (!dbCache[version]) {
    const filePath = DB_FILES[version];
    dbCache[version] = new Database(filePath, { readonly: true });
  }
  return dbCache[version]!;
}

// ─── Book metadata cache ───────────────────────────────────────────────────────

interface BookMeta {
  bookNumber: number;
  shortName: string;
  longName: string;
}

const bookMetaCache: Partial<Record<SqliteVersion, BookMeta[]>> = {};

function getBookMeta(version: SqliteVersion): BookMeta[] {
  if (!bookMetaCache[version]) {
    const db = getDb(version);
    const rows = db
      .query(
        "SELECT book_number, short_name, long_name FROM books ORDER BY book_number"
      )
      .all() as Array<{ book_number: number; short_name: string; long_name: string }>;
    bookMetaCache[version] = rows.map((r) => ({
      bookNumber: r.book_number,
      shortName: r.short_name,
      longName: r.long_name,
    }));
  }
  return bookMetaCache[version]!;
}

function getBookName(version: SqliteVersion, bookNumber: number): string {
  const meta = getBookMeta(version);
  return meta.find((b) => b.bookNumber === bookNumber)?.longName ?? "Unknown";
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface SqliteVerse {
  number: number;
  text: string;
}

export interface SqliteChapterResult {
  success: true;
  bookId: string;
  bookName: string;
  chapter: number;
  verses: SqliteVerse[];
  version: SqliteVersion;
}

export interface SqliteChapterError {
  success: false;
  error: string;
}

/**
 * Fetch all verses of a chapter from the bundled SQLite database.
 * Returns cleaned verse text (tags stripped).
 */
export function getChapterFromSqlite(
  version: SqliteVersion,
  bookId: string,
  chapter: number
): SqliteChapterResult | SqliteChapterError {
  const bookNumber = USFM_TO_BOOK_NUM[bookId];
  if (bookNumber == null) {
    return { success: false, error: `Unknown book: ${bookId}` };
  }

  try {
    const db = getDb(version);
    const rows = db
      .query(
        "SELECT verse, text FROM verses WHERE book_number = ? AND chapter = ? ORDER BY verse"
      )
      .all(bookNumber, chapter) as Array<{ verse: number; text: string }>;

    if (rows.length === 0) {
      return {
        success: false,
        error: `No verses found for ${bookId} chapter ${chapter} in ${version}`,
      };
    }

    return {
      success: true,
      bookId,
      bookName: getBookName(version, bookNumber),
      chapter,
      version,
      verses: rows.map((r) => ({
        number: r.verse,
        text: stripTags(r.text),
      })),
    };
  } catch (e) {
    console.error(`[BibleSQLite] Error reading ${version} ${bookId} ${chapter}:`, e);
    return { success: false, error: "Database read error" };
  }
}

// ─── Full-corpus search ────────────────────────────────────────────────────────

export interface SqliteSearchResult {
  reference: string;
  text: string;
  bookId: string;
  chapter: number;
  verse: number;
  source: "sqlite";
  version: SqliteVersion;
}

/**
 * Search all ~31,000 verses in a given Bible version using SQLite LIKE.
 * Returns up to `limit` results ordered by book/chapter/verse.
 */
export function searchSqliteVerses(
  version: SqliteVersion,
  query: string,
  limit = 20
): SqliteSearchResult[] {
  if (!query.trim()) return [];

  try {
    const db = getDb(version);

    // SQLite LIKE is case-insensitive for ASCII but we also want accent-insensitive.
    // We run a LIKE '%query%' across the text column.
    // For accented Spanish, LIKE already handles basic matching since the DB
    // stores accented text and users type accented/unaccented words.
    // We search both the raw text (which may have tags) — tags are stripped afterwards.
    const rows = db
      .query(
        `SELECT book_number, chapter, verse, text
         FROM verses
         WHERE text LIKE ?
         ORDER BY book_number, chapter, verse
         LIMIT ?`
      )
      .all(`%${query}%`, limit) as Array<{
        book_number: number;
        chapter: number;
        verse: number;
        text: string;
      }>;

    const results: SqliteSearchResult[] = [];

    for (const row of rows) {
      const bookId = BOOK_NUM_TO_USFM[row.book_number];
      if (!bookId) continue;

      const bookName = getBookName(version, row.book_number);
      const cleanText = stripTags(row.text);
      const reference = `${bookName} ${row.chapter}:${row.verse}`;

      results.push({
        reference,
        text: cleanText.length > 200 ? cleanText.slice(0, 200) + "…" : cleanText,
        bookId,
        chapter: row.chapter,
        verse: row.verse,
        source: "sqlite",
        version,
      });
    }

    return results;
  } catch (e) {
    console.error(`[BibleSQLite] Search error (${version}):`, e);
    return [];
  }
}

/**
 * Check whether a given SQLite version is available (database file exists and opens).
 */
export function isSqliteVersionAvailable(version: SqliteVersion): boolean {
  try {
    getDb(version);
    return true;
  } catch {
    return false;
  }
}

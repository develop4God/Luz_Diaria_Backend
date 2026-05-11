// Bible passage routes
import { Hono } from "hono";
import {
  getBiblePassage,
  getBibleChapterVerses,
  BIBLE_BOOKS_LIST,
} from "../bible-service";
import { prisma } from "../prisma";
import {
  getChapterFromSqlite,
  searchSqliteVerses,
  isSqliteVersionAvailable,
  type SqliteVersion,
} from "../bible-sqlite-service";

export const bibleRouter = new Hono();

/**
 * GET /api/bible/passage
 * Fetch a Bible passage by reference
 * Query params:
 *   - reference: The Bible reference (e.g., "Lucas 10:25-37", "Juan 3:16")
 *   - lang: Language code ("en" or "es")
 */
bibleRouter.get("/passage", async (c) => {
  const reference = c.req.query("reference");
  const lang = (c.req.query("lang") || "es") as "en" | "es";

  if (!reference) {
    return c.json(
      {
        success: false,
        error: lang === "es" ? "Referencia requerida" : "Reference required",
      },
      400
    );
  }

  console.log(`[Bible API] Request for: "${reference}" (${lang})`);

  const result = await getBiblePassage(reference, lang);

  if (!result.success) {
    return c.json(result, 404);
  }

  return c.json(result);
});

/**
 * POST /api/bible/passage
 * Alternative endpoint for fetching passages (useful for complex references)
 * Body: { reference: string, lang: "en" | "es" }
 */
bibleRouter.post("/passage", async (c) => {
  const body = await c.req.json<{ reference?: string; lang?: "en" | "es" }>();
  const { reference, lang = "es" } = body;

  if (!reference) {
    return c.json(
      {
        success: false,
        error: lang === "es" ? "Referencia requerida" : "Reference required",
      },
      400
    );
  }

  console.log(`[Bible API] POST request for: "${reference}" (${lang})`);

  const result = await getBiblePassage(reference, lang);

  if (!result.success) {
    return c.json(result, 404);
  }

  return c.json(result);
});

/**
 * GET /api/bible/books
 * Returns the static list of all 66 canonical Bible books with metadata.
 * Response: { books: BibleBookInfo[] }
 */
bibleRouter.get("/books", (c) => {
  return c.json({ books: BIBLE_BOOKS_LIST });
});

/**
 * GET /api/bible/chapter
 * Fetch every verse of a single Bible chapter.
 * Query params:
 *   - bookId  : USFM book identifier, e.g. "GEN", "MAT"  (required)
 *   - chapter : chapter number (required, integer >= 1)
 *   - lang    : "en" | "es"  (default "es")
 *   - version : "RVR60" | "NVI"  (default "RVR60") — selects the SQLite corpus
 *
 * Strategy: prefer bundled SQLite database (full corpus), fall back to
 * BibleGateway scraper only if the SQLite file is unavailable.
 *
 * Response: { success, bookName, chapter, verses: [{number, text}], version? }
 */
bibleRouter.get("/chapter", async (c) => {
  const bookId = c.req.query("bookId");
  const chapterParam = c.req.query("chapter");
  const lang = (c.req.query("lang") || "es") as "en" | "es";
  const versionParam = (c.req.query("version") || "RVR60") as string;

  if (!bookId) {
    return c.json(
      {
        success: false,
        error: lang === "es" ? "bookId es requerido" : "bookId is required",
      },
      400
    );
  }

  if (!chapterParam) {
    return c.json(
      {
        success: false,
        error: lang === "es" ? "chapter es requerido" : "chapter is required",
      },
      400
    );
  }

  const chapter = parseInt(chapterParam, 10);
  if (isNaN(chapter) || chapter < 1) {
    return c.json(
      {
        success: false,
        error:
          lang === "es"
            ? "chapter debe ser un número entero positivo"
            : "chapter must be a positive integer",
      },
      400
    );
  }

  // Determine SQLite version to use
  const sqliteVersion: SqliteVersion =
    versionParam === "NVI" && isSqliteVersionAvailable("NVI") ? "NVI" : "RVR60";

  // Try SQLite first (always available for es content)
  if (lang === "es" && isSqliteVersionAvailable(sqliteVersion)) {
    console.log(
      `[Bible API] Chapter request: ${bookId} ${chapter} (${lang}) [${sqliteVersion} SQLite]`
    );
    const result = getChapterFromSqlite(sqliteVersion, bookId, chapter);
    if (result.success) {
      return c.json({
        success: true,
        bookName: result.bookName,
        chapter: result.chapter,
        verses: result.verses,
        version: sqliteVersion,
      });
    }
    // Fall through to legacy scraper on SQLite miss
    console.warn(`[Bible API] SQLite miss for ${bookId} ${chapter}, falling back`);
  }

  // Fallback: legacy BibleGateway scraper (English or SQLite unavailable)
  console.log(`[Bible API] Chapter request: ${bookId} ${chapter} (${lang}) [BibleGateway fallback]`);
  const result = await getBibleChapterVerses(bookId, chapter, lang);
  if (!result.success) {
    return c.json(result, 404);
  }
  return c.json({ ...result, version: "RVR60" });
});

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

const ES_BOOK_NAME_TO_ID: Record<string, string> = {
  'génesis': 'GEN', 'genesis': 'GEN',
  'éxodo': 'EXO', 'exodo': 'EXO',
  'levítico': 'LEV', 'levitico': 'LEV',
  'números': 'NUM', 'numeros': 'NUM',
  'deuteronomio': 'DEU',
  'josué': 'JOS', 'josue': 'JOS',
  'jueces': 'JDG',
  'rut': 'RUT',
  '1 samuel': '1SA', '1samuel': '1SA',
  '2 samuel': '2SA', '2samuel': '2SA',
  '1 reyes': '1KI', '1reyes': '1KI',
  '2 reyes': '2KI', '2reyes': '2KI',
  '1 crónicas': '1CH', '1 cronicas': '1CH',
  '2 crónicas': '2CH', '2 cronicas': '2CH',
  'esdras': 'EZR',
  'nehemías': 'NEH', 'nehemias': 'NEH',
  'ester': 'EST',
  'job': 'JOB',
  'salmos': 'PSA', 'salmo': 'PSA',
  'proverbios': 'PRO',
  'eclesiastés': 'ECC', 'eclesiastes': 'ECC',
  'cantares': 'SNG',
  'isaías': 'ISA', 'isaias': 'ISA',
  'jeremías': 'JER', 'jeremias': 'JER',
  'lamentaciones': 'LAM',
  'ezequiel': 'EZK',
  'daniel': 'DAN',
  'oseas': 'HOS',
  'joel': 'JOL',
  'amós': 'AMO', 'amos': 'AMO',
  'abdías': 'OBA', 'abdias': 'OBA',
  'jonás': 'JON', 'jonas': 'JON',
  'miqueas': 'MIC',
  'nahúm': 'NAM', 'nahum': 'NAM',
  'habacuc': 'HAB',
  'sofonías': 'ZEP', 'sofonias': 'ZEP',
  'hageo': 'HAG',
  'zacarías': 'ZEC', 'zacarias': 'ZEC',
  'malaquías': 'MAL', 'malaquias': 'MAL',
  'mateo': 'MAT',
  'marcos': 'MRK',
  'lucas': 'LUK',
  'juan': 'JHN',
  'hechos': 'ACT',
  'romanos': 'ROM',
  '1 corintios': '1CO', '1corintios': '1CO',
  '2 corintios': '2CO', '2corintios': '2CO',
  'gálatas': 'GAL', 'galatas': 'GAL',
  'efesios': 'EPH',
  'filipenses': 'PHP',
  'colosenses': 'COL',
  '1 tesalonicenses': '1TH', '1tesalonicenses': '1TH',
  '2 tesalonicenses': '2TH', '2tesalonicenses': '2TH',
  '1 timoteo': '1TI', '1timoteo': '1TI',
  '2 timoteo': '2TI', '2timoteo': '2TI',
  'tito': 'TIT',
  'filemón': 'PHM', 'filemon': 'PHM',
  'hebreos': 'HEB',
  'santiago': 'JAS',
  '1 pedro': '1PE', '1pedro': '1PE',
  '2 pedro': '2PE', '2pedro': '2PE',
  '1 juan': '1JN', '1juan': '1JN',
  '2 juan': '2JN', '2juan': '2JN',
  '3 juan': '3JN', '3juan': '3JN',
  'judas': 'JUD',
  'apocalipsis': 'REV',
};

// English book name → USFM book ID (for EN devotional references)
const EN_BOOK_NAME_TO_ID: Record<string, string> = {
  'genesis': 'GEN',
  'exodus': 'EXO',
  'leviticus': 'LEV',
  'numbers': 'NUM',
  'deuteronomy': 'DEU',
  'joshua': 'JOS',
  'judges': 'JDG',
  'ruth': 'RUT',
  '1 samuel': '1SA', '1samuel': '1SA',
  '2 samuel': '2SA', '2samuel': '2SA',
  '1 kings': '1KI', '1kings': '1KI',
  '2 kings': '2KI', '2kings': '2KI',
  '1 chronicles': '1CH', '1chronicles': '1CH',
  '2 chronicles': '2CH', '2chronicles': '2CH',
  'ezra': 'EZR',
  'nehemiah': 'NEH',
  'esther': 'EST',
  'job': 'JOB',
  'psalms': 'PSA', 'psalm': 'PSA',
  'proverbs': 'PRO',
  'ecclesiastes': 'ECC',
  'song of solomon': 'SNG', 'song of songs': 'SNG',
  'isaiah': 'ISA',
  'jeremiah': 'JER',
  'lamentations': 'LAM',
  'ezekiel': 'EZK',
  'daniel': 'DAN',
  'hosea': 'HOS',
  'joel': 'JOL',
  'amos': 'AMO',
  'obadiah': 'OBA',
  'jonah': 'JON',
  'micah': 'MIC',
  'nahum': 'NAM',
  'habakkuk': 'HAB',
  'zephaniah': 'ZEP',
  'haggai': 'HAG',
  'zechariah': 'ZEC',
  'malachi': 'MAL',
  'matthew': 'MAT',
  'mark': 'MRK',
  'luke': 'LUK',
  'john': 'JHN',
  'acts': 'ACT',
  'romans': 'ROM',
  '1 corinthians': '1CO', '1corinthians': '1CO',
  '2 corinthians': '2CO', '2corinthians': '2CO',
  'galatians': 'GAL',
  'ephesians': 'EPH',
  'philippians': 'PHP',
  'colossians': 'COL',
  '1 thessalonians': '1TH', '1thessalonians': '1TH',
  '2 thessalonians': '2TH', '2thessalonians': '2TH',
  '1 timothy': '1TI', '1timothy': '1TI',
  '2 timothy': '2TI', '2timothy': '2TI',
  'titus': 'TIT',
  'philemon': 'PHM',
  'hebrews': 'HEB',
  'james': 'JAS',
  '1 peter': '1PE', '1peter': '1PE',
  '2 peter': '2PE', '2peter': '2PE',
  '1 john': '1JN', '1john': '1JN',
  '2 john': '2JN', '2john': '2JN',
  '3 john': '3JN', '3john': '3JN',
  'jude': 'JUD',
  'revelation': 'REV',
};

interface ParsedReference {
  bookId: string;
  chapter: number;
  verse: number;
}

/**
 * Attempt to parse a reference string like "Juan 3:16" or "Filipenses 4:6-7"
 * into { bookId, chapter, verse }.  Returns null when parsing fails.
 *
 * Strategy:
 *  1. Strip trailing range suffix (e.g. "-7" in "3:16-7", or "-17" in "3:16-17").
 *  2. Split on the last whitespace segment that looks like "chapter:verse".
 *  3. Everything before that segment is the book name.
 *  4. Look the book name up in ES then EN tables.
 */
function parseReference(
  ref: string,
  lang: "en" | "es"
): ParsedReference | null {
  if (!ref || typeof ref !== "string") return null;

  // Normalise whitespace
  const trimmed = ref.trim();

  // Match pattern: <book name> <chapter>:<verse> with optional range
  // The chapter:verse part is the last "word" that matches \d+:\d+
  const match = trimmed.match(
    /^(.+?)\s+(\d+):(\d+)(?:-\d+)?$/
  );
  if (!match) return null;

  const rawBook: string = match[1] ?? "";
  const chapterStr: string = match[2] ?? "";
  const verseStr: string = match[3] ?? "";

  const chapter = parseInt(chapterStr, 10);
  const verse = parseInt(verseStr, 10);

  if (!rawBook || isNaN(chapter) || isNaN(verse) || chapter < 1 || verse < 1) return null;

  // Normalise the book name: lowercase, collapse multiple spaces
  const bookNorm = rawBook.toLowerCase().replace(/\s+/g, " ").trim();

  // Look up in language-appropriate table first, then fall back to the other
  const primaryTable =
    lang === "es" ? ES_BOOK_NAME_TO_ID : EN_BOOK_NAME_TO_ID;
  const fallbackTable =
    lang === "es" ? EN_BOOK_NAME_TO_ID : ES_BOOK_NAME_TO_ID;

  const bookId =
    primaryTable[bookNorm] ??
    fallbackTable[bookNorm] ??
    null;

  if (!bookId) return null;

  return { bookId, chapter, verse };
}

// ---------------------------------------------------------------------------
// Search response type
// ---------------------------------------------------------------------------

interface SearchResult {
  reference: string;
  text: string;
  bookId: string;
  chapter: number;
  verse: number;
  source: "devotional" | "passage";
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
}

/**
 * GET /api/bible/search
 * Full-corpus Bible verse search.
 *
 * Primary: searches all ~31,000 verses in the bundled SQLite database for the
 * requested version.  Falls back to the Devotional cache if SQLite is unavailable.
 *
 * Query params:
 *   - q       : search term (min 2 chars, required)
 *   - lang    : "en" | "es" (default "es")
 *   - version : "RVR60" | "NVI"  (default "RVR60")
 *   - limit   : max results (default 15, max 30)
 *
 * Response: { results, query, total, version, source }
 */
bibleRouter.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  const lang = (c.req.query("lang") || "es") as "en" | "es";
  const versionParam = (c.req.query("version") || "RVR60") as string;
  const limitParam = c.req.query("limit");
  const rawLimit = limitParam ? parseInt(limitParam, 10) : 15;
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? 15 : rawLimit, 30);

  if (q.trim().length < 2) {
    return c.json(
      {
        error:
          lang === "es"
            ? "El término de búsqueda debe tener al menos 2 caracteres"
            : "Search query must be at least 2 characters",
      },
      400
    );
  }

  const sqliteVersion: SqliteVersion =
    versionParam === "NVI" && isSqliteVersionAvailable("NVI") ? "NVI" : "RVR60";

  // ── Primary: full-corpus SQLite search ────────────────────────────────
  if (lang === "es" && isSqliteVersionAvailable(sqliteVersion)) {
    const sqliteResults = searchSqliteVerses(sqliteVersion, q.trim(), limit);

    console.log(
      `[Bible API] Search: "${q}" (${lang}, ${sqliteVersion}) → ${sqliteResults.length} results [SQLite full-corpus]`
    );

    return c.json({
      results: sqliteResults,
      query: q.trim(),
      total: sqliteResults.length,
      version: sqliteVersion,
      source: "sqlite",
    });
  }

  // ── Fallback: Devotional + BiblePassage cache ──────────────────────────
  const qLower = q.trim().toLowerCase();

  const verseField = lang === "es" ? "bibleVerseEs" : "bibleVerse";
  const refField   = lang === "es" ? "bibleReferenceEs" : "bibleReference";

  const devotionals = await prisma.devotional.findMany({
    where: {
      OR: [
        { [verseField]: { contains: q } },
        { [refField]:   { contains: q } },
      ],
    },
    select: {
      bibleVerse: true, bibleVerseEs: true,
      bibleReference: true, bibleReferenceEs: true,
    },
    take: limit * 3,
  });

  const passages = await prisma.biblePassage.findMany({
    where: {
      lang,
      OR: [
        { text: { contains: q } },
        { referenceDisplay: { contains: q } },
      ],
    },
    select: { referenceDisplay: true, text: true, book: true, chapterStart: true, verseStart: true },
    take: limit * 3,
  });

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  function addResult(item: SearchResult): void {
    const key = item.reference.toLowerCase().trim();
    if (seen.has(key)) return;
    seen.add(key);
    results.push(item);
  }

  for (const d of devotionals) {
    const reference = lang === "es" ? d.bibleReferenceEs : d.bibleReference;
    const text = lang === "es" ? d.bibleVerseEs : d.bibleVerse;
    if (!reference || !text) continue;
    const parsed = parseReference(reference, lang);
    if (!parsed) continue;
    addResult({
      reference,
      text: text.length > 200 ? text.slice(0, 200) + "…" : text,
      bookId: parsed.bookId, chapter: parsed.chapter, verse: parsed.verse,
      source: "devotional",
    });
  }

  for (const p of passages) {
    if (!p.referenceDisplay || !p.text) continue;
    addResult({
      reference: p.referenceDisplay,
      text: p.text.length > 200 ? p.text.slice(0, 200) + "…" : p.text,
      bookId: p.book, chapter: p.chapterStart, verse: p.verseStart,
      source: "passage",
    });
  }

  results.sort((a, b) => {
    const aL = a.reference.toLowerCase();
    const bL = b.reference.toLowerCase();
    const aE = aL === qLower ? 0 : aL.startsWith(qLower) ? 1 : 2;
    const bE = bL === qLower ? 0 : bL.startsWith(qLower) ? 1 : 2;
    if (aE !== bE) return aE - bE;
    return (a.text.toLowerCase().includes(qLower) ? 0 : 1) -
           (b.text.toLowerCase().includes(qLower) ? 0 : 1);
  });

  const trimmed = results.slice(0, limit);
  console.log(`[Bible API] Search: "${q}" (${lang}) → ${trimmed.length} results [cache fallback]`);

  return c.json({
    results: trimmed, query: q.trim(), total: trimmed.length,
    version: "RVR60", source: "cache",
  });
});

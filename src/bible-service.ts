// Bible Passage Service
// Fetches Bible passages from API and caches them in the database

import { prisma } from "./prisma";

// ─── Bible Books List ────────────────────────────────────────────────────────

export interface BibleBookInfo {
  id: string;       // "GEN"
  name: string;     // Spanish display name, e.g. "Génesis"
  nameEn: string;   // English display name, e.g. "Genesis"
  chapters: number; // total chapter count
  testament: "OT" | "NT";
}

export const BIBLE_BOOKS_LIST: BibleBookInfo[] = [
  // Old Testament
  { id: "GEN", name: "Génesis",          nameEn: "Genesis",          chapters: 50, testament: "OT" },
  { id: "EXO", name: "Éxodo",            nameEn: "Exodus",            chapters: 40, testament: "OT" },
  { id: "LEV", name: "Levítico",         nameEn: "Leviticus",         chapters: 27, testament: "OT" },
  { id: "NUM", name: "Números",          nameEn: "Numbers",           chapters: 36, testament: "OT" },
  { id: "DEU", name: "Deuteronomio",     nameEn: "Deuteronomy",       chapters: 34, testament: "OT" },
  { id: "JOS", name: "Josué",            nameEn: "Joshua",            chapters: 24, testament: "OT" },
  { id: "JDG", name: "Jueces",           nameEn: "Judges",            chapters: 21, testament: "OT" },
  { id: "RUT", name: "Rut",              nameEn: "Ruth",              chapters:  4, testament: "OT" },
  { id: "1SA", name: "1 Samuel",         nameEn: "1 Samuel",          chapters: 31, testament: "OT" },
  { id: "2SA", name: "2 Samuel",         nameEn: "2 Samuel",          chapters: 24, testament: "OT" },
  { id: "1KI", name: "1 Reyes",          nameEn: "1 Kings",           chapters: 22, testament: "OT" },
  { id: "2KI", name: "2 Reyes",          nameEn: "2 Kings",           chapters: 25, testament: "OT" },
  { id: "1CH", name: "1 Crónicas",       nameEn: "1 Chronicles",      chapters: 29, testament: "OT" },
  { id: "2CH", name: "2 Crónicas",       nameEn: "2 Chronicles",      chapters: 36, testament: "OT" },
  { id: "EZR", name: "Esdras",           nameEn: "Ezra",              chapters: 10, testament: "OT" },
  { id: "NEH", name: "Nehemías",         nameEn: "Nehemiah",          chapters: 13, testament: "OT" },
  { id: "EST", name: "Ester",            nameEn: "Esther",            chapters: 10, testament: "OT" },
  { id: "JOB", name: "Job",              nameEn: "Job",               chapters: 42, testament: "OT" },
  { id: "PSA", name: "Salmos",           nameEn: "Psalms",            chapters: 150, testament: "OT" },
  { id: "PRO", name: "Proverbios",       nameEn: "Proverbs",          chapters: 31, testament: "OT" },
  { id: "ECC", name: "Eclesiastés",      nameEn: "Ecclesiastes",      chapters: 12, testament: "OT" },
  { id: "SNG", name: "Cantares",         nameEn: "Song of Solomon",   chapters:  8, testament: "OT" },
  { id: "ISA", name: "Isaías",           nameEn: "Isaiah",            chapters: 66, testament: "OT" },
  { id: "JER", name: "Jeremías",         nameEn: "Jeremiah",          chapters: 52, testament: "OT" },
  { id: "LAM", name: "Lamentaciones",    nameEn: "Lamentations",      chapters:  5, testament: "OT" },
  { id: "EZK", name: "Ezequiel",         nameEn: "Ezekiel",           chapters: 48, testament: "OT" },
  { id: "DAN", name: "Daniel",           nameEn: "Daniel",            chapters: 12, testament: "OT" },
  { id: "HOS", name: "Oseas",            nameEn: "Hosea",             chapters: 14, testament: "OT" },
  { id: "JOL", name: "Joel",             nameEn: "Joel",              chapters:  3, testament: "OT" },
  { id: "AMO", name: "Amós",             nameEn: "Amos",              chapters:  9, testament: "OT" },
  { id: "OBA", name: "Abdías",           nameEn: "Obadiah",           chapters:  1, testament: "OT" },
  { id: "JON", name: "Jonás",            nameEn: "Jonah",             chapters:  4, testament: "OT" },
  { id: "MIC", name: "Miqueas",          nameEn: "Micah",             chapters:  7, testament: "OT" },
  { id: "NAM", name: "Nahúm",            nameEn: "Nahum",             chapters:  3, testament: "OT" },
  { id: "HAB", name: "Habacuc",          nameEn: "Habakkuk",          chapters:  3, testament: "OT" },
  { id: "ZEP", name: "Sofonías",         nameEn: "Zephaniah",         chapters:  3, testament: "OT" },
  { id: "HAG", name: "Hageo",            nameEn: "Haggai",            chapters:  2, testament: "OT" },
  { id: "ZEC", name: "Zacarías",         nameEn: "Zechariah",         chapters: 14, testament: "OT" },
  { id: "MAL", name: "Malaquías",        nameEn: "Malachi",           chapters:  4, testament: "OT" },
  // New Testament
  { id: "MAT", name: "Mateo",            nameEn: "Matthew",           chapters: 28, testament: "NT" },
  { id: "MRK", name: "Marcos",           nameEn: "Mark",              chapters: 16, testament: "NT" },
  { id: "LUK", name: "Lucas",            nameEn: "Luke",              chapters: 24, testament: "NT" },
  { id: "JHN", name: "Juan",             nameEn: "John",              chapters: 21, testament: "NT" },
  { id: "ACT", name: "Hechos",           nameEn: "Acts",              chapters: 28, testament: "NT" },
  { id: "ROM", name: "Romanos",          nameEn: "Romans",            chapters: 16, testament: "NT" },
  { id: "1CO", name: "1 Corintios",      nameEn: "1 Corinthians",     chapters: 16, testament: "NT" },
  { id: "2CO", name: "2 Corintios",      nameEn: "2 Corinthians",     chapters: 13, testament: "NT" },
  { id: "GAL", name: "Gálatas",          nameEn: "Galatians",         chapters:  6, testament: "NT" },
  { id: "EPH", name: "Efesios",          nameEn: "Ephesians",         chapters:  6, testament: "NT" },
  { id: "PHP", name: "Filipenses",       nameEn: "Philippians",       chapters:  4, testament: "NT" },
  { id: "COL", name: "Colosenses",       nameEn: "Colossians",        chapters:  4, testament: "NT" },
  { id: "1TH", name: "1 Tesalonicenses", nameEn: "1 Thessalonians",   chapters:  5, testament: "NT" },
  { id: "2TH", name: "2 Tesalonicenses", nameEn: "2 Thessalonians",   chapters:  3, testament: "NT" },
  { id: "1TI", name: "1 Timoteo",        nameEn: "1 Timothy",         chapters:  6, testament: "NT" },
  { id: "2TI", name: "2 Timoteo",        nameEn: "2 Timothy",         chapters:  4, testament: "NT" },
  { id: "TIT", name: "Tito",             nameEn: "Titus",             chapters:  3, testament: "NT" },
  { id: "PHM", name: "Filemón",          nameEn: "Philemon",          chapters:  1, testament: "NT" },
  { id: "HEB", name: "Hebreos",          nameEn: "Hebrews",           chapters: 13, testament: "NT" },
  { id: "JAS", name: "Santiago",         nameEn: "James",             chapters:  5, testament: "NT" },
  { id: "1PE", name: "1 Pedro",          nameEn: "1 Peter",           chapters:  5, testament: "NT" },
  { id: "2PE", name: "2 Pedro",          nameEn: "2 Peter",           chapters:  3, testament: "NT" },
  { id: "1JN", name: "1 Juan",           nameEn: "1 John",            chapters:  5, testament: "NT" },
  { id: "2JN", name: "2 Juan",           nameEn: "2 John",            chapters:  1, testament: "NT" },
  { id: "3JN", name: "3 Juan",           nameEn: "3 John",            chapters:  1, testament: "NT" },
  { id: "JUD", name: "Judas",            nameEn: "Jude",              chapters:  1, testament: "NT" },
  { id: "REV", name: "Apocalipsis",      nameEn: "Revelation",        chapters: 22, testament: "NT" },
];

// ─── Verse Array Type ────────────────────────────────────────────────────────

export interface BibleVerse {
  number: number;
  text: string;
}

export interface BibleChapterResult {
  success: boolean;
  verses?: BibleVerse[];
  bookName: string;
  chapter: number;
  error?: string;
}

// Book name mappings for normalization
const BOOK_MAPPINGS: Record<string, { en: string; es: string; apiKey: string }> = {
  // Old Testament
  genesis: { en: "Genesis", es: "Génesis", apiKey: "GEN" },
  génesis: { en: "Genesis", es: "Génesis", apiKey: "GEN" },
  exodo: { en: "Exodus", es: "Éxodo", apiKey: "EXO" },
  éxodo: { en: "Exodus", es: "Éxodo", apiKey: "EXO" },
  exodus: { en: "Exodus", es: "Éxodo", apiKey: "EXO" },
  levitico: { en: "Leviticus", es: "Levítico", apiKey: "LEV" },
  levítico: { en: "Leviticus", es: "Levítico", apiKey: "LEV" },
  leviticus: { en: "Leviticus", es: "Levítico", apiKey: "LEV" },
  numeros: { en: "Numbers", es: "Números", apiKey: "NUM" },
  números: { en: "Numbers", es: "Números", apiKey: "NUM" },
  numbers: { en: "Numbers", es: "Números", apiKey: "NUM" },
  deuteronomio: { en: "Deuteronomy", es: "Deuteronomio", apiKey: "DEU" },
  deuteronomy: { en: "Deuteronomy", es: "Deuteronomio", apiKey: "DEU" },
  josue: { en: "Joshua", es: "Josué", apiKey: "JOS" },
  josué: { en: "Joshua", es: "Josué", apiKey: "JOS" },
  joshua: { en: "Joshua", es: "Josué", apiKey: "JOS" },
  jueces: { en: "Judges", es: "Jueces", apiKey: "JDG" },
  judges: { en: "Judges", es: "Jueces", apiKey: "JDG" },
  rut: { en: "Ruth", es: "Rut", apiKey: "RUT" },
  ruth: { en: "Ruth", es: "Rut", apiKey: "RUT" },
  "1samuel": { en: "1 Samuel", es: "1 Samuel", apiKey: "1SA" },
  "1 samuel": { en: "1 Samuel", es: "1 Samuel", apiKey: "1SA" },
  "2samuel": { en: "2 Samuel", es: "2 Samuel", apiKey: "2SA" },
  "2 samuel": { en: "2 Samuel", es: "2 Samuel", apiKey: "2SA" },
  "1reyes": { en: "1 Kings", es: "1 Reyes", apiKey: "1KI" },
  "1 reyes": { en: "1 Kings", es: "1 Reyes", apiKey: "1KI" },
  "1kings": { en: "1 Kings", es: "1 Reyes", apiKey: "1KI" },
  "1 kings": { en: "1 Kings", es: "1 Reyes", apiKey: "1KI" },
  "2reyes": { en: "2 Kings", es: "2 Reyes", apiKey: "2KI" },
  "2 reyes": { en: "2 Kings", es: "2 Reyes", apiKey: "2KI" },
  "2kings": { en: "2 Kings", es: "2 Reyes", apiKey: "2KI" },
  "2 kings": { en: "2 Kings", es: "2 Reyes", apiKey: "2KI" },
  "1cronicas": { en: "1 Chronicles", es: "1 Crónicas", apiKey: "1CH" },
  "1 cronicas": { en: "1 Chronicles", es: "1 Crónicas", apiKey: "1CH" },
  "1 crónicas": { en: "1 Chronicles", es: "1 Crónicas", apiKey: "1CH" },
  "1chronicles": { en: "1 Chronicles", es: "1 Crónicas", apiKey: "1CH" },
  "1 chronicles": { en: "1 Chronicles", es: "1 Crónicas", apiKey: "1CH" },
  "2cronicas": { en: "2 Chronicles", es: "2 Crónicas", apiKey: "2CH" },
  "2 cronicas": { en: "2 Chronicles", es: "2 Crónicas", apiKey: "2CH" },
  "2 crónicas": { en: "2 Chronicles", es: "2 Crónicas", apiKey: "2CH" },
  "2chronicles": { en: "2 Chronicles", es: "2 Crónicas", apiKey: "2CH" },
  "2 chronicles": { en: "2 Chronicles", es: "2 Crónicas", apiKey: "2CH" },
  esdras: { en: "Ezra", es: "Esdras", apiKey: "EZR" },
  ezra: { en: "Ezra", es: "Esdras", apiKey: "EZR" },
  nehemias: { en: "Nehemiah", es: "Nehemías", apiKey: "NEH" },
  nehemías: { en: "Nehemiah", es: "Nehemías", apiKey: "NEH" },
  nehemiah: { en: "Nehemiah", es: "Nehemías", apiKey: "NEH" },
  ester: { en: "Esther", es: "Ester", apiKey: "EST" },
  esther: { en: "Esther", es: "Ester", apiKey: "EST" },
  job: { en: "Job", es: "Job", apiKey: "JOB" },
  salmos: { en: "Psalms", es: "Salmos", apiKey: "PSA" },
  salmo: { en: "Psalms", es: "Salmos", apiKey: "PSA" },
  psalms: { en: "Psalms", es: "Salmos", apiKey: "PSA" },
  psalm: { en: "Psalms", es: "Salmos", apiKey: "PSA" },
  proverbios: { en: "Proverbs", es: "Proverbios", apiKey: "PRO" },
  proverbs: { en: "Proverbs", es: "Proverbios", apiKey: "PRO" },
  eclesiastes: { en: "Ecclesiastes", es: "Eclesiastés", apiKey: "ECC" },
  eclesiastés: { en: "Ecclesiastes", es: "Eclesiastés", apiKey: "ECC" },
  ecclesiastes: { en: "Ecclesiastes", es: "Eclesiastés", apiKey: "ECC" },
  cantares: { en: "Song of Solomon", es: "Cantares", apiKey: "SNG" },
  "cantar de los cantares": { en: "Song of Solomon", es: "Cantares", apiKey: "SNG" },
  "song of solomon": { en: "Song of Solomon", es: "Cantares", apiKey: "SNG" },
  isaias: { en: "Isaiah", es: "Isaías", apiKey: "ISA" },
  isaías: { en: "Isaiah", es: "Isaías", apiKey: "ISA" },
  isaiah: { en: "Isaiah", es: "Isaías", apiKey: "ISA" },
  jeremias: { en: "Jeremiah", es: "Jeremías", apiKey: "JER" },
  jeremías: { en: "Jeremiah", es: "Jeremías", apiKey: "JER" },
  jeremiah: { en: "Jeremiah", es: "Jeremías", apiKey: "JER" },
  lamentaciones: { en: "Lamentations", es: "Lamentaciones", apiKey: "LAM" },
  lamentations: { en: "Lamentations", es: "Lamentaciones", apiKey: "LAM" },
  ezequiel: { en: "Ezekiel", es: "Ezequiel", apiKey: "EZK" },
  ezekiel: { en: "Ezekiel", es: "Ezequiel", apiKey: "EZK" },
  daniel: { en: "Daniel", es: "Daniel", apiKey: "DAN" },
  oseas: { en: "Hosea", es: "Oseas", apiKey: "HOS" },
  hosea: { en: "Hosea", es: "Oseas", apiKey: "HOS" },
  joel: { en: "Joel", es: "Joel", apiKey: "JOL" },
  amos: { en: "Amos", es: "Amós", apiKey: "AMO" },
  amós: { en: "Amos", es: "Amós", apiKey: "AMO" },
  abdias: { en: "Obadiah", es: "Abdías", apiKey: "OBA" },
  abdías: { en: "Obadiah", es: "Abdías", apiKey: "OBA" },
  obadiah: { en: "Obadiah", es: "Abdías", apiKey: "OBA" },
  jonas: { en: "Jonah", es: "Jonás", apiKey: "JON" },
  jonás: { en: "Jonah", es: "Jonás", apiKey: "JON" },
  jonah: { en: "Jonah", es: "Jonás", apiKey: "JON" },
  miqueas: { en: "Micah", es: "Miqueas", apiKey: "MIC" },
  micah: { en: "Micah", es: "Miqueas", apiKey: "MIC" },
  nahum: { en: "Nahum", es: "Nahúm", apiKey: "NAM" },
  nahúm: { en: "Nahum", es: "Nahúm", apiKey: "NAM" },
  habacuc: { en: "Habakkuk", es: "Habacuc", apiKey: "HAB" },
  habakkuk: { en: "Habakkuk", es: "Habacuc", apiKey: "HAB" },
  sofonias: { en: "Zephaniah", es: "Sofonías", apiKey: "ZEP" },
  sofonías: { en: "Zephaniah", es: "Sofonías", apiKey: "ZEP" },
  zephaniah: { en: "Zephaniah", es: "Sofonías", apiKey: "ZEP" },
  hageo: { en: "Haggai", es: "Hageo", apiKey: "HAG" },
  haggai: { en: "Haggai", es: "Hageo", apiKey: "HAG" },
  zacarias: { en: "Zechariah", es: "Zacarías", apiKey: "ZEC" },
  zacarías: { en: "Zechariah", es: "Zacarías", apiKey: "ZEC" },
  zechariah: { en: "Zechariah", es: "Zacarías", apiKey: "ZEC" },
  malaquias: { en: "Malachi", es: "Malaquías", apiKey: "MAL" },
  malaquías: { en: "Malachi", es: "Malaquías", apiKey: "MAL" },
  malachi: { en: "Malachi", es: "Malaquías", apiKey: "MAL" },
  // New Testament
  mateo: { en: "Matthew", es: "Mateo", apiKey: "MAT" },
  matthew: { en: "Matthew", es: "Mateo", apiKey: "MAT" },
  marcos: { en: "Mark", es: "Marcos", apiKey: "MRK" },
  mark: { en: "Mark", es: "Marcos", apiKey: "MRK" },
  lucas: { en: "Luke", es: "Lucas", apiKey: "LUK" },
  luke: { en: "Luke", es: "Lucas", apiKey: "LUK" },
  juan: { en: "John", es: "Juan", apiKey: "JHN" },
  john: { en: "John", es: "Juan", apiKey: "JHN" },
  hechos: { en: "Acts", es: "Hechos", apiKey: "ACT" },
  acts: { en: "Acts", es: "Hechos", apiKey: "ACT" },
  romanos: { en: "Romans", es: "Romanos", apiKey: "ROM" },
  romans: { en: "Romans", es: "Romanos", apiKey: "ROM" },
  "1corintios": { en: "1 Corinthians", es: "1 Corintios", apiKey: "1CO" },
  "1 corintios": { en: "1 Corinthians", es: "1 Corintios", apiKey: "1CO" },
  "1corinthians": { en: "1 Corinthians", es: "1 Corintios", apiKey: "1CO" },
  "1 corinthians": { en: "1 Corinthians", es: "1 Corintios", apiKey: "1CO" },
  "2corintios": { en: "2 Corinthians", es: "2 Corintios", apiKey: "2CO" },
  "2 corintios": { en: "2 Corinthians", es: "2 Corintios", apiKey: "2CO" },
  "2corinthians": { en: "2 Corinthians", es: "2 Corintios", apiKey: "2CO" },
  "2 corinthians": { en: "2 Corinthians", es: "2 Corintios", apiKey: "2CO" },
  galatas: { en: "Galatians", es: "Gálatas", apiKey: "GAL" },
  gálatas: { en: "Galatians", es: "Gálatas", apiKey: "GAL" },
  galatians: { en: "Galatians", es: "Gálatas", apiKey: "GAL" },
  efesios: { en: "Ephesians", es: "Efesios", apiKey: "EPH" },
  ephesians: { en: "Ephesians", es: "Efesios", apiKey: "EPH" },
  filipenses: { en: "Philippians", es: "Filipenses", apiKey: "PHP" },
  philippians: { en: "Philippians", es: "Filipenses", apiKey: "PHP" },
  colosenses: { en: "Colossians", es: "Colosenses", apiKey: "COL" },
  colossians: { en: "Colossians", es: "Colosenses", apiKey: "COL" },
  "1tesalonicenses": { en: "1 Thessalonians", es: "1 Tesalonicenses", apiKey: "1TH" },
  "1 tesalonicenses": { en: "1 Thessalonians", es: "1 Tesalonicenses", apiKey: "1TH" },
  "1thessalonians": { en: "1 Thessalonians", es: "1 Tesalonicenses", apiKey: "1TH" },
  "1 thessalonians": { en: "1 Thessalonians", es: "1 Tesalonicenses", apiKey: "1TH" },
  "2tesalonicenses": { en: "2 Thessalonians", es: "2 Tesalonicenses", apiKey: "2TH" },
  "2 tesalonicenses": { en: "2 Thessalonians", es: "2 Tesalonicenses", apiKey: "2TH" },
  "2thessalonians": { en: "2 Thessalonians", es: "2 Tesalonicenses", apiKey: "2TH" },
  "2 thessalonians": { en: "2 Thessalonians", es: "2 Tesalonicenses", apiKey: "2TH" },
  "1timoteo": { en: "1 Timothy", es: "1 Timoteo", apiKey: "1TI" },
  "1 timoteo": { en: "1 Timothy", es: "1 Timoteo", apiKey: "1TI" },
  "1timothy": { en: "1 Timothy", es: "1 Timoteo", apiKey: "1TI" },
  "1 timothy": { en: "1 Timothy", es: "1 Timoteo", apiKey: "1TI" },
  "2timoteo": { en: "2 Timothy", es: "2 Timoteo", apiKey: "2TI" },
  "2 timoteo": { en: "2 Timothy", es: "2 Timoteo", apiKey: "2TI" },
  "2timothy": { en: "2 Timothy", es: "2 Timoteo", apiKey: "2TI" },
  "2 timothy": { en: "2 Timothy", es: "2 Timoteo", apiKey: "2TI" },
  tito: { en: "Titus", es: "Tito", apiKey: "TIT" },
  titus: { en: "Titus", es: "Tito", apiKey: "TIT" },
  filemon: { en: "Philemon", es: "Filemón", apiKey: "PHM" },
  filemón: { en: "Philemon", es: "Filemón", apiKey: "PHM" },
  philemon: { en: "Philemon", es: "Filemón", apiKey: "PHM" },
  hebreos: { en: "Hebrews", es: "Hebreos", apiKey: "HEB" },
  hebrews: { en: "Hebrews", es: "Hebreos", apiKey: "HEB" },
  santiago: { en: "James", es: "Santiago", apiKey: "JAS" },
  james: { en: "James", es: "Santiago", apiKey: "JAS" },
  "1pedro": { en: "1 Peter", es: "1 Pedro", apiKey: "1PE" },
  "1 pedro": { en: "1 Peter", es: "1 Pedro", apiKey: "1PE" },
  "1peter": { en: "1 Peter", es: "1 Pedro", apiKey: "1PE" },
  "1 peter": { en: "1 Peter", es: "1 Pedro", apiKey: "1PE" },
  "2pedro": { en: "2 Peter", es: "2 Pedro", apiKey: "2PE" },
  "2 pedro": { en: "2 Peter", es: "2 Pedro", apiKey: "2PE" },
  "2peter": { en: "2 Peter", es: "2 Pedro", apiKey: "2PE" },
  "2 peter": { en: "2 Peter", es: "2 Pedro", apiKey: "2PE" },
  "1juan": { en: "1 John", es: "1 Juan", apiKey: "1JN" },
  "1 juan": { en: "1 John", es: "1 Juan", apiKey: "1JN" },
  "1john": { en: "1 John", es: "1 Juan", apiKey: "1JN" },
  "1 john": { en: "1 John", es: "1 Juan", apiKey: "1JN" },
  "2juan": { en: "2 John", es: "2 Juan", apiKey: "2JN" },
  "2 juan": { en: "2 John", es: "2 Juan", apiKey: "2JN" },
  "2john": { en: "2 John", es: "2 Juan", apiKey: "2JN" },
  "2 john": { en: "2 John", es: "2 Juan", apiKey: "2JN" },
  "3juan": { en: "3 John", es: "3 Juan", apiKey: "3JN" },
  "3 juan": { en: "3 John", es: "3 Juan", apiKey: "3JN" },
  "3john": { en: "3 John", es: "3 Juan", apiKey: "3JN" },
  "3 john": { en: "3 John", es: "3 Juan", apiKey: "3JN" },
  judas: { en: "Jude", es: "Judas", apiKey: "JUD" },
  jude: { en: "Jude", es: "Judas", apiKey: "JUD" },
  apocalipsis: { en: "Revelation", es: "Apocalipsis", apiKey: "REV" },
  revelation: { en: "Revelation", es: "Apocalipsis", apiKey: "REV" },
};

export interface ParsedReference {
  book: string;
  bookKey: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number | null;
  verseEnd: number | null;
  referenceDisplay: string;
  refKey: string;
}

/**
 * Clean a Bible reference by removing prepositions and extra text
 */
function cleanBibleReference(reference: string): string {
  let cleaned = reference.trim();

  // Remove common prepositions at the start (Spanish and English)
  // "En Efesios 4:32" -> "Efesios 4:32"
  // "In John 3:16" -> "John 3:16"
  cleaned = cleaned.replace(/^(en|in|from|de|según|segun|see|ver)\s+/i, "");

  return cleaned.trim();
}

/**
 * Parse a Bible reference string into structured data
 * Examples: "Lucas 10:25-37", "Juan 3:16", "1 Reyes 3:28", "Salmos 23:1-6"
 * Also supports chapter-only: "2 Samuel 11", "Salmo 51", "Génesis 37"
 */
export function parseReference(reference: string): ParsedReference | null {
  // Clean up the reference (remove prepositions, etc.)
  const cleaned = cleanBibleReference(reference);

  // Try full format first: "Book Chapter:Verse(-VerseEnd)"
  const fullRegex = /^(\d?\s*[A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)\s+(\d+):(\d+)(?:[-–](\d+))?$/i;
  const fullMatch = cleaned.match(fullRegex);

  // Fallback: chapter-only format "Book Chapter" (no verse)
  const chapterOnlyRegex = /^(\d?\s*[A-Za-záéíóúñÁÉÍÓÚÑ]+(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]+)?)\s+(\d+)$/i;
  const chapterMatch = !fullMatch ? cleaned.match(chapterOnlyRegex) : null;

  const match = fullMatch || chapterMatch;
  if (!match) {
    console.log(`[Bible] Could not parse reference: "${reference}"`);
    return null;
  }

  const isChapterOnly = !fullMatch && !!chapterMatch;
  const bookPart = match[1];
  const chapterStr = match[2];
  const verseStartStr = fullMatch ? match[3] : undefined;
  const verseEndStr = fullMatch ? match[4] : undefined;

  if (!bookPart || !chapterStr) {
    console.log(`[Bible] Missing required parts in reference: "${reference}"`);
    return null;
  }

  const bookNormalized = bookPart.toLowerCase().trim().replace(/\s+/g, " ");

  // Find the book in mappings
  const bookInfo = BOOK_MAPPINGS[bookNormalized] || BOOK_MAPPINGS[bookNormalized.replace(/\s/g, "")];
  if (!bookInfo) {
    console.log(`[Bible] Unknown book: "${bookPart}"`);
    return null;
  }

  const chapterStart = parseInt(chapterStr, 10);
  // For chapter-only refs, default to verse 1 (will fetch full chapter beginning)
  const verseStart = verseStartStr ? parseInt(verseStartStr, 10) : 1;
  const verseEnd = verseEndStr ? parseInt(verseEndStr, 10) : null;

  // For chapter-only refs, use a special refKey that won't collide with verse refs
  const refKey = isChapterOnly
    ? `${bookInfo.apiKey.toLowerCase()}_${chapterStart}_chapter`
    : createRefKey(bookInfo.apiKey, chapterStart, verseStart, verseEnd);

  return {
    book: bookPart.trim(),
    bookKey: bookInfo.apiKey,
    chapterStart,
    verseStart,
    chapterEnd: verseEnd ? chapterStart : null,
    verseEnd,
    referenceDisplay: cleaned,
    refKey,
  };
}

/**
 * Create a normalized reference key for caching
 */
function createRefKey(bookKey: string, chapter: number, verseStart: number, verseEnd: number | null): string {
  if (verseEnd && verseEnd !== verseStart) {
    return `${bookKey.toLowerCase()}_${chapter}_${verseStart}-${verseEnd}`;
  }
  return `${bookKey.toLowerCase()}_${chapter}_${verseStart}`;
}

/**
 * Get book name in the specified language
 */
export function getBookName(bookKey: string, lang: "en" | "es"): string {
  for (const [, info] of Object.entries(BOOK_MAPPINGS)) {
    if (info.apiKey === bookKey) {
      return info[lang];
    }
  }
  return bookKey;
}

/**
 * Fetch Bible passage from API.bible
 * Uses the free API.bible service
 */
async function fetchFromBibleAPI(
  bookKey: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | null,
  lang: "en" | "es"
): Promise<string | null> {
  // Bible IDs for API.bible
  // Spanish: Reina Valera 1909 = "592420522e16049f-01"
  // English: King James Version = "de4e12af7f28f599-02"
  const bibleId = lang === "es" ? "592420522e16049f-01" : "de4e12af7f28f599-02";

  // Build verse reference
  const verseRef = verseEnd ? `${bookKey}.${chapter}.${verseStart}-${bookKey}.${chapter}.${verseEnd}` : `${bookKey}.${chapter}.${verseStart}`;

  const apiKey = process.env.BIBLE_API_KEY;

  if (!apiKey) {
    console.log("[Bible] No BIBLE_API_KEY configured, using fallback method");
    return fetchFromBibleGateway(bookKey, chapter, verseStart, verseEnd, lang);
  }

  try {
    const url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/passages/${verseRef}?content-type=text&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true`;

    const response = await fetch(url, {
      headers: {
        "api-key": apiKey,
      },
    });

    if (!response.ok) {
      console.log(`[Bible] API.bible error: ${response.status}`);
      return fetchFromBibleGateway(bookKey, chapter, verseStart, verseEnd, lang);
    }

    const data = (await response.json()) as { data?: { content?: string } };
    const content = data.data?.content;

    if (content) {
      // Clean up the text
      return cleanPassageText(content);
    }

    return null;
  } catch (error) {
    console.error("[Bible] Error fetching from API.bible:", error);
    return fetchFromBibleGateway(bookKey, chapter, verseStart, verseEnd, lang);
  }
}

/**
 * Fallback: Fetch from Bible Gateway (web scraping as backup)
 */
async function fetchFromBibleGateway(
  bookKey: string,
  chapter: number,
  verseStart: number,
  verseEnd: number | null,
  lang: "en" | "es"
): Promise<string | null> {
  try {
    // Get book name for the URL
    const bookName = getBookName(bookKey, lang);
    const version = lang === "es" ? "RVR1960" : "KJV";
    const verseRange = verseEnd ? `${verseStart}-${verseEnd}` : `${verseStart}`;

    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(bookName)}+${chapter}:${verseRange}&version=${version}`;

    console.log(`[Bible] Fetching from BibleGateway: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DailyLight/1.0)",
      },
    });

    if (!response.ok) {
      console.log(`[Bible] BibleGateway error: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract passage text from HTML
    // Look for the passage-text div
    const passageMatch = html.match(/<div class="passage-text"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    if (passageMatch && passageMatch[1]) {
      let text: string = passageMatch[1];
      // Remove HTML tags but keep verse numbers
      text = text.replace(/<sup[^>]*class="versenum"[^>]*>(\d+)<\/sup>/g, "[$1] ");
      text = text.replace(/<[^>]+>/g, " ");
      text = text.replace(/&nbsp;/g, " ");
      text = text.replace(/\s+/g, " ").trim();
      return text;
    }

    // Alternative extraction
    const altMatch = html.match(/<p class="[^"]*"[^>]*>([\s\S]*?)<\/p>/g);
    if (altMatch) {
      let text = altMatch.join(" ");
      text = text.replace(/<sup[^>]*>(\d+)<\/sup>/g, "[$1] ");
      text = text.replace(/<[^>]+>/g, " ");
      text = text.replace(/\s+/g, " ").trim();
      if (text.length > 20) {
        return text;
      }
    }

    console.log("[Bible] Could not extract passage from BibleGateway");
    return null;
  } catch (error) {
    console.error("[Bible] Error fetching from BibleGateway:", error);
    return null;
  }
}

/**
 * Clean passage text from API response
 */
function cleanPassageText(text: string): string {
  return text
    .replace(/\[(\d+)\]/g, "[$1] ") // Format verse numbers
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Get Bible passage - checks cache first, then fetches from API
 */
export async function getBiblePassage(
  reference: string,
  lang: "en" | "es"
): Promise<{
  success: boolean;
  passage?: {
    referenceDisplay: string;
    text: string;
    book: string;
  };
  error?: string;
}> {
  try {
    // Parse the reference
    const parsed = parseReference(reference);
    if (!parsed) {
      return {
        success: false,
        error: lang === "es" ? "Referencia bíblica no válida" : "Invalid Bible reference",
      };
    }

    // Check database cache first
    const cached = await prisma.biblePassage.findUnique({
      where: {
        refKey_lang: {
          refKey: parsed.refKey,
          lang,
        },
      },
    });

    if (cached) {
      console.log(`[Bible] Cache hit for ${parsed.refKey} (${lang})`);
      return {
        success: true,
        passage: {
          referenceDisplay: cached.referenceDisplay,
          text: cached.text,
          book: cached.book,
        },
      };
    }

    // Fetch from API
    console.log(`[Bible] Cache miss, fetching ${parsed.refKey} (${lang})`);
    // For chapter-only references, fetch a reasonable span (verses 1–30) to give context
    const isChapterOnlyFetch = parsed.refKey.endsWith('_chapter');
    const fetchVerseStart = parsed.verseStart;
    const fetchVerseEnd = isChapterOnlyFetch ? 30 : parsed.verseEnd;
    const text = await fetchFromBibleAPI(
      parsed.bookKey,
      parsed.chapterStart,
      fetchVerseStart,
      fetchVerseEnd,
      lang
    );

    if (!text) {
      return {
        success: false,
        error: lang === "es" ? "No se pudo obtener el pasaje" : "Could not fetch passage",
      };
    }

    // Get proper book name for the language
    const bookName = getBookName(parsed.bookKey, lang);

    // Build display reference
    // For chapter-only refs (refKey ends with _chapter), show "Book Chapter"
    const isChapterOnly = parsed.refKey.endsWith('_chapter');
    const displayRef = isChapterOnly
      ? `${bookName} ${parsed.chapterStart}`
      : parsed.verseEnd
        ? `${bookName} ${parsed.chapterStart}:${parsed.verseStart}-${parsed.verseEnd}`
        : `${bookName} ${parsed.chapterStart}:${parsed.verseStart}`;

    // Cache in database
    await prisma.biblePassage.create({
      data: {
        refKey: parsed.refKey,
        lang,
        book: bookName,
        chapterStart: parsed.chapterStart,
        verseStart: parsed.verseStart,
        chapterEnd: parsed.chapterEnd,
        verseEnd: parsed.verseEnd,
        referenceDisplay: displayRef,
        text,
        source: "api",
      },
    });

    console.log(`[Bible] Cached passage: ${parsed.refKey} (${lang})`);

    return {
      success: true,
      passage: {
        referenceDisplay: displayRef,
        text,
        book: bookName,
      },
    };
  } catch (error) {
    console.error("[Bible] Error getting passage:", error);
    return {
      success: false,
      error: lang === "es" ? "Error al obtener el pasaje" : "Error fetching passage",
    };
  }
}

// ─── Chapter Verses ──────────────────────────────────────────────────────────

/**
 * Parse a raw text blob that contains inline verse markers like
 * "[1] In the beginning... [2] And the earth..."
 * into a structured array of { number, text }.
 */
function parseVersesFromText(raw: string): BibleVerse[] {
  // Normalise whitespace first
  const normalised = raw.replace(/\s+/g, " ").trim();

  // Split on every "[N]" marker (keeping the delimiter via a lookahead)
  const parts = normalised.split(/(?=\[\d+\])/).filter(Boolean);

  const verses: BibleVerse[] = [];

  for (const part of parts) {
    // Each part should start with "[N]"
    const match = part.match(/^\[(\d+)\]\s*([\s\S]*)$/);
    if (!match) continue;

    const number = parseInt(match[1]!, 10);
    const text = match[2]!.trim();

    if (text.length > 0) {
      verses.push({ number, text });
    }
  }

  return verses;
}

/**
 * Fetch a full chapter as plain verse-numbered text from API.bible.
 * Returns null on failure so the caller can fall back.
 */
async function fetchChapterFromBibleAPI(
  bookId: string,
  chapter: number,
  lang: "en" | "es"
): Promise<string | null> {
  const apiKey = process.env.BIBLE_API_KEY;
  if (!apiKey) {
    console.log("[Bible] No BIBLE_API_KEY configured for chapter fetch");
    return null;
  }

  const bibleId = lang === "es" ? "592420522e16049f-01" : "de4e12af7f28f599-02";
  const chapterId = `${bookId}.${chapter}`;
  const url =
    `https://api.scripture.api.bible/v1/bibles/${bibleId}/chapters/${chapterId}` +
    `?content-type=text&include-notes=false&include-titles=false` +
    `&include-chapter-numbers=false&include-verse-numbers=true`;

  try {
    const response = await fetch(url, {
      headers: { "api-key": apiKey },
    });

    if (!response.ok) {
      console.log(`[Bible] API.bible chapter error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { data?: { content?: string } };
    const content = data.data?.content;
    if (!content) return null;

    return content.replace(/\s+/g, " ").trim();
  } catch (error) {
    console.error("[Bible] Error fetching chapter from API.bible:", error);
    return null;
  }
}

/**
 * BibleGateway fallback for a full chapter.
 * Fetches "{BookName} {chapter}" and extracts all verses.
 */
async function fetchChapterFromBibleGateway(
  bookId: string,
  chapter: number,
  lang: "en" | "es"
): Promise<string | null> {
  try {
    const bookName = getBookName(bookId, lang);
    const version = lang === "es" ? "RVR1960" : "KJV";
    const search = `${bookName} ${chapter}`;
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(search)}&version=${version}`;

    console.log(`[Bible] BibleGateway chapter fetch: ${url}`);

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DailyLight/1.0)" },
    });

    if (!response.ok) {
      console.log(`[Bible] BibleGateway chapter error: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // ---- strategy 1: passage-text container ----
    const passageMatch = html.match(/<div class="passage-text"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    if (passageMatch?.[1]) {
      const chunk: string = passageMatch[1];
      return buildVerseTextFromBGChunk(chunk, chapter);
    }

    // ---- strategy 2: paragraph tags ----
    const paraMatches = html.match(/<p[^>]*>([\s\S]*?)<\/p>/g);
    if (paraMatches) {
      const chunk = paraMatches.join(" ");
      const result = buildVerseTextFromBGChunk(chunk, chapter);
      if (result && result.length > 20) return result;
    }

    console.log("[Bible] Could not extract chapter from BibleGateway");
    return null;
  } catch (error) {
    console.error("[Bible] Error fetching chapter from BibleGateway:", error);
    return null;
  }
}

/**
 * Convert a BibleGateway HTML chunk into a "[1] text [2] text ..." string.
 *
 * BibleGateway uses two different elements for verse numbers:
 *  - Verse 1 of a chapter: <span class="chapternum">N\xa0</span>
 *  - All other verses:     <sup class="versenum">N\xa0</sup>
 *
 * Both end in a Unicode non-breaking space (\xa0) before the closing tag.
 */
function buildVerseTextFromBGChunk(chunk: string, _chapter: number): string | null {
  let text: string = chunk;
  // Replace chapternum spans (verse 1 marker) with [1]
  // The chapternum span contains the chapter number, NOT verse 1 — it IS verse 1.
  text = text.replace(/<span[^>]*class="chapternum"[^>]*>[\s\S]*?<\/span>/g, "[1] ");
  // Replace versenum sups — digit(s) optionally followed by \xa0 before </sup>
  text = text.replace(/<sup[^>]*class="versenum"[^>]*>(\d+)[^\d<]*<\/sup>/g, "[$1] ");
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, " ").replace(/&#xa0;/gi, " ").replace(/\xa0/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text.length > 10 ? text : null;
}

/**
 * Get all verses for a full Bible chapter.
 * Checks the BiblePassage cache first (using a "full_chapter" refKey),
 * then tries API.bible, then falls back to BibleGateway scraping.
 *
 * The cached text uses the same "[1] ... [2] ..." format so it can be
 * re-parsed on every cache hit without a separate schema change.
 */
export async function getBibleChapterVerses(
  bookId: string,
  chapter: number,
  lang: "en" | "es"
): Promise<BibleChapterResult> {
  const bookIdUpper = bookId.toUpperCase();
  const refKey = `${bookIdUpper.toLowerCase()}_${chapter}_full_chapter_${lang}`;
  const bookName = getBookName(bookIdUpper, lang);

  try {
    // ---- cache lookup ----
    const cached = await prisma.biblePassage.findUnique({
      where: { refKey_lang: { refKey, lang } },
    });

    if (cached) {
      console.log(`[Bible] Chapter cache hit: ${refKey}`);
      const verses = parseVersesFromText(cached.text);
      return { success: true, verses, bookName, chapter };
    }

    // ---- fetch ----
    console.log(`[Bible] Chapter cache miss, fetching ${refKey}`);

    let rawText: string | null = await fetchChapterFromBibleAPI(bookIdUpper, chapter, lang);

    if (!rawText) {
      rawText = await fetchChapterFromBibleGateway(bookIdUpper, chapter, lang);
    }

    if (!rawText) {
      return {
        success: false,
        bookName,
        chapter,
        error: lang === "es"
          ? "No se pudo obtener el capítulo"
          : "Could not fetch chapter",
      };
    }

    const verses = parseVersesFromText(rawText);

    if (verses.length === 0) {
      return {
        success: false,
        bookName,
        chapter,
        error: lang === "es"
          ? "No se encontraron versículos en el capítulo"
          : "No verses found in chapter",
      };
    }

    // ---- persist to cache ----
    const referenceDisplay = `${bookName} ${chapter}`;
    await prisma.biblePassage.create({
      data: {
        refKey,
        lang,
        book: bookName,
        chapterStart: chapter,
        verseStart: 1,
        chapterEnd: null,
        verseEnd: null,
        referenceDisplay,
        text: rawText,
        source: "api",
      },
    });

    console.log(`[Bible] Cached chapter: ${refKey}`);

    return { success: true, verses, bookName, chapter };
  } catch (error) {
    console.error("[Bible] Error getting chapter verses:", error);
    return {
      success: false,
      bookName,
      chapter,
      error: lang === "es"
        ? "Error al obtener el capítulo"
        : "Error fetching chapter",
    };
  }
}

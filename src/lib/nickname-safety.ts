/**
 * nickname-safety.ts
 * Normalization, validation, and moderation for user nicknames.
 */

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a nickname for uniqueness checks and profanity detection.
 * Returns the normalized string (lowercase, no accents, leetspeak decoded, etc.)
 */
export function normalizeNickname(raw: string): string {
  let s = raw;

  // 1. Lowercase
  s = s.toLowerCase();

  // 2. Remove accents/diacritics
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 3. Leetspeak substitutions (applied after diacritics removal)
  s = s
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/9/g, "g")
    .replace(/6/g, "g")
    .replace(/\(/g, "c")
    .replace(/\+/g, "t")
    .replace(/>/g, "s");

  // 4. Remove separators/spaces/punctuation between letters
  //    (so "p.u.t.a" or "p u t a" match "puta")
  s = s.replace(/[\s\._\-,;:'"!?@#$%^&*()\[\]{}<>/\\|~`+=]+/g, "");

  // 5. Collapse repeated consecutive letters (coooño -> coño, sssex -> sex)
  s = s.replace(/(.)\1{2,}/g, "$1$1");

  return s;
}

// ─── Denylist ─────────────────────────────────────────────────────────────────

/**
 * HARD_BLOCK: Always reject. Includes Spanish + English profanity and slurs.
 * These are substring-matched against the normalized nickname.
 */
const HARD_BLOCK: string[] = [
  // Spanish profanity
  "puta", "puto", "putita", "puton", "putona",
  "mierda", "mierd",
  "cono", "cono", "cojon", "cojone", "cojones",
  "verga", "vergon", "vergota",
  "culo", "culon",
  "pene", "polla", "pollon",
  "vagina", "vagi",
  "cabron", "cabrona",
  "hijoputa", "hijoput",
  "hijueputa", "hijueput", "hijuep",   // Colombian variant (hijue = hijo de)
  "hijadeputa", "hijadeput",           // feminine form
  "pendejo", "pendeja",
  "chingada", "chingo", "chinga", "chingas",
  "culero", "culera",
  "joto", "jota",
  "maricon", "marica",
  "pederast", "pedofil",
  "violador", "viola",
  "prostitut",
  "perra", "perron",
  "gonorrea", "gonorre",
  "mamada", "mama",  // "mamada" specifically
  "ojete",
  "naco", "naca",
  "guebon", "huebon", "webon",
  "idiot", "idiota",
  "imbecil",
  "estupid",
  "bastard",
  "zorra", "zorron",
  "piche", "picha",
  "cipote",
  "carajo",
  "concha",    // Argentine
  "boludo", "boluda",
  "forro", "forra",
  "pelotudo",
  "sorete",
  "gil",
  "hdp", "hjp", "hjdp", // hijo de puta abbreviations
  "mrd",       // mierda abbreviation
  // English profanity
  "fuck", "fucker", "fuckin",
  "shit", "shitt",
  "bitch", "biatch",
  "cunt",
  "asshole", "ashole",
  "nigger", "nigga",
  "faggot", "faget",
  "whore",
  "slut",
  "cock", "cok",
  "pussy",
  "dick", "dik",
  "bastard",
  "motherfuck",
  "rape", "rapist",
  "pedophil", "pedo",
  "nazi", "hitler",
  "kkk",
  // Common bypass attempts
  "sex", "sexi", "sexy",
  "porn", "porno",
  "xxx",
];

/**
 * SOFT_FLAG: Borderline words. We block these too for simplicity (option a).
 * Could be reviewed for moderation workflow later.
 */
const SOFT_FLAG: string[] = [
  "diablo", "demonio", "satan", "lucifer",
  "muerte", "matar", "mato",
  "drogas", "droga", "cocain", "heroina",
  "suicid",
  "terror", "terroris",
  "bomb",
  "kill", "killer", "killing",
  "dead", "death",
  "blood", "sangre",
  "hate", "odio",
  "racist", "racis",
];

/** Check if normalized name contains any blocked substring */
function containsBlocked(normalized: string, list: string[]): string | null {
  for (const term of list) {
    if (normalized.includes(term)) {
      return term;
    }
  }
  return null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface NicknameValidationResult {
  ok: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Full nickname validation pipeline:
 * 1. Length check
 * 2. Allowed chars check (raw)
 * 3. Reject all-digits
 * 4. Reject URL/email/phone patterns
 * 5. Normalize
 * 6. HARD_BLOCK check
 * 7. SOFT_FLAG check (blocked as well)
 */
export function validateNickname(raw: string): NicknameValidationResult {
  // 1. Length
  if (raw.length < 3 || raw.length > 20) {
    return { ok: false, error: "El nickname debe tener entre 3 y 20 caracteres." };
  }

  // 2. Allowed characters: letters, numbers, underscore, dot, dash
  if (!/^[a-zA-Z0-9À-ÿ_.\-]+$/.test(raw)) {
    return { ok: false, error: "El nickname solo puede contener letras, números, guión bajo, punto y guión." };
  }

  // 3. Reject all-digits
  if (/^\d+$/.test(raw)) {
    return { ok: false, error: "El nickname no puede contener solo números." };
  }

  // 4. Reject URL/email/phone patterns
  if (/https?:\/\//i.test(raw) || /www\./i.test(raw)) {
    return { ok: false, error: "El nickname no puede contener URLs." };
  }
  if (/@/.test(raw) && /\.[a-z]{2,}$/i.test(raw)) {
    return { ok: false, error: "El nickname no puede ser un correo electrónico." };
  }
  if (/^\+?[\d\s\-().]{7,}$/.test(raw)) {
    return { ok: false, error: "El nickname no puede ser un número de teléfono." };
  }

  // 5. Normalize
  const normalized = normalizeNickname(raw);

  // 6. HARD_BLOCK check
  const hardMatch = containsBlocked(normalized, HARD_BLOCK);
  if (hardMatch) {
    return { ok: false, error: "Nombre no permitido." };
  }

  // 7. SOFT_FLAG (blocked for simplicity)
  const softMatch = containsBlocked(normalized, SOFT_FLAG);
  if (softMatch) {
    return { ok: false, error: "Nombre no permitido." };
  }

  return { ok: true, normalized };
}

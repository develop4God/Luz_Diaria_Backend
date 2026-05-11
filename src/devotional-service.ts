import { prisma } from "./prisma";
import { env } from "./env";

// Topics for devotionals - cycles through these
const TOPICS = [
  // Classic spiritual virtues
  { en: "Faith", es: "Fe" },
  { en: "Love", es: "Amor" },
  { en: "Hope", es: "Esperanza" },
  { en: "Peace", es: "Paz" },
  { en: "Joy", es: "Gozo" },
  { en: "Patience", es: "Paciencia" },
  { en: "Kindness", es: "Bondad" },
  { en: "Forgiveness", es: "Perdón" },
  { en: "Gratitude", es: "Gratitud" },
  { en: "Courage", es: "Valentía" },
  { en: "Trust", es: "Confianza" },
  { en: "Humility", es: "Humildad" },
  { en: "Wisdom", es: "Sabiduría" },
  { en: "Perseverance", es: "Perseverancia" },
  { en: "Compassion", es: "Compasión" },
  { en: "Grace", es: "Gracia" },
  { en: "Mercy", es: "Misericordia" },
  { en: "Obedience", es: "Obediencia" },
  { en: "Holiness", es: "Santidad" },
  { en: "Faithfulness", es: "Fidelidad" },
  { en: "Surrender", es: "Rendición" },
  { en: "Purpose", es: "Propósito" },
  { en: "Renewal", es: "Renovación" },
  { en: "Restoration", es: "Restauración" },
  { en: "Salvation", es: "Salvación" },
  { en: "Redemption", es: "Redención" },
  { en: "Praise", es: "Alabanza" },
  { en: "Worship", es: "Adoración" },
  { en: "Prayer", es: "Oración" },
  { en: "Community", es: "Comunidad" },
  { en: "Service", es: "Servicio" },
  // Real-life human and Christian contexts
  { en: "Waiting on God", es: "Fe en la espera" },
  { en: "Hard Decisions", es: "Decisiones difíciles" },
  { en: "Spiritual Weariness", es: "Cansancio espiritual" },
  { en: "Family", es: "Familia" },
  { en: "Guilt and Grace", es: "Culpa y gracia" },
  { en: "Fear", es: "Temor" },
  { en: "Spiritual Discipline", es: "Disciplina espiritual" },
  { en: "Work and Calling", es: "Trabajo y vocación" },
  { en: "Youth and Identity", es: "Juventud e identidad" },
  { en: "Grief and Loss", es: "Duelo y pérdida" },
  { en: "Everyday Faithfulness", es: "Fidelidad en la rutina" },
  { en: "New Beginnings", es: "Nuevos comienzos" },
  { en: "Loneliness", es: "Soledad" },
  { en: "Doubt and Questions", es: "Dudas y preguntas" },
  { en: "Identity in Christ", es: "Identidad en Cristo" },
  { en: "Letting Go", es: "Soltar el control" },
  { en: "Broken Relationships", es: "Relaciones rotas" },
  { en: "Anxiety", es: "Ansiedad" },
  { en: "Disappointment with God", es: "Desilusión con Dios" },
  { en: "Serving Unseen", es: "Servir sin ser visto" },
];

// Words severely overused in devotional titles — hard ban (both ES and EN)
const QUARANTINE_WORDS = [
  // Spanish overused words
  'susurro', 'susurros', 'silencio', 'medianoche', 'sagrado', 'sagrada',
  'penumbra', 'sombras', 'nocturno', 'nocturna', 'quietud', 'tinieblas',
  'crepúsculo', 'alborada', 'bruma', 'umbral', 'destello', 'resplandor',
  'amanecer', 'atardecer', 'oscuridad', 'luz tenue', 'madrugada',
  // English equivalents — also overused in English titles
  'whisper', 'whispers', 'silence', 'silent', 'midnight', 'sacred',
  'shadows', 'shadow', 'darkness', 'dark', 'stillness', 'still',
  'dawn', 'dusk', 'glow', 'gleam', 'shimmer', 'broken souls', 'shattered',
];

// Story settings and scenarios that are severely overused — forbidden in storyEs/story
const QUARANTINE_STORY_SETTINGS = [
  'las 3 de la mañana', 'las tres de la mañana', '3 a.m.', 'las 3 am',
  'la madrugada', 'a la madrugada', 'en la madrugada', 'de madrugada',
  'penumbra', 'en la penumbra', 'entre sombras',
  'amanecer en el campo', 'montaña en la niebla', 'lago tranquilo',
  'playa solitaria', 'bosque en silencio', 'campo al amanecer',
  'la luz del alba', 'los primeros rayos del sol',
  'a la luz de una vela', 'bajo las estrellas',
  'en la oscuridad de la noche', 'la noche más oscura',
];

// Title format types for rotating variety
const TITLE_FORMATS = [
  {
    id: 'AFIRMACION',
    instruction: 'FORMATO DE TÍTULO — Afirmación directa: una verdad declarada con fuerza y convicción. Ejemplos del estilo correcto: "Dios no desperdicia tu proceso", "La fe que sigue caminando", "Dios también habla en días comunes". Debe sonar como una declaración que alguien necesita escuchar hoy.',
  },
  {
    id: 'PREGUNTA',
    instruction: 'FORMATO DE TÍTULO — Pregunta genuina: que invite a detenerse y reflexionar. No retórica — debe sentirse como una pregunta real. Ejemplos: "¿Qué haces cuando ya no puedes más?", "¿Y si Dios está en lo que no entiendes?", "¿Cuánto tiempo más, Señor?". La pregunta debe tocar algo que el lector ya se ha preguntado en secreto.',
  },
  {
    id: 'CONTRASTE',
    instruction: 'FORMATO DE TÍTULO — Contraste o tensión: dos realidades opuestas en una sola frase. Ejemplos: "Cuando el cansancio se convierte en oración", "Lo que aprendes cuando ya no controlas nada", "A veces la paz llega paso a paso". La tensión entre las dos ideas es lo que engancha al lector.',
  },
  {
    id: 'ESCENA_CONCRETA',
    instruction: 'FORMATO DE TÍTULO — Escena cotidiana concreta: un momento de vida real que el lector reconoce. Ejemplos: "Cuando el corazón se cansa de esperar", "En los días que nadie ve", "El día que Dios llegó tarde (y no llegó tarde)". Debe evocar una situación específica, no un concepto abstracto.',
  },
  {
    id: 'APLICACION',
    instruction: 'FORMATO DE TÍTULO — Aplicación espiritual: una acción, actitud o disposición del creyente. Ejemplos: "La obediencia que nadie aplaude", "Servir también es una forma de amar", "Volver a empezar no es rendirse". Debe sonar como algo que el lector puede y debe hacer o encarnar.',
  },
] as const;

// Tone styles for rotating variety — no two consecutive devotionals should use the same tone
const TONE_STYLES = [
  {
    id: 'PASTORAL',
    instruction: 'TONO DEL DEVOCIONAL — Pastoral y cálido: Escribe como un pastor que conoce de cerca a su congregación. Voz cercana, afectuosa, que acompaña sin juzgar. Como un abrazo escrito. La persona debe sentir que alguien la ve y la cuida mientras lee.',
  },
  {
    id: 'PRACTICO',
    instruction: 'TONO DEL DEVOCIONAL — Directo y práctico: Ve al grano. Menos poesía, más claridad y acción. Habla claro sobre el problema real de hoy y ofrece verdad bíblica aplicable ahora. Que cada párrafo tenga peso y dirección. El lector debe terminar sabiendo exactamente qué hacer.',
  },
  {
    id: 'ESPERANZADOR',
    instruction: 'TONO DEL DEVOCIONAL — Esperanzador y alentador: El peso del camino es real y no lo minimices. Pero la mirada siempre apunta hacia adelante. Cada párrafo debe dejar al lector con más esperanza que al comenzar. El tono es el de alguien que ya salió del túnel y le cuenta al que todavía está adentro.',
  },
  {
    id: 'CONFRONTATIVO',
    instruction: 'TONO DEL DEVOCIONAL — Confrontativo con amor: Di lo que necesita escucharse aunque incomode. Habla a la comodidad espiritual disfrazada de paz, al orgullo disfrazado de humildad, a la postergación de la obediencia. Pero siempre desde el amor genuino, nunca desde el juicio. Como un amigo que te dice la verdad porque te quiere.',
  },
  {
    id: 'REFLEXIVO',
    instruction: 'TONO DEL DEVOCIONAL — Reflexivo y contemplativo: Invita al lector a detenerse, respirar y mirar hacia adentro con honestidad. No hay prisa. Espacio para la introspección, las preguntas sin respuesta fácil y el silencio interior ante Dios. Que el devocional se sienta como una conversación lenta y profunda.',
  },
  {
    id: 'COTIDIANO',
    instruction: 'TONO DEL DEVOCIONAL — Sencillo y cotidiano: Como una conversación honesta entre amigos un martes por la mañana. Sin lenguaje religioso elevado, sin palabras que suenen a sermón. Simple, directo, humano. La fe vivida en la rutina real de los días ordinarios. Que cualquier persona lo entienda sin glosario.',
  },
] as const;

// Content structure templates — rotate to avoid monotony
const CONTENT_STRUCTURES = [
  {
    id: 'PROBLEMA_VERDAD_APLICACION',
    instruction: 'ESTRUCTURA DEL CONTENIDO — Problema real → Verdad bíblica → Aplicación: Comienza identificando una lucha, tensión o dolor real que el lector reconoce en su vida. No lo suavices demasiado rápido. Luego deja que la Escritura entre como respuesta viva y concreta. Cierra con pasos reales para hoy, no ideales abstractos.',
  },
  {
    id: 'HISTORIA_BIBLICA_LECCION_ORACION',
    instruction: 'ESTRUCTURA DEL CONTENIDO — Personaje bíblico → Lección → Oración de aplicación: El personaje bíblico es el punto de entrada y el espejo. Muestra su humanidad, su lucha, su transformación. Extrae la lección como algo que el lector también puede vivir. La oración cierra el ciclo conectando la historia antigua con el corazón de hoy.',
  },
  {
    id: 'ESCENA_COTIDIANA_REFLEXION_ACCION',
    instruction: 'ESTRUCTURA DEL CONTENIDO — Escena de vida diaria → Reflexión espiritual → Acción concreta: Empieza con un momento específico de vida cotidiana (el café de la mañana, un mensaje sin respuesta, una decisión pendiente, el cansancio del trabajo). Desde esa escena construye la verdad espiritual. Termina con algo concreto que el lector puede hacer hoy mismo.',
  },
  {
    id: 'PREGUNTA_DESARROLLO_ESPERANZA',
    instruction: 'ESTRUCTURA DEL CONTENIDO — Pregunta fuerte → Desarrollo honesto → Esperanza final: Abre con una pregunta que el lector ya se ha hecho pero quizás no se ha atrevido a decir en voz alta. Desarrolla la tensión sin resolverla demasiado rápido — honra el peso de la pregunta. Llega a la esperanza como quien llega al amanecer después de una larga noche: gradual, real, ganada.',
  },
] as const;

// Devotional images from Unsplash — pool of 30 to cycle ~monthly
const IMAGES = [
  // ── Original 12 (preserved) ──────────────────────────────────────────────
  "https://images.unsplash.com/photo-1507692049790-de58290a4334?w=800&q=80", // Sunrise over mountains
  "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=800&q=80", // Golden field
  "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800&q=80", // Misty forest
  "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=80", // Sunlight through trees
  "https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=80", // Ocean waves
  "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&q=80", // Flowers in light
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80", // Mountain valley
  "https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80", // Lake reflection
  "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800&q=80", // Waterfall
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80", // Mountain sunrise
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80", // Forest path
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800&q=80", // Valley view
  // ── New: Spiritual & light ────────────────────────────────────────────────
  "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800&q=80", // Cross silhouette at sunset
  "https://images.unsplash.com/photo-1531901599143-df5010ab9438?w=800&q=80", // Light rays through forest cathedral
  "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80", // Hands in prayer
  // ── New: Stars & cosmos ───────────────────────────────────────────────────
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80", // Milky way over mountains
  "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=800&q=80", // Starry night sky
  "https://images.unsplash.com/photo-1523712999610-f77fbcfc3843?w=800&q=80", // Aurora borealis
  // ── New: Desert & biblical landscapes ────────────────────────────────────
  "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&q=80", // Desert sand dunes
  "https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=800&q=80", // Arid desert landscape
  "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80", // Ancient olive grove
  // ── New: Dawn & golden hour ───────────────────────────────────────────────
  "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80", // Dramatic mountain dawn
  "https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&q=80", // Golden sunrise over fields
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80", // Mountain peaks at first light
  // ── New: Water & reflection ───────────────────────────────────────────────
  "https://images.unsplash.com/photo-1458668383970-8ddd3927deed?w=800&q=80", // Mirror-still mountain lake
  "https://images.unsplash.com/photo-1500259783852-0ca9ce8a64dc?w=800&q=80", // Misty river valley
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80", // Sea cliff at dawn
  // ── New: Forest & pastoral ────────────────────────────────────────────────
  "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80", // Forest god-rays
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80", // Pastoral rolling hills
  "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80", // Dramatic heavenly clouds
];

function getTodayDate(): string {
  // Intl.DateTimeFormat is the canonical, DST-safe way to get CR date
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')?.value ?? '';
    const m = parts.find(p => p.type === 'month')?.value ?? '';
    const d = parts.find(p => p.type === 'day')?.value ?? '';
    const result = `${y}-${m}-${d}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(result)) return result;
  } catch {}
  // Static UTC-6 fallback — CR has no DST so this is always correct for CR time
  const crMs = Date.now() - 6 * 60 * 60 * 1000;
  const cr = new Date(crMs);
  return `${cr.getUTCFullYear()}-${String(cr.getUTCMonth() + 1).padStart(2, '0')}-${String(cr.getUTCDate()).padStart(2, '0')}`;
}

/** Returns the 1-based day-of-year for a YYYY-MM-DD string, computed entirely in UTC so the result is timezone-independent */
function dayOfYearUTC(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const target = Date.UTC(y, m - 1, d);
  const jan1 = Date.UTC(y, 0, 1);
  return Math.round((target - jan1) / 86400000) + 1;
}

export function getTopicForDate(date: string): { en: string; es: string } {
  const idx = (dayOfYearUTC(date) - 1) % TOPICS.length;
  return TOPICS[idx]!;
}

function getImageForDate(date: string): string {
  const idx = (dayOfYearUTC(date) - 1) % IMAGES.length;
  return IMAGES[idx]!;
}

interface DevotionalContent {
  title: string;
  titleEs: string;
  bibleVerse: string;
  bibleVerseEs: string;
  bibleReference: string;
  bibleReferenceEs: string;
  reflection: string;
  reflectionEs: string;
  story: string;
  storyEs: string;
  biblicalCharacter: string;
  biblicalCharacterEs: string;
  application: string;
  applicationEs: string;
  prayer: string;
  prayerEs: string;
}

// Counter to track story style variation (persisted in-memory per server session)
let storyGenerationCount = 0;

/** Extracts the protagonist first name from the opening of a story */
function extractProtagonistName(story: string): string | null {
  // Match the first capitalized word (2+ chars) that isn't a common non-name word
  const SKIP = new Set(['She','He','The','His','Her','They','When','As','It','In','On','At','An',
    'Una','Un','El','La','Los','Las','Era','Fue','Uno','Algo','Todo','Este','Esta','Esa',
    'That','This','There','Then','With','From','After','Before','While','During']);
  const words = story.slice(0, 300).match(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\b/g) ?? [];
  return words.find(w => !SKIP.has(w)) ?? null;
}

/** Extracts significant words (4+ chars, lowercase) from a title for frequency analysis */
function extractTitleWords(title: string): string[] {
  const STOP = new Set([
    'para','como','cuando','donde','desde','hasta','entre','sobre','también','después',
    'antes','aunque','porque','pero','sino','pues','más','menos','muy','todo','toda',
    'todos','todas','este','esta','esto','ese','esa','eso','por','que','del','los','las',
    'con','una','unos','unas','ser','fue','era','han','has','hay','hoy','bien','sólo','solo',
    'algo','nada','cada','otro','otra','ellos','ellas','ello','aquí','allí','ahí',
  ]);
  return title
    .toLowerCase()
    .replace(/[¿?¡!.,;:]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP.has(w));
}

/** Determines which tone style to use for a given date to avoid consecutive repetition */
function selectToneStyle(date: string): typeof TONE_STYLES[number] {
  // Use a combination of day-of-year and week number to vary tones
  const day = dayOfYearUTC(date);
  const idx = Math.floor(day / 2) % TONE_STYLES.length;
  return TONE_STYLES[idx]!;
}

/** Determines which title format to use for a given date */
function selectTitleFormat(date: string): typeof TITLE_FORMATS[number] {
  const day = dayOfYearUTC(date);
  const idx = Math.floor(day / 3) % TITLE_FORMATS.length;
  return TITLE_FORMATS[idx]!;
}

/** Determines which content structure to use for a given date */
function selectContentStructure(date: string): typeof CONTENT_STRUCTURES[number] {
  const day = dayOfYearUTC(date);
  const idx = Math.floor(day / 5) % CONTENT_STRUCTURES.length;
  return CONTENT_STRUCTURES[idx]!;
}

interface GenerationContext {
  usedNames?: string[];
  /** Words that appear frequently in recent titles — avoid repeating these */
  overusedTitleWords?: string[];
  toneStyle?: typeof TONE_STYLES[number];
  titleFormat?: typeof TITLE_FORMATS[number];
  contentStructure?: typeof CONTENT_STRUCTURES[number];
}

export async function generateDevotionalWithAI(
  topic: { en: string; es: string },
  context: GenerationContext = {},
): Promise<DevotionalContent> {
  storyGenerationCount++;

  const {
    usedNames = [],
    overusedTitleWords = [],
    toneStyle = TONE_STYLES[storyGenerationCount % TONE_STYLES.length]!,
    titleFormat = TITLE_FORMATS[storyGenerationCount % TITLE_FORMATS.length]!,
    contentStructure = CONTENT_STRUCTURES[storyGenerationCount % CONTENT_STRUCTURES.length]!,
  } = context;

  // Determine story style variation based on count
  const useNoName = storyGenerationCount % 5 === 0; // 1 in 5: no names at all
  const useFirstPerson = storyGenerationCount % 10 === 0; // 1 in 10: first person "I felt..."
  const endWithQuestion = storyGenerationCount % 3 === 0; // ~1 in 3: end with a question instead of conclusion

  // Build anti-repetition word block for the title
  const allRestrictedWords = [...new Set([...QUARANTINE_WORDS, ...overusedTitleWords])];
  const titleWordRestrictions = `PALABRAS/WORDS ABSOLUTAMENTE PROHIBIDAS EN EL TÍTULO — EN AMBOS IDIOMAS (error de calidad si aparecen en el título en español O en inglés): ${allRestrictedWords.join(', ')}.
Estas palabras están sobre-representadas en los devocionales recientes y crean títulos predecibles y repetitivos. This applies equally to the English "title" field — do NOT use these words in either language's title.`;

  const storySettingRestrictions = `AMBIENTACIONES Y ESCENARIOS PROHIBIDOS EN LA HISTORIA (no usar ninguno de estos — son clichés agotados):
${QUARANTINE_STORY_SETTINGS.map(s => `• "${s}"`).join('\n')}
Estas ambientaciones aparecen constantemente en la generación automática y hacen que todas las historias suenen iguales. Si el AI genera una escena a las 3am, en la madrugada, en la penumbra, al amanecer en el campo, o bajo las estrellas — será rechazada. Usa en cambio: la cocina un miércoles por la tarde, el tráfico, la sala de espera de un médico, el trabajo, el camino de regreso a casa, una llamada de teléfono, un mensaje sin respuesta.`;

  const storyStyleInstructions = `
=== INSTRUCCIONES ESPECÍFICAS PARA ESTA HISTORIA (seguir al pie de la letra) ===
${useNoName
  ? `IDENTIDAD DEL PROTAGONISTA: No uses nombres propios en absoluto. Refiere al protagonista únicamente como "una mujer", "un joven", "alguien que…", "ella", "él", "una madre", "un hombre mayor", etc. Esto hace que cualquier lector sienta que podría ser su propia historia.`
  : `IDENTIDAD DEL PROTAGONISTA: Usa un nombre POCO COMÚN o INUSUAL para el protagonista — evita absolutamente nombres comunes como María, Juan, Pedro, Ana, Carlos, Laura, José. Elige un nombre bíblico o inusual. Considera nombres como: Tadeo, Noa, Lía, Adara, Simei, Tomás, Hadasa, Zoe, Caleb, Débora, Rufina, Isamar, Leví, Jada, Eliú, Selah, Jairo, Neftalí, Abigaíl, Gersón, Tamar, Rut, Booz, Amós, Priscila, Aquila, Epafras, Tíquico, Onésimo, Clemente, Lidia, Febe, Dorcas, Cornelio, Esteban, Felipe, Bernabé. También puedes mezclar: nombre para el protagonista y descripciones para los demás.`}

${useFirstPerson
  ? `VOZ NARRATIVA: Escribe en PRIMERA PERSONA — como un testimonio personal íntimo. Usa frases como "Yo sentí…", "Recuerdo cuando…", "Fue una mañana que…", "No supe cómo explicarlo, pero…", "Algo dentro de mí se quebró…". Debe sentirse como alguien contando su historia más vulnerable ante Dios.`
  : `VOZ NARRATIVA: Escribe en tercera persona, pero desde lo MÁS PROFUNDO del mundo interior del protagonista. No narres hechos externos — narra lo que él/ella sentía, temía, esperaba, callaba. El lector debe olvidar que está leyendo una historia y sentir que está dentro del alma de esa persona.`}

${endWithQuestion
  ? `CIERRE: NO termines con una conclusión, moraleja ni frase esperanzadora directa. Cierra con una PREGUNTA ESPIRITUAL PODEROSA Y ABIERTA que haga al lector detenerse y preguntarse algo sobre su propia fe, su propio corazón o su relación con Dios. La pregunta no debe ser retórica — debe sentirse genuina, profunda, casi incómoda en su honestidad.`
  : `CIERRE: Termina con un instante humano y real — no una lección teológica, sino una verdad sentida en el cuerpo. Un momento donde algo cambia dentro del protagonista. Cierra con una frase breve y poderosa que haga al lector sentir que Dios también está cerca de él ahora mismo.`}
`;

  const prompt = `Eres un escritor devocional cristiano con un don extraordinario para historias profundamente conmovedoras, espiritualmente íntimas y emocionalmente devastadoras en el mejor sentido — historias que hacen llorar, que restauran el alma, que hacen sentir a quien las lee que Dios lo vio, lo conoce y lo ama.

Genera un devocional diario completo sobre el tema "${topic.en}" / "${topic.es}".

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta (sin markdown, sin bloques de código, solo JSON puro):

{
  "title": "Título en inglés — ver instrucciones de formato más abajo.",
  "titleEs": "Título en español — ver instrucciones de formato más abajo.",
  "bibleVerse": "Un versículo bíblico relevante en inglés, entre comillas. Elige versículos que sean profundamente consoladores, transformadores o que generen impacto emocional real.",
  "bibleVerseEs": "Mismo versículo en español — versión Reina-Valera o NVI, entre comillas",
  "bibleReference": "Referencia bíblica en inglés (ej: 'Psalm 23:1' o '1 Corinthians 13:4-7')",
  "bibleReferenceEs": "Misma referencia en español con nombre del libro traducido (ej: 'Salmo 23:1' o '1 Corintios 13:4-7')",
  "reflection": "Una reflexión profunda, espiritual y accesible sobre el tema (3-4 párrafos, aprox. 200-250 palabras). NO expliques el versículo académicamente. Conecta la Escritura con el dolor real de las personas, con sus miedos cotidianos. Habla como alguien que ha sufrido y ha encontrado a Dios en el sufrimiento.",
  "reflectionEs": "Misma reflexión en español — que fluya de manera natural y emocionalmente resonante, no como traducción",
  "storyEs": "UNA HISTORIA DEVOCIONAL INSPIRADORA E IMPACTANTE (3-4 párrafos, aprox. 220-270 palabras). SIGUE LAS INSTRUCCIONES DE ESTILO A CONTINUACIÓN. Esta es la versión PRINCIPAL de la historia — compuesta directamente en español con toda la riqueza emocional, espiritual y narrativa. Debe sentirse como un TESTIMONIO REAL DE VIDA — no como una parábola ni un ejemplo ilustrativo. Debe tener: (1) un momento de crisis o quiebre genuino con detalles cotidianos concretos como lugar, hora, pequeño gesto; (2) una intervención clara de Dios — puede ser a través de una oración, un versículo que llega en el momento justo, un acto de fe, un pequeño milagro o una transformación interior profunda; (3) una transformación visible del antes al después. Prioriza las emociones internas intensas: miedo, dolor, esperanza, culpa, alivio, gozo, fe renovada. Incluye al menos una frase que se quede grabada en el corazón del lector.",
  "story": "Misma historia adaptada al inglés — preservando cada matiz emocional y espiritual de la versión en español. La versión en inglés debe sentirse tan íntima y poderosa como el original, no como una traducción literal.",
  "biblicalCharacter": "Una sección sobre un personaje bíblico que ejemplificó esta virtud de manera profunda y humana (2-3 párrafos, aprox. 150-200 palabras). No hagas un resumen biográfico — muestra el momento de quiebre y transformación de ese personaje. Incluye referencias bíblicas específicas.",
  "biblicalCharacterEs": "Misma sección en español",
  "application": "2-3 aplicaciones prácticas para hoy — concretas, específicas y alcanzables. No ideales abstractos. Acciones reales que una persona puede hacer hoy, ahora, en su vida cotidiana. Escríbelas con calidez, no como mandatos.",
  "applicationEs": "Mismas aplicaciones en español",
  "prayer": "Una oración de aprox. 100-120 palabras. Que sea una conversación REAL, íntima y profunda con Dios — no un texto litúrgico formal. Que incluya el peso emocional del tema: nombra el dolor, el miedo o la esperanza. Que el lector sienta que alguien escribió esta oración desde sus propias rodillas.",
  "prayerEs": "Misma oración en español — que fluya con naturalidad, emoción y fe auténtica"
}

${storyStyleInstructions}

=== SISTEMA ANTI-REPETICIÓN (CRÍTICO — respetar al máximo) ===

${titleWordRestrictions}

${storySettingRestrictions}

${toneStyle.instruction}

${titleFormat.instruction}

${contentStructure.instruction}

=== LINEAMIENTOS GLOBALES (aplicar siempre, sin excepción) ===

AUTENTICIDAD HUMANA:
- Escribe como un testimonio íntimo y humano, NUNCA como un texto informativo, documental o de sermón genérico
- El lector debe sentir: "esto le pudo pasar a alguien como yo" — o incluso "esto ME pasó a mí"
- Prioriza emociones internas intensas: miedo real, dolor auténtico, esperanza frágil, culpa que aplasta, alivio que libera, gozo que sorprende, fe renovada contra toda lógica
- Evita explicaciones largas o moralizantes — la enseñanza debe surgir naturalmente de la historia
- Nunca "resuelvas" la historia demasiado rápido — deja respirar el dolor antes de la redención

DETALLES CONCRETOS:
- Incluye detalles cotidianos específicos que hagan la historia sentirse real: el lugar exacto, la hora del día, un gesto pequeño, una frase dicha en voz baja, el olor de algo, la textura de un momento
- Los detalles específicos son los que hacen llorar — no los conceptos abstractos
- ESCENAS DONDE UBICAR LA HISTORIA (variar entre estas): la cocina un día de semana, el tráfico de regreso a casa, la sala de espera de un médico, el trabajo un martes cualquiera, un mensaje en el celular que no llega, una llamada que no contestan, la mesa del comedor, una reunión de trabajo, el supermercado, recoger a los hijos del colegio, pagar las cuentas del mes. Son escenas de vida real donde Dios también aparece.

VARIEDAD DE APERTURA:
- Cada historia debe iniciar de manera diferente — varía la apertura: a veces con una imagen concreta, a veces con una emoción sin nombre, a veces con un diálogo real, a veces con una pregunta, a veces con un objeto específico
- Varía el ritmo: algunas historias pueden ser lentas y contemplativas, otras urgentes y angustiantes

OBJETIVO FINAL:
- Que cada historia se sienta ÚNICA, MEMORABLE e IMPACTANTE
- Que el lector NO sienta que leyó "otro devocional más", sino algo que tocó su corazón hoy
- Que después de leer, el lector quiera orar — o simplemente quedarse en silencio ante Dios

IDIOMA Y CALIDAD:
- El español debe ser el idioma principal de calidad — natural, emocionalmente resonante, NUNCA traducción literal
- Todo el contenido debe ser bíblicamente sólido y teológicamente correcto
- Evita clichés religiosos gastados — busca expresiones frescas y auténticas`;

  console.log(`[Devotional] Generating devotional for topic: ${topic.en}...`);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Devotional] OpenAI API error: ${response.status} - ${errorText}`);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const textContent = data.choices?.[0]?.message?.content ?? "";

  if (!textContent) {
    console.error(`[Devotional] No text content in response:`, JSON.stringify(data, null, 2));
    throw new Error("No text content in OpenAI response");
  }

  // Clean the response - remove markdown code blocks if present
  let cleanedContent = textContent.trim();
  if (cleanedContent.startsWith("```json")) {
    cleanedContent = cleanedContent.slice(7);
  } else if (cleanedContent.startsWith("```")) {
    cleanedContent = cleanedContent.slice(3);
  }
  if (cleanedContent.endsWith("```")) {
    cleanedContent = cleanedContent.slice(0, -3);
  }
  cleanedContent = cleanedContent.trim();

  try {
    const devotionalContent = JSON.parse(cleanedContent) as DevotionalContent;
    // Normalize fields that GPT sometimes returns as arrays instead of strings
    if (Array.isArray(devotionalContent.application)) {
      devotionalContent.application = (devotionalContent.application as string[]).join('\n');
    }
    if (Array.isArray(devotionalContent.applicationEs)) {
      devotionalContent.applicationEs = (devotionalContent.applicationEs as string[]).join('\n');
    }
    console.log(`[Devotional] Successfully generated devotional: "${devotionalContent.title}"`);
    return devotionalContent;
  } catch (parseError) {
    console.error(`[Devotional] Failed to parse JSON (first 800 chars):`, cleanedContent.substring(0, 800));
    throw new Error("Failed to parse devotional content as JSON");
  }
}

export async function generateTodayDevotional(): Promise<void> {
  const today = getTodayDate();

  // Check if we already have today's devotional
  const existing = await prisma.devotional.findUnique({
    where: { date: today },
  });

  if (existing) {
    console.log(`[Devotional] Devotional for ${today} already exists: "${existing.title}"`);
    return;
  }

  const topic = getTopicForDate(today);
  const imageUrl = getImageForDate(today);

  try {
    const content = await generateDevotionalWithAI(topic);

    // Use upsert to avoid race conditions on server restart
    await prisma.devotional.upsert({
      where: { date: today },
      update: {}, // Don't update if exists
      create: {
        date: today,
        topic: topic.en,
        topicEs: topic.es,
        imageUrl,
        ...content,
      },
    });

    console.log(`[Devotional] Successfully created devotional for ${today}: "${content.title}"`);
  } catch (error) {
    // Ignore unique constraint errors (race condition from server restart)
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      console.log(`[Devotional] Devotional for ${today} was created by another process`);
      return;
    }
    console.error(`[Devotional] Failed to generate devotional for ${today}:`, error);
    throw error;
  }
}

export async function generateDevotionalForDate(date: string): Promise<void> {
  // Check if we already have this devotional
  const existing = await prisma.devotional.findUnique({
    where: { date },
  });

  if (existing) {
    console.log(`[Devotional] Devotional for ${date} already exists: "${existing.title}"`);
    return;
  }

  let topic = getTopicForDate(date);
  let imageUrl = getImageForDate(date);

  // Anti-duplicate guard: check the day before to avoid consecutive same topic/image
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const prevDt = new Date(Date.UTC(y, m - 1, d - 1));
  const prevDateStr = `${prevDt.getUTCFullYear()}-${String(prevDt.getUTCMonth() + 1).padStart(2, '0')}-${String(prevDt.getUTCDate()).padStart(2, '0')}`;
  const prevDevotional = await prisma.devotional.findUnique({ where: { date: prevDateStr } });

  if (prevDevotional && (prevDevotional.topic === topic.en || prevDevotional.imageUrl === imageUrl)) {
    // Skip to the next topic and image index
    const currentIdx = (dayOfYearUTC(date) - 1) % TOPICS.length;
    const nextIdx = (currentIdx + 1) % TOPICS.length;
    const nextImgIdx = (dayOfYearUTC(date) % IMAGES.length);
    topic = TOPICS[nextIdx]!;
    imageUrl = IMAGES[nextImgIdx]!;
    console.log(`[Devotional] Anti-duplicate: shifted topic for ${date} from "${prevDevotional.topic}" to "${topic.en}", image idx ${nextImgIdx}`);
  }

  try {
    // Fetch recent devotionals for anti-repetition context (last 30 entries)
    const recentDevotionals = await prisma.devotional.findMany({
      where: { date: { lte: date } },
      orderBy: { date: 'desc' },
      take: 30,
      select: { story: true, title: true, titleEs: true },
    });

    // Collect used protagonist names
    const usedNames: string[] = [];
    for (const dev of recentDevotionals) {
      const name = extractProtagonistName(dev.story);
      if (name && !usedNames.includes(name)) usedNames.push(name);
    }
    console.log(`[Devotional] Used names for ${date}: ${usedNames.join(', ')}`);

    // Collect existing titles for duplicate detection (last 30)
    const usedTitles = recentDevotionals.flatMap(d => [d.titleEs, d.title].filter(Boolean) as string[]);

    // Collect overused title words from last 15 devotionals
    const recentTitles = recentDevotionals.slice(0, 15).map(d => d.titleEs);
    const wordFreq: Record<string, number> = {};
    for (const title of recentTitles) {
      for (const word of extractTitleWords(title)) {
        wordFreq[word] = (wordFreq[word] ?? 0) + 1;
      }
    }
    // Words appearing 3+ times in last 15 titles are considered overused
    const overusedTitleWords = Object.entries(wordFreq)
      .filter(([, count]) => count >= 3)
      .map(([word]) => word);
    if (overusedTitleWords.length > 0) {
      console.log(`[Devotional] Overused title words for ${date}: ${overusedTitleWords.join(', ')}`);
    }

    // Select variety parameters deterministically by date
    const toneStyle = selectToneStyle(date);
    const titleFormat = selectTitleFormat(date);
    const contentStructure = selectContentStructure(date);
    console.log(`[Devotional] Variety for ${date}: tone=${toneStyle.id}, format=${titleFormat.id}, structure=${contentStructure.id}`);

    const genContext: GenerationContext = { usedNames, overusedTitleWords, toneStyle, titleFormat, contentStructure };

    // Generate with up to 3 retries if protagonist name or title is a duplicate
    let content: DevotionalContent | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const candidate = await generateDevotionalWithAI(topic, genContext);
      const generatedName = extractProtagonistName(candidate.story);
      const generatedNameEs = extractProtagonistName(candidate.storyEs ?? '');
      const isDuplicate = generatedName && usedNames.includes(generatedName);
      const isDuplicateEs = generatedNameEs && usedNames.includes(generatedNameEs);
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-záéíóúñü]/gi, '').trim();
      const isTitleDuplicate = usedTitles.some(t => normalize(t) === normalize(candidate.title ?? ''));
      const isTitleEsDuplicate = usedTitles.some(t => normalize(t) === normalize(candidate.titleEs ?? ''));
      if (!isDuplicate && !isDuplicateEs && !isTitleDuplicate && !isTitleEsDuplicate) {
        content = candidate;
        if (generatedName) console.log(`[Devotional] Attempt ${attempt}: accepted name "${generatedName}"`);
        break;
      }
      if (isTitleDuplicate || isTitleEsDuplicate) {
        console.log(`[Devotional] Attempt ${attempt}: title "${candidate.title ?? candidate.titleEs}" already used — retrying`);
      } else {
        console.log(`[Devotional] Attempt ${attempt}: name "${generatedName ?? generatedNameEs}" already used — retrying`);
      }
    }
    if (!content) {
      // All retries exhausted — use last attempt anyway
      content = await generateDevotionalWithAI(topic, genContext);
      console.warn(`[Devotional] All retries exhausted for ${date} — using last generated content`);
    }

    // Use upsert to avoid race conditions on server restart
    await prisma.devotional.upsert({
      where: { date },
      update: {}, // Don't update if exists
      create: {
        date,
        topic: topic.en,
        topicEs: topic.es,
        imageUrl,
        ...content!,
      },
    });

    console.log(`[Devotional] Successfully created devotional for ${date}: "${content!.title}"`);
  } catch (error) {
    // Ignore unique constraint errors (race condition from server restart)
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      console.log(`[Devotional] Devotional for ${date} was created by another process`);
      return;
    }
    console.error(`[Devotional] Failed to generate devotional for ${date}:`, error);
    throw error;
  }
}

export async function getTodayDevotional() {
  const today = getTodayDate();
  return prisma.devotional.findUnique({
    where: { date: today },
  });
}

export async function getDevotionalByDate(date: string) {
  return prisma.devotional.findUnique({
    where: { date },
  });
}

export async function getAllDevotionals() {
  return prisma.devotional.findMany({
    orderBy: { date: "desc" },
  });
}

/**
 * Guarantees devotionals exist for todayCR .. todayCR+6 (7 days ahead).
 * Generates ONLY missing dates sequentially; never overwrites existing rows.
 * Idempotent — safe to call at any time.
 */
// ─── New-format devotional generation (RepoDevocional format) ────────────────
// Source: develop4God/devocionales-json (same repo used for static files).
// For dates after 2026-09-18 we fetch directly from GitHub instead of generating with AI.
// Stores: story/storyEs as JSON para_meditar array — detected by backendToRepoDevocional.

const STATIC_END_DATE = '2026-09-18';
const GITHUB_BASE = 'https://raw.githubusercontent.com/develop4God/devocionales-json/main';

function addDaysToDate(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

interface GitHubEntry {
  id: string;
  date: string;
  language: string;
  version: string;
  versiculo: string;
  reflexion: string;
  para_meditar: Array<{ cita: string; texto: string }>;
  oracion: string;
  tags: string[];
}

interface GitHubCache {
  es: Record<string, GitHubEntry>;
  en: Record<string, GitHubEntry>;
  loadedAt: number;
}

let githubCache: GitHubCache | null = null;

async function loadGitHubDevocionales(year: number = 2026): Promise<GitHubCache> {
  const now = Date.now();
  if (githubCache && (now - githubCache.loadedAt) < 24 * 60 * 60 * 1000) {
    return githubCache;
  }

  console.log(`[NewFormat] Fetching GitHub devocionales for year ${year}…`);
  const [esRes, enRes] = await Promise.all([
    fetch(`${GITHUB_BASE}/Devocional_year_${year}.json`),
    fetch(`${GITHUB_BASE}/Devocional_year_${year}_en_KJV.json`),
  ]);

  if (!esRes.ok) throw new Error(`GitHub ES fetch failed: ${esRes.status}`);
  if (!enRes.ok) throw new Error(`GitHub EN fetch failed: ${enRes.status}`);

  const [esData, enData] = await Promise.all([esRes.json(), enRes.json()]) as [
    { data: { es: Record<string, GitHubEntry[]> } },
    { data: { en: Record<string, GitHubEntry[]> } },
  ];

  const esMap: Record<string, GitHubEntry> = {};
  const enMap: Record<string, GitHubEntry> = {};

  for (const [date, entries] of Object.entries(esData.data.es)) {
    if (entries[0]) esMap[date] = entries[0];
  }
  for (const [date, entries] of Object.entries(enData.data.en)) {
    if (entries[0]) enMap[date] = entries[0];
  }

  githubCache = { es: esMap, en: enMap, loadedAt: now };
  console.log(`[NewFormat] GitHub cache loaded: ${Object.keys(esMap).length} ES + ${Object.keys(enMap).length} EN entries`);
  return githubCache;
}

function extractRefFromVersiculo(versiculo: string): { reference: string; text: string } {
  // Format: "Book Chapter:Verse VERSION: \"text\""  VERSION = all-caps like RVR1960, KJV
  const match = versiculo.match(/^(.+?)\s+([A-Z][A-Z0-9]+):\s*"?([\s\S]+?)"?\s*$/);
  if (match) return { reference: (match[1] ?? '').trim(), text: (match[3] ?? '').trim().replace(/\\"/g, '"') };
  return { reference: '', text: versiculo };
}

export async function generateNewFormatDevotionalForDate(date: string): Promise<void> {
  const existing = await prisma.devotional.findUnique({ where: { date } });
  if (existing) {
    console.log(`[NewFormat] Devotional for ${date} already exists — skipping`);
    return;
  }

  const imageUrl = getImageForDate(date);

  // Determine which year file to load based on the date
  const year = parseInt(date.split('-')[0]!, 10);
  // The 2026 file covers 2026-08-01 through 2027-07-31, so dates in 2027 also use 2026 file
  const fileYear = (year === 2027) ? 2026 : year;

  let esEntry: GitHubEntry | undefined;
  let enEntry: GitHubEntry | undefined;

  try {
    const cache = await loadGitHubDevocionales(fileYear);
    esEntry = cache.es[date];
    enEntry = cache.en[date];
  } catch (err) {
    console.error(`[NewFormat] GitHub fetch failed for ${date}:`, err);
  }

  if (esEntry && enEntry) {
    const { reference: bibleReferenceEs, text: bibleVerseEs } = extractRefFromVersiculo(esEntry.versiculo);
    const { reference: bibleReference, text: bibleVerse } = extractRefFromVersiculo(enEntry.versiculo);
    const topic = enEntry.tags[0] ?? 'Faith';
    const topicEs = esEntry.tags[0] ?? 'Fe';

    await prisma.devotional.upsert({
      where: { date },
      update: {},
      create: {
        date,
        topic,
        topicEs,
        imageUrl,
        title: topic,
        titleEs: topicEs,
        bibleVerse,
        bibleVerseEs,
        bibleReference,
        bibleReferenceEs,
        reflection: enEntry.reflexion,
        reflectionEs: esEntry.reflexion,
        story: JSON.stringify(enEntry.para_meditar),
        storyEs: JSON.stringify(esEntry.para_meditar),
        biblicalCharacter: '',
        biblicalCharacterEs: '',
        application: '',
        applicationEs: '',
        prayer: enEntry.oracion,
        prayerEs: esEntry.oracion,
        version: esEntry.version ?? 'RVR1960',
      },
    });

    console.log(`[NewFormat] Devotional for ${date} stored from GitHub: "${topic}" (${esEntry.id})`);
    return;
  }

  // Fallback: no GitHub data for this date (e.g. after Jul 2027) — skip with warning
  console.warn(`[NewFormat] No GitHub data found for ${date} — skipping (date may be beyond available files)`);
}

/**
 * Extends the new-format devotional buffer by one entry per call.
 * Starts from 2026-09-19 (day after static files end) and advances 1 day per
 * daily cron run. On startup after a gap, catches up to today+days.
 * Idempotent — skips existing entries. Safe to call at any time.
 */
export async function ensureNewFormatAhead(days = 30): Promise<void> {
  const today = getTodayDate();

  // Find the latest new-format devotional already in DB (after static end)
  const latest = await prisma.devotional.findFirst({
    where: { date: { gt: STATIC_END_DATE } },
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  const frontier = latest?.date ?? STATIC_END_DATE;
  const startDate = addDaysToDate(frontier, 1); // next date to generate

  // Target: always have `days` new-format entries available beyond the static bundle.
  // Minimum = STATIC_END_DATE + days (e.g. Oct 18 for days=30).
  // Also use today+days so the window rolls forward as days pass in production.
  // startDate is always included so at least 1 entry is generated per call.
  const minimumEnd = addDaysToDate(STATIC_END_DATE, days);
  const endDateFromToday = addDaysToDate(today, days);
  const candidates = [minimumEnd, endDateFromToday, startDate];
  const endDate = candidates.reduce((max, d) => (d > max ? d : max));

  console.log(`[NewFormat] Frontier: ${frontier} → generating ${startDate} to ${endDate}…`);
  let current = startDate;
  while (current <= endDate) {
    try {
      await generateNewFormatDevotionalForDate(current);
    } catch (err) {
      console.error(`[NewFormat] Failed for ${current}:`, err);
    }
    current = addDaysToDate(current, 1);
  }
  console.log(`[NewFormat] ensureNewFormatAhead(${days}) complete — frontier now at ${endDate}`);
}

/**
 * Generates exactly ONE new-format devotional: the next date after the current frontier.
 * Used by the daily cron to maintain a rolling buffer (consume 1, produce 1).
 * Idempotent per calendar day — safe to call from both cron and startup.
 */
export async function generateNextNewFormatDevotional(): Promise<void> {
  const today = getTodayDate();
  const todayStart = new Date(today + 'T00:00:00.000Z');

  const latest = await prisma.devotional.findFirst({
    where: { date: { gt: STATIC_END_DATE } },
    orderBy: { date: 'desc' },
    select: { date: true, createdAt: true },
  });

  // If the most recent new-format devotional was already created today, skip
  // This prevents double-generation when startup and midnight cron both run on the same day
  if (latest?.createdAt && latest.createdAt >= todayStart) {
    console.log(`[NewFormat] Daily +1 already generated today (frontier: ${latest.date}) — skipping`);
    return;
  }

  const frontier = latest?.date ?? STATIC_END_DATE;
  const nextDate = addDaysToDate(frontier, 1);

  console.log(`[NewFormat] Daily +1 — frontier: ${frontier} → generating ${nextDate}`);
  try {
    await generateNewFormatDevotionalForDate(nextDate);
    console.log(`[NewFormat] Generated devotional for ${nextDate}`);
  } catch (err) {
    console.error(`[NewFormat] Failed to generate ${nextDate}:`, err);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function ensureDevotionalsAhead(days = 7): Promise<void> {
  const today = getTodayDate();

  for (let i = 0; i < days; i++) {
    // Compute target date by offsetting from today
    const [y, m, d] = today.split("-").map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const dateStr = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;

    const existing = await prisma.devotional.findUnique({ where: { date: dateStr } });
    if (existing) {
      console.log(`[Ensure] Devotional for ${dateStr} already exists — skipping`);
      continue;
    }

    console.log(`[Ensure] Generating missing devotional for ${dateStr}…`);
    try {
      if (dateStr > STATIC_END_DATE) {
        await generateNewFormatDevotionalForDate(dateStr);
      } else {
        await generateDevotionalForDate(dateStr);
      }
      console.log(`[Ensure] Devotional for ${dateStr} generated`);
    } catch (err) {
      // Non-fatal — log and continue so remaining dates are attempted
      console.error(`[Ensure] Failed to generate devotional for ${dateStr}:`, err);
    }
  }

  console.log(`[Ensure] ensureDevotionalsAhead(${days}) complete`);
}

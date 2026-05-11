import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================
// THEMES (6 items - Original)
// ============================================
const THEMES = [
  {
    id: 'theme_amanecer',
    type: 'theme',
    nameEn: 'Sunrise',
    nameEs: 'Amanecer',
    descriptionEn: 'Warm light tones for a peaceful morning',
    descriptionEs: 'Tonos calidos de luz para una manana pacifica',
    pricePoints: 0,
    rarity: 'common',
    assetRef: 'amanecer',
    metadata: JSON.stringify({
      primary: '#E8A87C',
      secondary: '#C38D9E',
      accent: '#41B3A3',
      background: '#FDF6E3',
      backgroundDark: '#1A1A2E',
      surface: '#FFFFFF',
      surfaceDark: '#252542',
    }),
  },
  {
    id: 'theme_noche_paz',
    type: 'theme',
    nameEn: 'Peaceful Night',
    nameEs: 'Noche de Paz',
    descriptionEn: 'Deep blue tones for evening reflection',
    descriptionEs: 'Tonos azul profundo para reflexion nocturna',
    pricePoints: 400,
    rarity: 'rare',
    assetRef: 'noche_paz',
    metadata: JSON.stringify({
      primary: '#5C6BC0',
      secondary: '#7986CB',
      accent: '#9FA8DA',
      background: '#0D1B2A',
      backgroundDark: '#0D1B2A',
      surface: '#1B263B',
      surfaceDark: '#1B263B',
    }),
  },
  {
    id: 'theme_bosque',
    type: 'theme',
    nameEn: 'Forest',
    nameEs: 'Bosque',
    descriptionEn: 'Soft green nature vibes',
    descriptionEs: 'Suaves vibraciones verdes de la naturaleza',
    pricePoints: 300,
    rarity: 'common',
    assetRef: 'bosque',
    metadata: JSON.stringify({
      primary: '#2D6A4F',
      secondary: '#40916C',
      accent: '#95D5B2',
      background: '#F7FDF9',
      backgroundDark: '#0D1F17',
      surface: '#FFFFFF',
      surfaceDark: '#1A3328',
    }),
  },
  {
    id: 'theme_desierto',
    type: 'theme',
    nameEn: 'Desert',
    nameEs: 'Desierto',
    descriptionEn: 'Warm sand tones of the wilderness',
    descriptionEs: 'Calidos tonos arena del desierto',
    pricePoints: 350,
    rarity: 'common',
    assetRef: 'desierto',
    metadata: JSON.stringify({
      primary: '#D4A373',
      secondary: '#CCD5AE',
      accent: '#E9EDC9',
      background: '#FEFAE0',
      backgroundDark: '#2C2416',
      surface: '#FFFFFF',
      surfaceDark: '#3D3426',
    }),
  },
  {
    id: 'theme_promesa',
    type: 'theme',
    nameEn: 'Promise',
    nameEs: 'Promesa',
    descriptionEn: 'Royal violet for divine promises',
    descriptionEs: 'Violeta real para promesas divinas',
    pricePoints: 600,
    rarity: 'rare',
    assetRef: 'promesa',
    metadata: JSON.stringify({
      primary: '#7B2CBF',
      secondary: '#9D4EDD',
      accent: '#C77DFF',
      background: '#F8F4FC',
      backgroundDark: '#1A0A2E',
      surface: '#FFFFFF',
      surfaceDark: '#2D1B4E',
    }),
  },
  {
    id: 'theme_minimal',
    type: 'theme',
    nameEn: 'Minimal Light',
    nameEs: 'Minimal Claro',
    descriptionEn: 'Clean white and gray minimalist design',
    descriptionEs: 'Diseno minimalista blanco y gris',
    pricePoints: 200,
    rarity: 'common',
    assetRef: 'minimal',
    metadata: JSON.stringify({
      primary: '#374151',
      secondary: '#6B7280',
      accent: '#9CA3AF',
      background: '#F9FAFB',
      backgroundDark: '#111827',
      surface: '#FFFFFF',
      surfaceDark: '#1F2937',
    }),
  },
];

// ============================================
// THEMES V2 (14 items - Premium Palettes)
// ============================================
const THEMES_V2 = [
  {
    id: 'theme_amanecer_dorado',
    type: 'theme',
    nameEn: 'Golden Dawn',
    nameEs: 'Amanecer Dorado',
    descriptionEn: 'Radiant gold hues of a new beginning',
    descriptionEs: 'Tonos dorados radiantes de un nuevo comienzo',
    pricePoints: 500,
    rarity: 'rare',
    assetRef: 'amanecer_dorado',
    metadata: JSON.stringify({
      primary: '#D97706', secondary: '#F59E0B', accent: '#FCD34D',
      background: '#FFFBEB', backgroundDark: '#1C1917',
      surface: '#FFFFFF', surfaceDark: '#292524',
    }),
  },
  {
    id: 'theme_noche_profunda',
    type: 'theme',
    nameEn: 'Deep Night Peace',
    nameEs: 'Noche de Paz Profunda',
    descriptionEn: 'Serene darkness with celestial stars',
    descriptionEs: 'Oscuridad serena con estrellas celestiales',
    pricePoints: 550,
    rarity: 'rare',
    assetRef: 'noche_profunda',
    metadata: JSON.stringify({
      primary: '#4338CA', secondary: '#6366F1', accent: '#A5B4FC',
      background: '#0F0D1A', backgroundDark: '#0F0D1A',
      surface: '#1E1B2E', surfaceDark: '#1E1B2E',
    }),
  },
  {
    id: 'theme_bosque_sereno',
    type: 'theme',
    nameEn: 'Serene Forest',
    nameEs: 'Bosque Sereno',
    descriptionEn: 'Peaceful green sanctuary of nature',
    descriptionEs: 'Santuario verde y pacifico de la naturaleza',
    pricePoints: 300,
    rarity: 'common',
    assetRef: 'bosque_sereno',
    metadata: JSON.stringify({
      primary: '#059669', secondary: '#10B981', accent: '#6EE7B7',
      background: '#ECFDF5', backgroundDark: '#022C22',
      surface: '#FFFFFF', surfaceDark: '#064E3B',
    }),
  },
  {
    id: 'theme_desierto_suave',
    type: 'theme',
    nameEn: 'Soft Desert',
    nameEs: 'Desierto Suave',
    descriptionEn: 'Warm sand tones of contemplation',
    descriptionEs: 'Tonos arena calidos de contemplacion',
    pricePoints: 280,
    rarity: 'common',
    assetRef: 'desierto_suave',
    metadata: JSON.stringify({
      primary: '#C2410C', secondary: '#EA580C', accent: '#FED7AA',
      background: '#FFF7ED', backgroundDark: '#1C1410',
      surface: '#FFFFFF', surfaceDark: '#292018',
    }),
  },
  {
    id: 'theme_promesa_violeta',
    type: 'theme',
    nameEn: 'Violet Promise',
    nameEs: 'Promesa Violeta',
    descriptionEn: 'Royal purple of divine covenant',
    descriptionEs: 'Purpura real del pacto divino',
    pricePoints: 650,
    rarity: 'rare',
    assetRef: 'promesa_violeta',
    metadata: JSON.stringify({
      primary: '#7C3AED', secondary: '#8B5CF6', accent: '#C4B5FD',
      background: '#F5F3FF', backgroundDark: '#1E1033',
      surface: '#FFFFFF', surfaceDark: '#2E1B4B',
    }),
  },
  {
    id: 'theme_cielo_gloria',
    type: 'theme',
    nameEn: 'Sky of Glory',
    nameEs: 'Cielo de Gloria',
    descriptionEn: 'Majestic sky blue of heavenly realms',
    descriptionEs: 'Azul cielo majestuoso de reinos celestiales',
    pricePoints: 550,
    rarity: 'rare',
    assetRef: 'cielo_gloria',
    metadata: JSON.stringify({
      primary: '#0284C7', secondary: '#0EA5E9', accent: '#7DD3FC',
      background: '#F0F9FF', backgroundDark: '#082F49',
      surface: '#FFFFFF', surfaceDark: '#0C4A6E',
    }),
  },
  {
    id: 'theme_mar_misericordia',
    type: 'theme',
    nameEn: 'Sea of Mercy',
    nameEs: 'Mar de Misericordia',
    descriptionEn: 'Teal depths of endless grace',
    descriptionEs: 'Profundidades aguamarina de gracia infinita',
    pricePoints: 320,
    rarity: 'common',
    assetRef: 'mar_misericordia',
    metadata: JSON.stringify({
      primary: '#0D9488', secondary: '#14B8A6', accent: '#5EEAD4',
      background: '#F0FDFA', backgroundDark: '#042F2E',
      surface: '#FFFFFF', surfaceDark: '#134E4A',
    }),
  },
  {
    id: 'theme_fuego_espiritu',
    type: 'theme',
    nameEn: 'Fire of the Spirit',
    nameEs: 'Fuego del Espiritu',
    descriptionEn: 'Holy flames of divine presence',
    descriptionEs: 'Llamas santas de la presencia divina',
    pricePoints: 1500,
    rarity: 'epic',
    assetRef: 'fuego_espiritu',
    metadata: JSON.stringify({
      primary: '#DC2626', secondary: '#F97316', accent: '#FDE68A',
      background: '#FEF2F2', backgroundDark: '#1C1410',
      surface: '#FFFFFF', surfaceDark: '#2A1810',
    }),
  },
  {
    id: 'theme_jardin_gracia',
    type: 'theme',
    nameEn: 'Garden of Grace',
    nameEs: 'Jardin de Gracia',
    descriptionEn: 'Blooming garden of divine favor',
    descriptionEs: 'Jardin florido del favor divino',
    pricePoints: 380,
    rarity: 'common',
    assetRef: 'jardin_gracia',
    metadata: JSON.stringify({
      primary: '#DB2777', secondary: '#EC4899', accent: '#FBCFE8',
      background: '#FDF2F8', backgroundDark: '#1A0D14',
      surface: '#FFFFFF', surfaceDark: '#2D1520',
    }),
  },
  {
    id: 'theme_olivo_paz',
    type: 'theme',
    nameEn: 'Olive and Peace',
    nameEs: 'Olivo y Paz',
    descriptionEn: 'Ancient olive hues of harmony',
    descriptionEs: 'Tonos antiguos de olivo y armonia',
    pricePoints: 300,
    rarity: 'common',
    assetRef: 'olivo_paz',
    metadata: JSON.stringify({
      primary: '#65A30D', secondary: '#84CC16', accent: '#BEF264',
      background: '#F7FEE7', backgroundDark: '#1A2E05',
      surface: '#FFFFFF', surfaceDark: '#3F6212',
    }),
  },
  {
    id: 'theme_trono_azul',
    type: 'theme',
    nameEn: 'Blue Throne',
    nameEs: 'Trono Azul',
    descriptionEn: 'Royal blue of the heavenly throne',
    descriptionEs: 'Azul real del trono celestial',
    pricePoints: 600,
    rarity: 'rare',
    assetRef: 'trono_azul',
    metadata: JSON.stringify({
      primary: '#1D4ED8', secondary: '#3B82F6', accent: '#93C5FD',
      background: '#EFF6FF', backgroundDark: '#0F172A',
      surface: '#FFFFFF', surfaceDark: '#1E3A5F',
    }),
  },
  {
    id: 'theme_lampara_encendida',
    type: 'theme',
    nameEn: 'Burning Lamp',
    nameEs: 'Lampara Encendida',
    descriptionEn: 'Warm glow of the ever-burning lamp',
    descriptionEs: 'Resplandor calido de la lampara ardiente',
    pricePoints: 520,
    rarity: 'rare',
    assetRef: 'lampara_encendida',
    metadata: JSON.stringify({
      primary: '#B45309', secondary: '#D97706', accent: '#FDE68A',
      background: '#FFFBEB', backgroundDark: '#1C1712',
      surface: '#FFFFFF', surfaceDark: '#292418',
    }),
  },
  {
    id: 'theme_pergamino_antiguo',
    type: 'theme',
    nameEn: 'Ancient Parchment',
    nameEs: 'Pergamino Antiguo',
    descriptionEn: 'Timeless sepia of sacred scrolls',
    descriptionEs: 'Sepia atemporal de pergaminos sagrados',
    pricePoints: 350,
    rarity: 'common',
    assetRef: 'pergamino_antiguo',
    metadata: JSON.stringify({
      primary: '#A16207', secondary: '#CA8A04', accent: '#FEF08A',
      background: '#FEFCE8', backgroundDark: '#1A1608',
      surface: '#FFFFFF', surfaceDark: '#2E2810',
    }),
  },
  {
    id: 'theme_luz_celestial',
    type: 'theme',
    nameEn: 'Celestial Light',
    nameEs: 'Luz Celestial',
    descriptionEn: 'Ethereal glow from heavenly realms',
    descriptionEs: 'Resplandor etereo de los cielos',
    pricePoints: 1800,
    rarity: 'epic',
    assetRef: 'luz_celestial',
    metadata: JSON.stringify({
      primary: '#7C3AED', secondary: '#60A5FA', accent: '#FDE68A',
      background: '#FAFAFA', backgroundDark: '#0F0A1A',
      surface: '#FFFFFF', surfaceDark: '#1A1028',
    }),
  },
];

// ============================================
// AVATAR FRAMES (10 items)
// ============================================
const FRAMES = [
  { id: 'frame_dorado', type: 'frame', nameEn: 'Golden', nameEs: 'Dorado', descriptionEn: 'A prestigious golden frame', descriptionEs: 'Un prestigioso marco dorado', pricePoints: 300, rarity: 'rare', assetRef: '#FFD700' },
  { id: 'frame_plata', type: 'frame', nameEn: 'Silver', nameEs: 'Plata', descriptionEn: 'A classic silver frame', descriptionEs: 'Un clasico marco plateado', pricePoints: 200, rarity: 'common', assetRef: '#C0C0C0' },
  { id: 'frame_azul', type: 'frame', nameEn: 'Blue Hope', nameEs: 'Azul Esperanza', descriptionEn: 'A frame filled with hope', descriptionEs: 'Un marco lleno de esperanza', pricePoints: 250, rarity: 'common', assetRef: '#4A90D9' },
  { id: 'frame_verde', type: 'frame', nameEn: 'Green Life', nameEs: 'Verde Vida', descriptionEn: 'A vibrant green frame', descriptionEs: 'Un vibrante marco verde', pricePoints: 250, rarity: 'common', assetRef: '#4CAF50' },
  { id: 'frame_luz', type: 'frame', nameEn: 'Soft Light', nameEs: 'Luz Suave', descriptionEn: 'A gentle illuminating frame', descriptionEs: 'Un marco de luz suave', pricePoints: 350, rarity: 'rare', assetRef: '#FFF8DC' },
  { id: 'frame_corona', type: 'frame', nameEn: 'Leaf Crown', nameEs: 'Corona Hojas', descriptionEn: 'A natural crown of leaves', descriptionEs: 'Una corona natural de hojas', pricePoints: 400, rarity: 'rare', assetRef: '#228B22' },
  { id: 'frame_estrellas', type: 'frame', nameEn: 'Stars', nameEs: 'Estrellas', descriptionEn: 'A celestial frame of stars', descriptionEs: 'Un marco celestial de estrellas', pricePoints: 500, rarity: 'epic', assetRef: '#E6E6FA' },
  { id: 'frame_pergamino', type: 'frame', nameEn: 'Parchment', nameEs: 'Pergamino', descriptionEn: 'An ancient parchment frame', descriptionEs: 'Un marco de pergamino antiguo', pricePoints: 300, rarity: 'common', assetRef: '#D4B896' },
  { id: 'frame_fuego', type: 'frame', nameEn: 'Soft Fire', nameEs: 'Fuego Suave', descriptionEn: 'A warm flame frame', descriptionEs: 'Un marco de llama calida', pricePoints: 450, rarity: 'rare', assetRef: '#FF6B35' },
  { id: 'frame_cielo', type: 'frame', nameEn: 'Heaven', nameEs: 'Cielo', descriptionEn: 'A heavenly sky frame', descriptionEs: 'Un marco del cielo celestial', pricePoints: 600, rarity: 'epic', assetRef: '#87CEEB' },
];

// ============================================
// MUSIC TRACKS (13 items: 5 free + 8 premium)
// ============================================
const MUSIC_TRACKS = [
  // Free tracks
  { id: 'music_free_1', type: 'music', nameEn: 'Peaceful Piano', nameEs: 'Piano Tranquilo', descriptionEn: 'Calm piano melodies', descriptionEs: 'Melodias tranquilas de piano', pricePoints: 0, rarity: 'common', assetRef: 'peaceful_piano' },
  { id: 'music_free_2', type: 'music', nameEn: 'Gentle Stream', nameEs: 'Arroyo Suave', descriptionEn: 'Flowing water sounds', descriptionEs: 'Sonidos de agua fluyendo', pricePoints: 0, rarity: 'common', assetRef: 'gentle_stream' },
  { id: 'music_free_3', type: 'music', nameEn: 'Morning Birds', nameEs: 'Aves de la Manana', descriptionEn: 'Birdsong at dawn', descriptionEs: 'Canto de aves al amanecer', pricePoints: 0, rarity: 'common', assetRef: 'morning_birds' },
  { id: 'music_free_4', type: 'music', nameEn: 'Soft Strings', nameEs: 'Cuerdas Suaves', descriptionEn: 'Gentle string instruments', descriptionEs: 'Suaves instrumentos de cuerda', pricePoints: 0, rarity: 'common', assetRef: 'soft_strings' },
  { id: 'music_free_5', type: 'music', nameEn: 'Meditation', nameEs: 'Meditacion', descriptionEn: 'Deep meditation ambience', descriptionEs: 'Ambiente de meditacion profunda', pricePoints: 0, rarity: 'common', assetRef: 'meditation' },
  // Premium tracks
  { id: 'music_gratitud', type: 'music', nameEn: 'Gratitude Piano', nameEs: 'Piano Gratitud', descriptionEn: 'Piano for grateful hearts', descriptionEs: 'Piano para corazones agradecidos', pricePoints: 400, rarity: 'rare', assetRef: 'gratitude_piano' },
  { id: 'music_arpa_paz', type: 'music', nameEn: 'Peaceful Harp', nameEs: 'Arpa Paz', descriptionEn: 'Peaceful harp melodies', descriptionEs: 'Melodias pacificas de arpa', pricePoints: 500, rarity: 'rare', assetRef: 'peaceful_harp' },
  { id: 'music_cuerdas_esperanza', type: 'music', nameEn: 'Hope Strings', nameEs: 'Cuerdas Esperanza', descriptionEn: 'Hopeful string ensemble', descriptionEs: 'Ensamble de cuerdas esperanzador', pricePoints: 600, rarity: 'rare', assetRef: 'hope_strings' },
  { id: 'music_ambient_silencio', type: 'music', nameEn: 'Ambient Silence', nameEs: 'Ambient Silencio', descriptionEn: 'Peaceful ambient sounds', descriptionEs: 'Sonidos ambientales pacificos', pricePoints: 450, rarity: 'common', assetRef: 'ambient_silence' },
  { id: 'music_piano_amanecer', type: 'music', nameEn: 'Sunrise Piano', nameEs: 'Piano Amanecer', descriptionEn: 'Morning piano melodies', descriptionEs: 'Melodias de piano matutinas', pricePoints: 550, rarity: 'rare', assetRef: 'sunrise_piano' },
  { id: 'music_arpa_lluvia', type: 'music', nameEn: 'Rain Harp', nameEs: 'Arpa Lluvia Suave', descriptionEn: 'Harp with gentle rain', descriptionEs: 'Arpa con lluvia suave', pricePoints: 700, rarity: 'epic', assetRef: 'rain_harp' },
  { id: 'music_cuerdas_promesa', type: 'music', nameEn: 'Promise Strings', nameEs: 'Cuerdas Promesa', descriptionEn: 'Strings of divine promise', descriptionEs: 'Cuerdas de promesa divina', pricePoints: 800, rarity: 'epic', assetRef: 'promise_strings' },
  { id: 'music_ambient_noche', type: 'music', nameEn: 'Night Ambient', nameEs: 'Ambient Noche', descriptionEn: 'Peaceful night ambience', descriptionEs: 'Ambiente nocturno pacifico', pricePoints: 1200, rarity: 'epic', assetRef: 'night_ambient' },
];

// ============================================
// SPIRITUAL TITLES (12 items)
// ============================================
const TITLES = [
  { id: 'title_buscador', type: 'title', nameEn: 'Seeker of Light', nameEs: 'Buscador de Luz', descriptionEn: 'One who seeks divine light', descriptionEs: 'Aquel que busca la luz divina', pricePoints: 200, rarity: 'common', assetRef: '' },
  { id: 'title_corazon', type: 'title', nameEn: 'Grateful Heart', nameEs: 'Corazon Agradecido', descriptionEn: 'A heart full of gratitude', descriptionEs: 'Un corazon lleno de gratitud', pricePoints: 250, rarity: 'common', assetRef: '' },
  { id: 'title_caminando', type: 'title', nameEn: 'Walking in Faith', nameEs: 'Caminando en Fe', descriptionEn: 'Walking the path of faith', descriptionEs: 'Caminando el sendero de la fe', pricePoints: 300, rarity: 'common', assetRef: '' },
  { id: 'title_siervo', type: 'title', nameEn: 'Faithful Servant', nameEs: 'Siervo Fiel', descriptionEn: 'A devoted servant', descriptionEs: 'Un siervo devoto', pricePoints: 400, rarity: 'rare', assetRef: '' },
  { id: 'title_portador', type: 'title', nameEn: 'Hope Bearer', nameEs: 'Portador de Esperanza', descriptionEn: 'Carrier of hope', descriptionEs: 'Portador de esperanza', pricePoints: 350, rarity: 'rare', assetRef: '' },
  { id: 'title_amigo', type: 'title', nameEn: 'Friend of the Master', nameEs: 'Amigo del Maestro', descriptionEn: 'Close friend of the Master', descriptionEs: 'Amigo cercano del Maestro', pricePoints: 500, rarity: 'rare', assetRef: '' },
  { id: 'title_valiente', type: 'title', nameEn: 'Kingdom Warrior', nameEs: 'Valiente del Reino', descriptionEn: 'Brave warrior of the Kingdom', descriptionEs: 'Valiente guerrero del Reino', pricePoints: 600, rarity: 'epic', assetRef: '' },
  { id: 'title_sembrador', type: 'title', nameEn: 'Peace Sower', nameEs: 'Sembrador de Paz', descriptionEn: 'Sower of peace', descriptionEs: 'Sembrador de paz', pricePoints: 450, rarity: 'rare', assetRef: '' },
  { id: 'title_luz', type: 'title', nameEn: 'Light in the Storm', nameEs: 'Luz en la Tormenta', descriptionEn: 'Light during dark times', descriptionEs: 'Luz en tiempos oscuros', pricePoints: 550, rarity: 'rare', assetRef: '' },
  { id: 'title_guardian', type: 'title', nameEn: 'Guardian of the Word', nameEs: 'Guardian de la Palabra', descriptionEn: 'Protector of the Word', descriptionEs: 'Protector de la Palabra', pricePoints: 700, rarity: 'epic', assetRef: '' },
  { id: 'title_constructor', type: 'title', nameEn: 'Altar Builder', nameEs: 'Constructor de Altar', descriptionEn: 'Builder of spiritual altars', descriptionEs: 'Constructor de altares espirituales', pricePoints: 500, rarity: 'rare', assetRef: '' },
  { id: 'title_peregrino', type: 'title', nameEn: 'Pilgrim of Grace', nameEs: 'Peregrino de Gracia', descriptionEn: 'Pilgrim walking in grace', descriptionEs: 'Peregrino caminando en gracia', pricePoints: 400, rarity: 'rare', assetRef: '' },
];

const TITLES_CHEST = [
  { id: 'title_chest_ungido', type: 'title', nameEn: 'The Anointed', nameEs: 'El Ungido', descriptionEn: 'Set apart by the Spirit — chest exclusive', descriptionEs: 'Apartado por el Espiritu — exclusivo del cofre', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ chestOnly: true }) },
  { id: 'title_chest_columna', type: 'title', nameEn: 'Pillar of Fire', nameEs: 'Columna de Fuego', descriptionEn: 'Guiding light through the wilderness — chest exclusive', descriptionEs: 'Luz guiadora en el desierto — exclusivo del cofre', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ chestOnly: true }) },
  { id: 'title_chest_profeta', type: 'title', nameEn: 'Voice of the Prophet', nameEs: 'Voz del Profeta', descriptionEn: 'Speaks what heaven declares — chest exclusive', descriptionEs: 'Proclama lo que el cielo declara — exclusivo del cofre', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ chestOnly: true }) },
  { id: 'title_chest_escogido', type: 'title', nameEn: 'The Chosen', nameEs: 'El Escogido', descriptionEn: 'Called before the foundation of the world — chest exclusive', descriptionEs: 'Llamado antes de la fundacion del mundo — exclusivo del cofre', pricePoints: 0, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ chestOnly: true }) },
  { id: 'title_chest_intercesor', type: 'title', nameEn: 'Intercessor', nameEs: 'Intercesor', descriptionEn: 'Stands in the gap for others — chest exclusive', descriptionEs: 'Se para en la brecha por los demas — exclusivo del cofre', pricePoints: 0, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ chestOnly: true }) },
];

// ============================================
// PREMIUM AVATARS (6 items - Original with price)
// ============================================
const AVATARS = [
  { id: 'avatar_rainbow', type: 'avatar', nameEn: 'Rainbow', nameEs: 'Arcoiris', descriptionEn: 'Promise of God', descriptionEs: 'Promesa de Dios', pricePoints: 200, rarity: 'rare', assetRef: '🌈' },
  { id: 'avatar_crown', type: 'avatar', nameEn: 'Crown', nameEs: 'Corona', descriptionEn: 'Crown of glory', descriptionEs: 'Corona de gloria', pricePoints: 500, rarity: 'epic', assetRef: '👑' },
  { id: 'avatar_angel', type: 'avatar', nameEn: 'Angel', nameEs: 'Angel', descriptionEn: 'Heavenly messenger', descriptionEs: 'Mensajero celestial', pricePoints: 300, rarity: 'rare', assetRef: '😇' },
  { id: 'avatar_olive', type: 'avatar', nameEn: 'Olive Branch', nameEs: 'Rama de Olivo', descriptionEn: 'Sign of peace', descriptionEs: 'Signo de paz', pricePoints: 250, rarity: 'rare', assetRef: '🫒' },
  { id: 'avatar_lamb', type: 'avatar', nameEn: 'Lamb', nameEs: 'Cordero', descriptionEn: 'Gentle and pure', descriptionEs: 'Gentil y puro', pricePoints: 400, rarity: 'rare', assetRef: '🐑' },
  { id: 'avatar_fish', type: 'avatar', nameEn: 'Fish', nameEs: 'Pez', descriptionEn: 'Early Christian symbol', descriptionEs: 'Simbolo cristiano primitivo', pricePoints: 150, rarity: 'common', assetRef: '🐟' },
];

// ============================================
// AVATARS V2 - Premium Illustrated Collection (24 items)
// ============================================
const AVATARS_V2 = [
  // Collection 1: Simbolos de Fe (8 items)
  { id: 'avatar_v2_paloma_paz', type: 'avatar', nameEn: 'Dove of Peace', nameEs: 'Paloma de Paz', descriptionEn: 'Premium illustrated dove with olive branch', descriptionEs: 'Paloma ilustrada premium con rama de olivo', pricePoints: 450, rarity: 'rare', assetRef: '🕊️', metadata: JSON.stringify({ collectionId: 'collection_v2_simbolos_fe', isV2: true }) },
  { id: 'avatar_v2_cruz_radiante', type: 'avatar', nameEn: 'Radiant Cross', nameEs: 'Cruz Radiante', descriptionEn: 'Glowing cross with divine rays', descriptionEs: 'Cruz resplandeciente con rayos divinos', pricePoints: 500, rarity: 'rare', assetRef: '✝️', metadata: JSON.stringify({ collectionId: 'collection_v2_simbolos_fe', isV2: true }) },
  { id: 'avatar_v2_lampara_aceite', type: 'avatar', nameEn: 'Oil Lamp', nameEs: 'Lampara de Aceite', descriptionEn: 'Ancient oil lamp burning bright', descriptionEs: 'Lampara de aceite antigua ardiendo brillante', pricePoints: 280, rarity: 'common', assetRef: '🪔', metadata: JSON.stringify({ collectionId: 'collection_v2_simbolos_fe', isV2: true }) },
  { id: 'avatar_v2_corona_vida', type: 'avatar', nameEn: 'Crown of Life', nameEs: 'Corona de Vida', descriptionEn: 'Majestic crown adorned with jewels', descriptionEs: 'Corona majestuosa adornada con joyas', pricePoints: 2500, rarity: 'epic', assetRef: '👑', metadata: JSON.stringify({ collectionId: 'collection_v2_simbolos_fe', isV2: true }) },
  { id: 'avatar_v2_biblia_abierta', type: 'avatar', nameEn: 'Open Bible', nameEs: 'Biblia Abierta', descriptionEn: 'Holy scriptures with radiant glow', descriptionEs: 'Escrituras santas con resplandor radiante', pricePoints: 320, rarity: 'common', assetRef: '📖', metadata: JSON.stringify({ collectionId: 'collection_v2_simbolos_fe', isV2: true }) },
  { id: 'avatar_v2_caliz', type: 'avatar', nameEn: 'Holy Chalice', nameEs: 'Caliz Sagrado', descriptionEn: 'Sacred cup of communion', descriptionEs: 'Copa sagrada de la comunion', pricePoints: 550, rarity: 'rare', assetRef: '🏆', metadata: JSON.stringify({ collectionId: 'collection_v2_simbolos_fe', isV2: true }) },
  { id: 'avatar_v2_ancla_esperanza', type: 'avatar', nameEn: 'Anchor of Hope', nameEs: 'Ancla de Esperanza', descriptionEn: 'Steadfast anchor representing hope', descriptionEs: 'Ancla firme representando esperanza', pricePoints: 480, rarity: 'rare', assetRef: '⚓', metadata: JSON.stringify({ collectionId: 'collection_v2_simbolos_fe', isV2: true }) },
  { id: 'avatar_v2_pan_uvas', type: 'avatar', nameEn: 'Bread and Grapes', nameEs: 'Pan y Uvas', descriptionEn: 'Communion bread with grapes', descriptionEs: 'Pan de comunion con uvas', pricePoints: 350, rarity: 'common', assetRef: '🍇', metadata: JSON.stringify({ collectionId: 'collection_v2_simbolos_fe', isV2: true }) },
  // Collection 2: Naturaleza Biblica (6 items)
  { id: 'avatar_v2_rama_olivo', type: 'avatar', nameEn: 'Olive Branch', nameEs: 'Rama de Olivo', descriptionEn: 'Lush olive branch of peace', descriptionEs: 'Exuberante rama de olivo de paz', pricePoints: 260, rarity: 'common', assetRef: '🌿', metadata: JSON.stringify({ collectionId: 'collection_v2_naturaleza', isV2: true }) },
  { id: 'avatar_v2_pez_ichthys', type: 'avatar', nameEn: 'Ichthys Fish', nameEs: 'Pez Ichthys', descriptionEn: 'Ornate Christian fish symbol', descriptionEs: 'Simbolo del pez cristiano ornamentado', pricePoints: 300, rarity: 'common', assetRef: '🐠', metadata: JSON.stringify({ collectionId: 'collection_v2_naturaleza', isV2: true }) },
  { id: 'avatar_v2_cordero', type: 'avatar', nameEn: 'Lamb of God', nameEs: 'Cordero de Dios', descriptionEn: 'Pure white lamb with halo', descriptionEs: 'Cordero blanco puro con aureola', pricePoints: 600, rarity: 'rare', assetRef: '🐑', metadata: JSON.stringify({ collectionId: 'collection_v2_naturaleza', isV2: true }) },
  { id: 'avatar_v2_leon', type: 'avatar', nameEn: 'Lion of Judah', nameEs: 'Leon de Juda', descriptionEn: 'Majestic lion with golden mane', descriptionEs: 'Leon majestuoso con melena dorada', pricePoints: 3500, rarity: 'epic', assetRef: '🦁', metadata: JSON.stringify({ collectionId: 'collection_v2_naturaleza', isV2: true }) },
  { id: 'avatar_v2_semilla_mostaza', type: 'avatar', nameEn: 'Mustard Seed', nameEs: 'Semilla de Mostaza', descriptionEn: 'Tiny seed growing into faith', descriptionEs: 'Pequena semilla creciendo en fe', pricePoints: 520, rarity: 'rare', assetRef: '🌱', metadata: JSON.stringify({ collectionId: 'collection_v2_naturaleza', isV2: true }) },
  { id: 'avatar_v2_vid_racimos', type: 'avatar', nameEn: 'Vine and Grapes', nameEs: 'Vid y Racimos', descriptionEn: 'Abundant vine with clusters', descriptionEs: 'Vid abundante con racimos', pricePoints: 340, rarity: 'common', assetRef: '🍇', metadata: JSON.stringify({ collectionId: 'collection_v2_naturaleza', isV2: true }) },
  // Collection 3: Virtudes (6 items)
  { id: 'avatar_v2_gratitud', type: 'avatar', nameEn: 'Gratitude', nameEs: 'Gratitud', descriptionEn: 'Heart radiating thankful light', descriptionEs: 'Corazon irradiando luz de agradecimiento', pricePoints: 320, rarity: 'common', assetRef: '💖', metadata: JSON.stringify({ collectionId: 'collection_v2_virtudes', isV2: true }) },
  { id: 'avatar_v2_fe', type: 'avatar', nameEn: 'Faith', nameEs: 'Fe', descriptionEn: 'Shield of unwavering faith', descriptionEs: 'Escudo de fe inquebrantable', pricePoints: 580, rarity: 'rare', assetRef: '🛡️', metadata: JSON.stringify({ collectionId: 'collection_v2_virtudes', isV2: true }) },
  { id: 'avatar_v2_amor', type: 'avatar', nameEn: 'Love', nameEs: 'Amor', descriptionEn: 'Hands reaching with compassion', descriptionEs: 'Manos extendidas con compasion', pricePoints: 550, rarity: 'rare', assetRef: '🤲', metadata: JSON.stringify({ collectionId: 'collection_v2_virtudes', isV2: true }) },
  { id: 'avatar_v2_paz', type: 'avatar', nameEn: 'Peace', nameEs: 'Paz', descriptionEn: 'Dove with olive in serene sky', descriptionEs: 'Paloma con olivo en cielo sereno', pricePoints: 500, rarity: 'rare', assetRef: '☮️', metadata: JSON.stringify({ collectionId: 'collection_v2_virtudes', isV2: true }) },
  { id: 'avatar_v2_gozo', type: 'avatar', nameEn: 'Joy', nameEs: 'Gozo', descriptionEn: 'Radiant sun with sparkles', descriptionEs: 'Sol radiante con destellos', pricePoints: 350, rarity: 'common', assetRef: '✨', metadata: JSON.stringify({ collectionId: 'collection_v2_virtudes', isV2: true }) },
  { id: 'avatar_v2_valentia', type: 'avatar', nameEn: 'Courage', nameEs: 'Valentia', descriptionEn: 'Sword of light conquering darkness', descriptionEs: 'Espada de luz conquistando oscuridad', pricePoints: 1800, rarity: 'epic', assetRef: '⚔️', metadata: JSON.stringify({ collectionId: 'collection_v2_virtudes', isV2: true }) },
  // Collection 4: Kids Friendly (4 items)
  { id: 'avatar_v2_estrellita', type: 'avatar', nameEn: 'Little Star', nameEs: 'Estrellita', descriptionEn: 'Cute twinkling star with smile', descriptionEs: 'Linda estrella parpadeante con sonrisa', pricePoints: 200, rarity: 'common', assetRef: '🌟', metadata: JSON.stringify({ collectionId: 'collection_v2_kids', isV2: true }) },
  { id: 'avatar_v2_arcoiris', type: 'avatar', nameEn: 'Soft Rainbow', nameEs: 'Arcoiris Suave', descriptionEn: 'Gentle pastel rainbow arc', descriptionEs: 'Suave arco iris en tonos pastel', pricePoints: 240, rarity: 'common', assetRef: '🌈', metadata: JSON.stringify({ collectionId: 'collection_v2_kids', isV2: true }) },
  { id: 'avatar_v2_nube', type: 'avatar', nameEn: 'Happy Cloud', nameEs: 'Nube Feliz', descriptionEn: 'Fluffy cloud with happy face', descriptionEs: 'Nube esponjosa con cara feliz', pricePoints: 450, rarity: 'rare', assetRef: '☁️', metadata: JSON.stringify({ collectionId: 'collection_v2_kids', isV2: true }) },
  { id: 'avatar_v2_angelito', type: 'avatar', nameEn: 'Little Angel', nameEs: 'Angelito', descriptionEn: 'Adorable cherub with wings', descriptionEs: 'Adorable querubin con alas', pricePoints: 550, rarity: 'rare', assetRef: '👼', metadata: JSON.stringify({ collectionId: 'collection_v2_kids', isV2: true }) },
];

// ============================================
// AVATARS LEVEL 2 — Identity & Calling (18 items)
// ============================================
const AVATARS_L2 = [
  // Collection A: Virtudes del Reino (6)
  { id: 'avatar_l2_corazon_agradecido', type: 'avatar', nameEn: 'Grateful Heart', nameEs: 'Corazon Agradecido', descriptionEn: 'A heart overflowing with gratitude toward God.', descriptionEs: 'Un corazon que desborda gratitud hacia Dios.', pricePoints: 480, rarity: 'rare', assetRef: '🫀', metadata: JSON.stringify({ collectionId: 'collection_l2_virtudes_reino', isV2: true, meaning: 'Representa una vida marcada por el agradecimiento constante a Dios en cada circunstancia.', meaningEn: 'Represents a life marked by constant thankfulness to God in every circumstance.' }) },
  { id: 'avatar_l2_espiritu_humilde', type: 'avatar', nameEn: 'Humble Spirit', nameEs: 'Espiritu Humilde', descriptionEn: 'Bowing low before God and others.', descriptionEs: 'Inclinandose ante Dios y los demas.', pricePoints: 420, rarity: 'rare', assetRef: '🌾', metadata: JSON.stringify({ collectionId: 'collection_l2_virtudes_reino', isV2: true, meaning: 'Representa la humildad del que sirve en silencio, sin buscar reconocimiento.', meaningEn: 'Represents the humility of one who serves quietly, without seeking recognition.' }) },
  { id: 'avatar_l2_gozo_constante', type: 'avatar', nameEn: 'Constant Joy', nameEs: 'Gozo Constante', descriptionEn: 'Joy that endures through every season.', descriptionEs: 'Gozo que persiste en toda temporada.', pricePoints: 350, rarity: 'common', assetRef: '☀️', metadata: JSON.stringify({ collectionId: 'collection_l2_virtudes_reino', isV2: true, meaning: "Representa el gozo profundo que no depende de las circunstancias sino de la presencia de Dios.", meaningEn: "Represents the deep joy that does not depend on circumstances but on God's presence." }) },
  { id: 'avatar_l2_fe_inquebrantable', type: 'avatar', nameEn: 'Unshakeable Faith', nameEs: 'Fe Inquebrantable', descriptionEn: 'Faith that stands firm like a mountain.', descriptionEs: 'Fe que se mantiene firme como una montana.', pricePoints: 1200, rarity: 'epic', assetRef: '⛰️', metadata: JSON.stringify({ collectionId: 'collection_l2_virtudes_reino', isV2: true, meaning: 'Representa una fe solida, probada en la tormenta y firme ante cualquier desafio.', meaningEn: 'Represents a solid faith, tested in the storm and firm before any challenge.' }) },
  { id: 'avatar_l2_amor_sacrificial', type: 'avatar', nameEn: 'Sacrificial Love', nameEs: 'Amor Sacrificial', descriptionEn: 'Love that gives without counting the cost.', descriptionEs: 'Amor que da sin contar el costo.', pricePoints: 650, rarity: 'rare', assetRef: '🔥', metadata: JSON.stringify({ collectionId: 'collection_l2_virtudes_reino', isV2: true, meaning: 'Representa el amor que se entrega por completo, siguiendo el ejemplo de Cristo.', meaningEn: 'Represents love that gives itself completely, following the example of Christ.' }) },
  { id: 'avatar_l2_paz_permanece', type: 'avatar', nameEn: 'Peace That Remains', nameEs: 'Paz que Permanece', descriptionEn: "Still waters amid life's storms.", descriptionEs: 'Aguas tranquilas en medio de las tormentas.', pricePoints: 520, rarity: 'rare', assetRef: '🌊', metadata: JSON.stringify({ collectionId: 'collection_l2_virtudes_reino', isV2: true, meaning: 'Representa la paz sobrenatural que guarda el corazon en medio de toda adversidad.', meaningEn: 'Represents the supernatural peace that guards the heart amid all adversity.' }) },
  // Collection B: Los Llamados (6)
  { id: 'avatar_l2_siervo_fiel', type: 'avatar', nameEn: 'Faithful Servant', nameEs: 'Siervo Fiel', descriptionEn: 'One who tends faithfully what God has entrusted.', descriptionEs: 'Quien cuida fielmente lo que Dios ha confiado.', pricePoints: 400, rarity: 'rare', assetRef: '🪴', metadata: JSON.stringify({ collectionId: 'collection_l2_llamados', isV2: true, unlockType: 'streak', unlockValue: 7, meaning: 'Representa al creyente que sirve con fidelidad, sin importar si es visto o reconocido.', meaningEn: 'Represents the believer who serves faithfully, regardless of whether seen or recognized.' }) },
  { id: 'avatar_l2_guerrero_oracion', type: 'avatar', nameEn: 'Prayer Warrior', nameEs: 'Guerrero de Oracion', descriptionEn: 'One who intercedes fiercely on behalf of others.', descriptionEs: 'Quien intercede fervientemente por los demas.', pricePoints: 800, rarity: 'epic', assetRef: '🛡️', metadata: JSON.stringify({ collectionId: 'collection_l2_llamados', isV2: true, unlockType: 'streak', unlockValue: 14, meaning: 'Representa la vida de intercesion que mueve el corazon de Dios y cambia la realidad.', meaningEn: 'Represents the life of intercession that moves the heart of God and changes reality.' }) },
  { id: 'avatar_l2_portador_luz', type: 'avatar', nameEn: 'Light Bearer', nameEs: 'Portador de Luz', descriptionEn: 'One who carries the light into dark places.', descriptionEs: 'Quien lleva la luz a los lugares oscuros.', pricePoints: 580, rarity: 'rare', assetRef: '🕯️', metadata: JSON.stringify({ collectionId: 'collection_l2_llamados', isV2: true, unlockType: 'devotionals', unlockValue: 30, meaning: 'Representa la mision de ser luz en el mundo, reflejo de la gloria de Dios.', meaningEn: "Represents the mission of being light in the world, a reflection of God's glory." }) },
  { id: 'avatar_l2_atalaya', type: 'avatar', nameEn: 'Watchman', nameEs: 'Atalaya', descriptionEn: 'One who watches, prays, and stands guard.', descriptionEs: 'Quien vigila, ora y monta guardia.', pricePoints: 1500, rarity: 'epic', assetRef: '🔭', metadata: JSON.stringify({ collectionId: 'collection_l2_llamados', isV2: true, unlockType: 'devotionals', unlockValue: 50, meaning: 'Representa al creyente llamado a la oracion de guardia, protegiendo con su intercesion.', meaningEn: 'Represents the believer called to watchful prayer, protecting through intercession.' }) },
  { id: 'avatar_l2_sembrador', type: 'avatar', nameEn: 'Sower', nameEs: 'Sembrador', descriptionEn: 'One who plants seeds of faith and hope.', descriptionEs: 'Quien siembra semillas de fe y esperanza.', pricePoints: 450, rarity: 'rare', assetRef: '🌱', metadata: JSON.stringify({ collectionId: 'collection_l2_llamados', isV2: true, unlockType: 'share', unlockValue: 5, meaning: 'Representa la vocacion de sembrar la Palabra con paciencia, confiando en la cosecha de Dios.', meaningEn: "Represents the calling to sow the Word patiently, trusting in God's harvest." }) },
  { id: 'avatar_l2_testigo', type: 'avatar', nameEn: 'Witness', nameEs: 'Testigo', descriptionEn: 'One who declares what they have seen and heard.', descriptionEs: 'Quien declara lo que ha visto y oido.', pricePoints: 600, rarity: 'rare', assetRef: '📣', metadata: JSON.stringify({ collectionId: 'collection_l2_llamados', isV2: true, unlockType: 'share', unlockValue: 10, meaning: "Representa la identidad del creyente como testigo fiel de la gracia de Dios en su vida.", meaningEn: "Represents the believer's identity as faithful witness to God's grace in their life." }) },
  // Collection C: Simbolos Profundos (6)
  { id: 'avatar_l2_lampara_encendida', type: 'avatar', nameEn: 'Lit Lamp', nameEs: 'Lampara Encendida', descriptionEn: 'The lamp that never goes out.', descriptionEs: 'La lampara que nunca se apaga.', pricePoints: 380, rarity: 'common', assetRef: '🔦', metadata: JSON.stringify({ collectionId: 'collection_l2_simbolos_profundos', isV2: true, meaning: "Representa la Palabra de Dios como lampara a los pies y lumbrera al camino del creyente.", meaningEn: "Represents God's Word as a lamp to the believer's feet and a light to their path." }) },
  { id: 'avatar_l2_corona_vida', type: 'avatar', nameEn: 'Crown of Life', nameEs: 'Corona de Vida', descriptionEn: 'The reward promised to those who endure.', descriptionEs: 'La recompensa prometida a quienes perseveran.', pricePoints: 2800, rarity: 'epic', assetRef: '👑', metadata: JSON.stringify({ collectionId: 'collection_l2_simbolos_profundos', isV2: true, unlockType: 'streak', unlockValue: 30, meaning: 'Representa la corona prometida al fiel que persevera hasta el fin con amor a Dios.', meaningEn: 'Represents the crown promised to the faithful who persevere to the end with love for God.' }) },
  { id: 'avatar_l2_espada_espiritu', type: 'avatar', nameEn: 'Sword of the Spirit', nameEs: 'Espada del Espiritu', descriptionEn: 'The Word of God as a living, active weapon.', descriptionEs: 'La Palabra de Dios como arma viva y activa.', pricePoints: 1800, rarity: 'epic', assetRef: '⚡', metadata: JSON.stringify({ collectionId: 'collection_l2_simbolos_profundos', isV2: true, meaning: 'Representa la Palabra de Dios que es viva, eficaz y mas cortante que toda espada.', meaningEn: 'Represents the Word of God that is living, active, and sharper than any double-edged sword.' }) },
  { id: 'avatar_l2_ancla_alma', type: 'avatar', nameEn: 'Soul Anchor', nameEs: 'Ancla del Alma', descriptionEn: 'Hope as an anchor for the soul.', descriptionEs: 'La esperanza como ancla del alma.', pricePoints: 700, rarity: 'rare', assetRef: '⚓', metadata: JSON.stringify({ collectionId: 'collection_l2_simbolos_profundos', isV2: true, meaning: 'Representa la esperanza en Cristo como ancla firme que sostiene el alma en toda tormenta.', meaningEn: 'Represents hope in Christ as a firm anchor that holds the soul through every storm.' }) },
  { id: 'avatar_l2_pergamino_vivo', type: 'avatar', nameEn: 'Living Scroll', nameEs: 'Pergamino Vivo', descriptionEn: "A life written by God's own hand.", descriptionEs: 'Una vida escrita por la propia mano de Dios.', pricePoints: 560, rarity: 'rare', assetRef: '📜', metadata: JSON.stringify({ collectionId: 'collection_l2_simbolos_profundos', isV2: true, unlockType: 'devotionals', unlockValue: 21, meaning: 'Representa al creyente como carta viva de Cristo, escrita no con tinta sino con el Espiritu.', meaningEn: 'Represents the believer as a living letter from Christ, written not with ink but with the Spirit.' }) },
  { id: 'avatar_l2_fuente_agua', type: 'avatar', nameEn: 'Living Water', nameEs: 'Fuente de Agua Viva', descriptionEn: 'The spring of living water that never runs dry.', descriptionEs: 'El manantial de agua viva que nunca se agota.', pricePoints: 900, rarity: 'epic', assetRef: '💧', metadata: JSON.stringify({ collectionId: 'collection_l2_simbolos_profundos', isV2: true, meaning: "Representa a Cristo como la unica fuente de agua viva que sacia la sed del alma para siempre.", meaningEn: "Represents Christ as the only source of living water that forever satisfies the soul's thirst." }) },
];

// ============================================
// AVENTURAS BÍBLICAS — Biblical Adventure Items
// ============================================

// --- Aventura 1: Jonás ---
const AVATARS_ADVENTURES = [
  { id: 'avatar_adv_jonah_whale', type: 'avatar', nameEn: "Jonah's Whale", nameEs: "Ballena de Jonás", descriptionEn: 'The great fish that carried Jonah to Nineveh', descriptionEs: 'El gran pez que cargo a Jonás hacia Nínive', pricePoints: 0, rarity: 'epic', assetRef: '🐋', metadata: JSON.stringify({ emoji: '🐋', collectionId: 'adventure_jonas', isV2: true, animationReady: true, isAdventure: true, adventureId: 'adv_jonah' }) },
  // --- Aventura 2: David vs Goliat ---
  { id: 'avatar_adv_david_sling', type: 'avatar', nameEn: 'David with Sling', nameEs: 'David con Honda', descriptionEn: 'The shepherd boy who faced a giant with faith and a stone', descriptionEs: 'El pastorcillo que enfrentó a un gigante con fe y una piedra', pricePoints: 0, rarity: 'epic', assetRef: '🪨', metadata: JSON.stringify({ emoji: '🪨', collectionId: 'adventure_david', isV2: true, animationReady: true, isAdventure: true, adventureId: 'adv_david', visualStyle: 'sticker_sling_golden' }) },
  // --- Aventura 3: Ester (preparada) ---
  { id: 'avatar_adv_queen_esther', type: 'avatar', nameEn: 'Queen Esther', nameEs: 'Reina Ester', descriptionEn: 'The queen who risked her life to save her people', descriptionEs: 'La reina que arriesgó su vida para salvar a su pueblo', pricePoints: 0, rarity: 'epic', assetRef: '👑', metadata: JSON.stringify({ emoji: '👑', collectionId: 'adventure_esther', isV2: true, animationReady: false, isAdventure: true, adventureId: 'adv_esther', comingSoon: true }) },
  // --- Aventura 4: Daniel (preparada) ---
  { id: 'avatar_adv_lion_faith', type: 'avatar', nameEn: 'Lion of Faith', nameEs: 'León de la Fe', descriptionEn: 'Daniel standing firm before the lions through unwavering faith', descriptionEs: 'Daniel firme ante los leones por fe inquebrantable', pricePoints: 0, rarity: 'epic', assetRef: '🦁', metadata: JSON.stringify({ emoji: '🦁', collectionId: 'adventure_daniel', isV2: true, animationReady: false, isAdventure: true, adventureId: 'adv_daniel', comingSoon: true }) },
  // ── Aventuras 5–9 V3 (animation-ready) ─────────────────────────────────────
  { id: 'avatar_adv_moses_sea', type: 'avatar', nameEn: 'Moses at the Sea', nameEs: 'Moisés en el Mar', descriptionEn: 'The sea parts before Moses', descriptionEs: 'El mar se abre ante Moisés', pricePoints: 0, rarity: 'epic', assetRef: '🌊', metadata: JSON.stringify({ emoji: '🌊', collectionId: 'adventure_moses', isV2: true, animationReady: true, animationType: 'subtle_loop', isAdventure: true, adventureId: 'adv_moses', comingSoon: true }) },
  { id: 'avatar_adv_noah_dove', type: 'avatar', nameEn: "Noah's Dove", nameEs: 'Paloma de Noé', descriptionEn: 'The dove that carried the promise of peace', descriptionEs: 'La paloma que cargó la promesa de paz', pricePoints: 0, rarity: 'epic', assetRef: '🕊️', metadata: JSON.stringify({ emoji: '🕊️', collectionId: 'adventure_noah', isV2: true, animationReady: true, animationType: 'subtle_loop', isAdventure: true, adventureId: 'adv_noah', comingSoon: true }) },
  { id: 'avatar_adv_elijah_fire', type: 'avatar', nameEn: "Elijah's Fire", nameEs: 'Fuego de Elías', descriptionEn: "Fire from heaven answering Elijah's prayer", descriptionEs: 'Fuego del cielo respondiendo la oración de Elías', pricePoints: 0, rarity: 'epic', assetRef: '🔥', metadata: JSON.stringify({ emoji: '🔥', collectionId: 'adventure_elijah', isV2: true, animationReady: true, animationType: 'subtle_loop', isAdventure: true, adventureId: 'adv_elijah', comingSoon: true }) },
  { id: 'avatar_adv_joseph_dream', type: 'avatar', nameEn: 'Joseph the Dreamer', nameEs: 'José el Soñador', descriptionEn: 'The dreamer whose visions came from God', descriptionEs: 'El soñador cuyas visiones venían de Dios', pricePoints: 0, rarity: 'epic', assetRef: '⭐', metadata: JSON.stringify({ emoji: '⭐', collectionId: 'adventure_joseph', isV2: true, animationReady: true, animationType: 'subtle_loop', isAdventure: true, adventureId: 'adv_joseph', comingSoon: true }) },
  { id: 'avatar_adv_paul_scroll', type: 'avatar', nameEn: 'Paul with Scroll', nameEs: 'Pablo con Pergamino', descriptionEn: 'The apostle who wrote to the nations', descriptionEs: 'El apóstol que escribió a las naciones', pricePoints: 0, rarity: 'epic', assetRef: '📜', metadata: JSON.stringify({ emoji: '📜', collectionId: 'adventure_paul', isV2: true, animationReady: true, animationType: 'subtle_loop', isAdventure: true, adventureId: 'adv_paul', comingSoon: true }) },
];

const FRAMES_ADVENTURES = [
  // Aventura 1: Jonás
  { id: 'frame_adv_ocean_deep', type: 'frame', nameEn: 'Deep Ocean', nameEs: 'Océano Profundo', descriptionEn: 'Depths of the sea where Jonah was carried by the great fish', descriptionEs: 'Las profundidades del mar donde Jonás fue llevado por el gran pez', pricePoints: 0, rarity: 'epic', assetRef: '#1A4A7A', metadata: JSON.stringify({ color: '#1A4A7A', isV2: true, isAdventure: true, adventureId: 'adv_jonah' }) },
  // Aventura 2: David vs Goliat
  { id: 'frame_adv_valley_battle', type: 'frame', nameEn: 'Valley of Battle', nameEs: 'Valle de Batalla', descriptionEn: 'The golden valley where David defeated Goliath', descriptionEs: 'El valle dorado donde David venció a Goliat', pricePoints: 0, rarity: 'epic', assetRef: '#C89B3C', metadata: JSON.stringify({ color: '#C89B3C', colorSecondary: '#6A4E23', isV2: true, isAdventure: true, adventureId: 'adv_david' }) },
  // Aventura 3: Ester (preparada)
  { id: 'frame_adv_royal_persia', type: 'frame', nameEn: 'Royal Persia', nameEs: 'Persia Real', descriptionEn: 'The royal court of Persia, where Esther found favor', descriptionEs: 'La corte real de Persia, donde Ester halló favor', pricePoints: 0, rarity: 'epic', assetRef: '#8B1A4A', metadata: JSON.stringify({ color: '#8B1A4A', colorSecondary: '#D4AF37', isV2: true, isAdventure: true, adventureId: 'adv_esther', comingSoon: true }) },
  // Aventura 4: Daniel (preparada)
  { id: 'frame_adv_lions_den', type: 'frame', nameEn: "Lion's Den", nameEs: 'Fosa de los Leones', descriptionEn: 'The den of lions where Daniel prayed without ceasing', descriptionEs: 'La fosa de los leones donde Daniel oró sin cesar', pricePoints: 0, rarity: 'epic', assetRef: '#2A1A0A', metadata: JSON.stringify({ color: '#2A1A0A', colorSecondary: '#C17A2A', isV2: true, isAdventure: true, adventureId: 'adv_daniel', comingSoon: true }) },
  // ── Aventuras 5–9 (V3) ──────────────────────────────────────────────────────
  { id: 'frame_adv_red_sea', type: 'frame', nameEn: 'Red Sea', nameEs: 'Mar Rojo', descriptionEn: 'The parted sea — walls of water on both sides', descriptionEs: 'El mar abierto — muros de agua a ambos lados', pricePoints: 0, rarity: 'epic', assetRef: '#1E6FA8', metadata: JSON.stringify({ color: '#1E6FA8', isV2: true, isAdventure: true, adventureId: 'adv_moses', comingSoon: true }) },
  { id: 'frame_adv_rainbow', type: 'frame', nameEn: 'Rainbow Covenant', nameEs: 'Arco del Pacto', descriptionEn: "The eternal rainbow of God's covenant with Noah", descriptionEs: 'El arco eterno del pacto de Dios con Noé', pricePoints: 0, rarity: 'epic', assetRef: '#7C3AED', metadata: JSON.stringify({ color: '#7C3AED', isV2: true, isAdventure: true, adventureId: 'adv_noah', comingSoon: true }) },
  { id: 'frame_adv_fire_heaven', type: 'frame', nameEn: 'Fire from Heaven', nameEs: 'Fuego del Cielo', descriptionEn: "The consuming fire that answered Elijah's prayer", descriptionEs: 'El fuego consumidor que respondió la oración de Elías', pricePoints: 0, rarity: 'epic', assetRef: '#DC4E0A', metadata: JSON.stringify({ color: '#DC4E0A', isV2: true, isAdventure: true, adventureId: 'adv_elijah', comingSoon: true }) },
  { id: 'frame_adv_dream_stars', type: 'frame', nameEn: 'Dream of Stars', nameEs: 'Sueño de Estrellas', descriptionEn: "The starlit sky of Joseph's prophetic dreams", descriptionEs: 'El cielo estrellado de los sueños proféticos de José', pricePoints: 0, rarity: 'epic', assetRef: '#1E3A8A', metadata: JSON.stringify({ color: '#1E3A8A', isV2: true, isAdventure: true, adventureId: 'adv_joseph', comingSoon: true }) },
  { id: 'frame_adv_mission_world', type: 'frame', nameEn: 'World Mission', nameEs: 'Misión al Mundo', descriptionEn: "The wide horizon of Paul's apostolic mission", descriptionEs: 'El horizonte amplio de la misión apostólica de Pablo', pricePoints: 0, rarity: 'epic', assetRef: '#064E3B', metadata: JSON.stringify({ color: '#064E3B', isV2: true, isAdventure: true, adventureId: 'adv_paul', comingSoon: true }) },
];

const TITLES_ADVENTURES = [
  // Aventura 1: Jonás
  { id: 'title_mensajero_senor', type: 'title', nameEn: 'Messenger of the Lord', nameEs: 'Mensajero del Señor', descriptionEn: 'Called and sent by God to deliver His message', descriptionEs: 'Llamado y enviado por Dios para entregar Su mensaje', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isAdventure: true, adventureId: 'adv_jonah' }) },
  // Aventura 2: David vs Goliat
  { id: 'title_vencedor_gigantes', type: 'title', nameEn: 'Giant Slayer', nameEs: 'Vencedor de Gigantes', descriptionEn: 'One who faces impossible odds with faith and overcomes', descriptionEs: 'Quien enfrenta lo imposible con fe y vence', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isAdventure: true, adventureId: 'adv_david' }) },
  // Aventura 3: Ester (preparada)
  { id: 'title_valiente_corazon', type: 'title', nameEn: 'Brave Heart', nameEs: 'Valiente de Corazón', descriptionEn: 'One whose courage comes from a heart surrendered to God', descriptionEs: 'Aquel cuyo valor viene de un corazón rendido a Dios', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isAdventure: true, adventureId: 'adv_esther', comingSoon: true }) },
  // Aventura 4: Daniel (preparada)
  { id: 'title_fe_inquebrantable', type: 'title', nameEn: 'Unbreakable Faith', nameEs: 'Fe Inquebrantable', descriptionEn: 'One whose faith cannot be shaken by any trial', descriptionEs: 'Aquel cuya fe no puede ser quebrantada por ninguna prueba', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isAdventure: true, adventureId: 'adv_daniel', comingSoon: true }) },
  // ── Aventuras 5–9 (V3) ──────────────────────────────────────────────────────
  { id: 'title_camino_en_el_mar', type: 'title', nameEn: 'Path Through the Sea', nameEs: 'Camino en el Mar', descriptionEn: 'God opens a way where there is none', descriptionEs: 'Dios abre camino donde no lo hay', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isAdventure: true, adventureId: 'adv_moses', comingSoon: true }) },
  { id: 'title_guardian_del_pacto', type: 'title', nameEn: 'Guardian of the Covenant', nameEs: 'Guardián del Pacto', descriptionEn: "Keeper of God's eternal promises", descriptionEs: 'Guardián de las promesas eternas de Dios', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isAdventure: true, adventureId: 'adv_noah', comingSoon: true }) },
  { id: 'title_profeta_de_fuego', type: 'title', nameEn: 'Prophet of Fire', nameEs: 'Profeta de Fuego', descriptionEn: 'Burning with holy zeal for God', descriptionEs: 'Ardiendo con celo santo por Dios', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isAdventure: true, adventureId: 'adv_elijah', comingSoon: true }) },
  { id: 'title_sonador_de_dios', type: 'title', nameEn: 'Dreamer of God', nameEs: 'Soñador de Dios', descriptionEn: 'Carrying visions from the throne of God', descriptionEs: 'Portando visiones del trono de Dios', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isAdventure: true, adventureId: 'adv_joseph', comingSoon: true }) },
  { id: 'title_apostol_de_las_naciones', type: 'title', nameEn: 'Apostle to the Nations', nameEs: 'Apóstol de las Naciones', descriptionEn: 'Sent to proclaim the gospel to every people', descriptionEs: 'Enviado a proclamar el evangelio a todo pueblo', pricePoints: 0, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isAdventure: true, adventureId: 'adv_paul', comingSoon: true }) },
];

// ============================================
// AVATAR FRAMES V2 (12 premium frames)
// ============================================
const FRAMES_V2 = [
  { id: 'frame_v2_hoja_oro', type: 'frame', nameEn: 'Gold Leaf', nameEs: 'Hoja de Oro', descriptionEn: 'Fine gold leaf edge with warm radiance', descriptionEs: 'Borde de hoja de oro fino con calidez', pricePoints: 450, rarity: 'rare', assetRef: '#D4A017', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_plata_brillo', type: 'frame', nameEn: 'Silver Glow', nameEs: 'Brillo de Plata', descriptionEn: 'Shimmering silver ring of purity', descriptionEs: 'Anillo de plata refulgente de pureza', pricePoints: 350, rarity: 'common', assetRef: '#B8C8D8', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_olivo', type: 'frame', nameEn: 'Olive Wreath', nameEs: 'Corona de Olivo', descriptionEn: 'Ancient olive branch wreath of peace', descriptionEs: 'Corona antigua de olivo de la paz', pricePoints: 400, rarity: 'rare', assetRef: '#6B8F47', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_amanecer', type: 'frame', nameEn: 'Sunrise Ring', nameEs: 'Anillo Amanecer', descriptionEn: 'Soft dawn gradient circling with hope', descriptionEs: 'Degradado suave del amanecer con esperanza', pricePoints: 380, rarity: 'common', assetRef: '#F4A261', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_pergamino', type: 'frame', nameEn: 'Parchment Edge', nameEs: 'Borde Pergamino', descriptionEn: 'Aged scripture scroll border', descriptionEs: 'Borde de pergamino de escrituras antiguas', pricePoints: 320, rarity: 'common', assetRef: '#C9A96E', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_halo_azul', type: 'frame', nameEn: 'Calm Blue Halo', nameEs: 'Halo Azul Sereno', descriptionEn: 'Tranquil blue celestial halo', descriptionEs: 'Halo celestial azul tranquilo', pricePoints: 420, rarity: 'rare', assetRef: '#4A90D9', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_fuego_sagrado', type: 'frame', nameEn: 'Sacred Fire', nameEs: 'Fuego Sagrado', descriptionEn: 'Holy Spirit fire ring of power', descriptionEs: 'Anillo de fuego del Espiritu Santo', pricePoints: 600, rarity: 'epic', assetRef: '#E85D04', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_luna_plata', type: 'frame', nameEn: 'Silver Moon', nameEs: 'Luna de Plata', descriptionEn: 'Moonlit silver glow for the night watchman', descriptionEs: 'Resplandor plateado lunar para el vigilante', pricePoints: 480, rarity: 'rare', assetRef: '#8EABD4', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_jade', type: 'frame', nameEn: 'Jade Garden', nameEs: 'Jardin Jade', descriptionEn: 'Deep green jade ring of life', descriptionEs: 'Anillo verde jade profundo de vida', pricePoints: 360, rarity: 'common', assetRef: '#00A878', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_zafiro', type: 'frame', nameEn: 'Sapphire Crown', nameEs: 'Corona Zafiro', descriptionEn: 'Royal sapphire crown frame', descriptionEs: 'Marco de corona de zafiro real', pricePoints: 750, rarity: 'epic', assetRef: '#1E6EBE', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_rosa_gracia', type: 'frame', nameEn: 'Rose of Grace', nameEs: 'Rosa de Gracia', descriptionEn: 'Blush rose petal frame of tender grace', descriptionEs: 'Marco de petalo de rosa del amor tierno', pricePoints: 420, rarity: 'rare', assetRef: '#E8829A', metadata: JSON.stringify({ isV2: true }) },
  { id: 'frame_v2_tierra_santa', type: 'frame', nameEn: 'Holy Land', nameEs: 'Tierra Santa', descriptionEn: 'Warm desert sand of ancient holy ground', descriptionEs: 'Arena calida del desierto de tierra santa', pricePoints: 340, rarity: 'common', assetRef: '#C8956C', metadata: JSON.stringify({ isV2: true }) },
];

// ============================================
// CHAPTER COLLECTIONS — New Themes (4)
// ============================================
const THEMES_CHAPTER = [
  {
    id: 'theme_covenant_rainbow',
    type: 'theme',
    nameEn: 'Covenant Rainbow',
    nameEs: 'Arcoiris del Pacto',
    descriptionEn: 'Rainbow hues of the eternal covenant',
    descriptionEs: 'Tonos arcoiris del pacto eterno',
    pricePoints: 500,
    rarity: 'rare',
    assetRef: 'covenant_rainbow',
    metadata: JSON.stringify({
      primary: '#6D28D9', secondary: '#F59E0B', accent: '#10B981',
      background: '#FDFBFF', backgroundDark: '#150B2E',
      surface: '#FFFFFF', surfaceDark: '#22153F',
    }),
  },
  {
    id: 'theme_hope_dawn',
    type: 'theme',
    nameEn: 'Hope Dawn',
    nameEs: 'Amanecer de Esperanza',
    descriptionEn: 'Warm first light of a new beginning',
    descriptionEs: 'Primera luz calida de un nuevo comienzo',
    pricePoints: 420,
    rarity: 'rare',
    assetRef: 'hope_dawn',
    metadata: JSON.stringify({
      primary: '#F97316', secondary: '#FB923C', accent: '#FDE68A',
      background: '#FFF7ED', backgroundDark: '#1C0F00',
      surface: '#FFFFFF', surfaceDark: '#2D1A08',
    }),
  },
  {
    id: 'theme_calm_river',
    type: 'theme',
    nameEn: 'Calm River',
    nameEs: 'Rio Tranquilo',
    descriptionEn: 'Still waters flowing with peace',
    descriptionEs: 'Aguas quietas fluyendo en paz',
    pricePoints: 380,
    rarity: 'common',
    assetRef: 'calm_river',
    metadata: JSON.stringify({
      primary: '#0891B2', secondary: '#06B6D4', accent: '#A5F3FC',
      background: '#F0FDFF', backgroundDark: '#042830',
      surface: '#FFFFFF', surfaceDark: '#083344',
    }),
  },
  {
    id: 'theme_unshakable_rock',
    type: 'theme',
    nameEn: 'Unshakable Rock',
    nameEs: 'Roca Inquebrantable',
    descriptionEn: 'Solid as a rock, firm in truth',
    descriptionEs: 'Solido como roca, firme en la verdad',
    pricePoints: 460,
    rarity: 'rare',
    assetRef: 'unshakable_rock',
    metadata: JSON.stringify({
      primary: '#78350F', secondary: '#92400E', accent: '#FDE68A',
      background: '#FFFBEB', backgroundDark: '#1A0E00',
      surface: '#FFFFFF', surfaceDark: '#2A1A08',
    }),
  },
];

// ============================================
// CHAPTER COLLECTIONS — New Frames (4)
// ============================================
const FRAMES_CHAPTER = [
  { id: 'frame_faithful_seal', type: 'frame', nameEn: 'Faithful Seal', nameEs: 'Sello Fiel', descriptionEn: 'Sealed by the promise of the Faithful One', descriptionEs: 'Sellado por la promesa del Fiel', pricePoints: 350, rarity: 'rare', assetRef: '#4F46E5' },
  { id: 'frame_gentle_breeze', type: 'frame', nameEn: 'Gentle Breeze', nameEs: 'Brisa Suave', descriptionEn: 'Soft breath of the Spirit', descriptionEs: 'Suave soplo del Espiritu', pricePoints: 300, rarity: 'common', assetRef: '#10B981' },
  { id: 'frame_serene_crown', type: 'frame', nameEn: 'Serene Crown', nameEs: 'Corona Serena', descriptionEn: 'A crown of self-control and peace', descriptionEs: 'Una corona de dominio propio y paz', pricePoints: 450, rarity: 'rare', assetRef: '#8B5CF6' },
  { id: 'frame_shield_faith', type: 'frame', nameEn: 'Shield of Faith', nameEs: 'Escudo de Fe', descriptionEn: 'Extinguishes the flaming arrows of the evil one', descriptionEs: 'Apaga los dardos encendidos del maligno', pricePoints: 500, rarity: 'epic', assetRef: '#DC2626' },
];

// ============================================
// CHAPTER COLLECTIONS — New Titles (4)
// ============================================
const TITLES_CHAPTER = [
  { id: 'title_heir_promises', type: 'title', nameEn: 'Heir of Promises', nameEs: 'Heredero de Promesas', descriptionEn: 'Recipient of every divine promise', descriptionEs: 'Receptor de cada promesa divina', pricePoints: 450, rarity: 'rare', assetRef: '' },
  { id: 'title_patient_wait', type: 'title', nameEn: 'Patient in Waiting', nameEs: 'Paciente en la Espera', descriptionEn: 'Enduring with joyful hope', descriptionEs: 'Perseverando con esperanza gozosa', pricePoints: 400, rarity: 'rare', assetRef: '' },
  { id: 'title_belt_truth', type: 'title', nameEn: 'Belt of Truth', nameEs: 'Cinturon de Verdad', descriptionEn: 'Girded with the truth of God', descriptionEs: 'Cenido con la verdad de Dios', pricePoints: 400, rarity: 'rare', assetRef: '' },
  { id: 'title_guard_word', type: 'title', nameEn: 'Guard of the Word', nameEs: 'Guardia de la Palabra', descriptionEn: 'Defender of sacred scripture', descriptionEs: 'Defensor de las sagradas escrituras', pricePoints: 500, rarity: 'epic', assetRef: '' },
];

// ============================================
// V2 — CITAS BÍBLICAS (Biblical Citations Titles, 20 items)
// ============================================
const TITLES_V2_CITAS = [
  { id: 'title_psalm_shepherd', type: 'title', nameEn: 'The Lord is my Shepherd', nameEs: 'El Señor es mi Pastor', descriptionEn: 'Guided and provided for by the Shepherd', descriptionEs: 'Guiado y provisto por el Pastor', pricePoints: 350, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Salmo 23:1' }) },
  { id: 'title_all_through_christ', type: 'title', nameEn: 'I can do all through Christ', nameEs: 'Todo lo puedo en Cristo', descriptionEn: 'Strength found in Christ alone', descriptionEs: 'Fuerza hallada solo en Cristo', pricePoints: 300, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Filipenses 4:13' }) },
  { id: 'title_more_than_conquerors', type: 'title', nameEn: 'More than Conquerors', nameEs: 'Más que vencedores', descriptionEn: 'Overcoming through His love', descriptionEs: 'Venciendo a través de su amor', pricePoints: 400, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Romanos 8:37' }) },
  { id: 'title_lord_my_light', type: 'title', nameEn: 'The Lord is my Light', nameEs: 'El Señor es mi luz', descriptionEn: 'No darkness can overcome this light', descriptionEs: 'Ninguna oscuridad puede vencer esta luz', pricePoints: 350, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Salmo 27:1' }) },
  { id: 'title_joy_is_strength', type: 'title', nameEn: 'Joy of the Lord is my Strength', nameEs: 'El gozo del Señor es mi fuerza', descriptionEn: 'Sustained by unshakeable joy', descriptionEs: 'Sostenido por un gozo inquebrantable', pricePoints: 400, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Nehemías 8:10' }) },
  { id: 'title_grace_is_enough', type: 'title', nameEn: 'My Grace is Sufficient', nameEs: 'Mi gracia es suficiente', descriptionEn: 'His grace is enough in weakness', descriptionEs: 'Su gracia es suficiente en la debilidad', pricePoints: 450, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: '2 Corintios 12:9' }) },
  { id: 'title_walk_by_faith', type: 'title', nameEn: 'We Walk by Faith', nameEs: 'Andamos por fe', descriptionEn: 'Not by sight but by trust in Him', descriptionEs: 'No por vista sino por confianza en Él', pricePoints: 300, rarity: 'common', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: '2 Corintios 5:7' }) },
  { id: 'title_god_is_love', type: 'title', nameEn: 'God is Love', nameEs: 'Dios es amor', descriptionEn: 'Living in the fullness of divine love', descriptionEs: 'Viviendo en la plenitud del amor divino', pricePoints: 350, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: '1 Juan 4:8' }) },
  { id: 'title_peace_of_christ', type: 'title', nameEn: 'Peace of Christ Rules', nameEs: 'La paz de Cristo gobierne', descriptionEn: 'Peace ruling heart and mind', descriptionEs: 'La paz gobernando el corazón y la mente', pricePoints: 400, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Colosenses 3:15' }) },
  { id: 'title_word_is_light', type: 'title', nameEn: 'Your Word is a Lamp', nameEs: 'Tu palabra es lámpara', descriptionEn: 'Guided by the light of scripture', descriptionEs: 'Guiado por la luz de las escrituras', pricePoints: 350, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Salmo 119:105' }) },
  { id: 'title_lord_my_refuge', type: 'title', nameEn: 'The Lord is my Refuge', nameEs: 'El Señor es mi refugio', descriptionEn: 'Safe in the shadow of the Almighty', descriptionEs: 'Seguro a la sombra del Todopoderoso', pricePoints: 400, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Salmo 91:2' }) },
  { id: 'title_be_strong_courage', type: 'title', nameEn: 'Be Strong and Courageous', nameEs: 'Sé fuerte y valiente', descriptionEn: 'Courage given by God himself', descriptionEs: 'Valentía dada por Dios mismo', pricePoints: 450, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Josué 1:9' }) },
  { id: 'title_lord_fights', type: 'title', nameEn: 'The Lord Fights for You', nameEs: 'El Señor peleará por ustedes', descriptionEn: 'Standing still while God battles', descriptionEs: 'Quieto mientras Dios pelea la batalla', pricePoints: 500, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Éxodo 14:14' }) },
  { id: 'title_lord_is_good', type: 'title', nameEn: 'The Lord is Good', nameEs: 'Bueno es el Señor', descriptionEn: 'Declaring His goodness in every season', descriptionEs: 'Declarando su bondad en toda temporada', pricePoints: 300, rarity: 'common', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Salmo 100:5' }) },
  { id: 'title_god_with_us', type: 'title', nameEn: 'God With Us', nameEs: 'Dios con nosotros', descriptionEn: 'Emmanuel, forever present', descriptionEs: 'Emmanuel, siempre presente', pricePoints: 400, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Mateo 1:23' }) },
  { id: 'title_living_hope', type: 'title', nameEn: 'Living Hope', nameEs: 'Esperanza viva', descriptionEn: 'Reborn into a living hope through Christ', descriptionEs: 'Renacido a una esperanza viva por Cristo', pricePoints: 450, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: '1 Pedro 1:3' }) },
  { id: 'title_renewed_strength', type: 'title', nameEn: 'They Will Renew Their Strength', nameEs: 'Renovarán sus fuerzas', descriptionEn: 'Soaring on wings like eagles', descriptionEs: 'Remontando el vuelo como las águilas', pricePoints: 500, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Isaías 40:31' }) },
  { id: 'title_light_world', type: 'title', nameEn: 'Light of the World', nameEs: 'Luz del mundo', descriptionEn: 'Shining before all people', descriptionEs: 'Brillando ante todo el mundo', pricePoints: 550, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Mateo 5:14' }) },
  { id: 'title_abide_in_me', type: 'title', nameEn: 'Remain in Me', nameEs: 'Permanezcan en mí', descriptionEn: 'Connected to the Vine, bearing fruit', descriptionEs: 'Conectado a la Vid, dando fruto', pricePoints: 450, rarity: 'rare', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: 'Juan 15:4' }) },
  { id: 'title_love_never_fails', type: 'title', nameEn: 'Love Never Fails', nameEs: 'El amor nunca falla', descriptionEn: 'Walking in the love that endures forever', descriptionEs: 'Caminando en el amor que dura para siempre', pricePoints: 500, rarity: 'epic', assetRef: '', metadata: JSON.stringify({ isV2: true, bibleRef: '1 Corintios 13:8' }) },
];

// ============================================
// AVATARS V3 PREMIUM — Illustrated (Non-adventure, direct purchase)
// IDs are IMMUTABLE. releasedAt stored in metadata for auditing.
// ============================================
const AVATARS_V3_PREMIUM = [
  {
    id: 'avatar_v3_paloma_luz',
    type: 'avatar',
    nameEn: 'Paloma de Luz',
    nameEs: 'Paloma de Luz',
    descriptionEn: 'Peace that descends from heaven',
    descriptionEs: 'Paz que desciende del cielo',
    pricePoints: 1200,
    rarity: 'epic',
    assetRef: '🕊️',
    metadata: JSON.stringify({ isV3: true, subcategory: 'v3_premium', releasedAt: '2026-03-04T00:00:00.000Z' }),
  },
  {
    id: 'avatar_v3_leon_valiente',
    type: 'avatar',
    nameEn: 'León Valiente',
    nameEs: 'León Valiente',
    descriptionEn: 'Strength with purpose',
    descriptionEs: 'Fuerza con propósito',
    pricePoints: 1200,
    rarity: 'epic',
    assetRef: '🦁',
    metadata: JSON.stringify({ isV3: true, subcategory: 'v3_premium', releasedAt: '2026-03-04T00:00:00.000Z' }),
  },
  {
    id: 'avatar_v3_olivo_gracia',
    type: 'avatar',
    nameEn: 'Olivo de Gracia',
    nameEs: 'Olivo de Gracia',
    descriptionEn: 'Firm roots in God',
    descriptionEs: 'Raíces firmes en Dios',
    pricePoints: 1200,
    rarity: 'epic',
    assetRef: '🌿',
    metadata: JSON.stringify({ isV3: true, subcategory: 'v3_premium', releasedAt: '2026-03-04T00:00:00.000Z' }),
  },
];

// ============================================
// CHAPTER COLLECTIONS — New Avatars (6)
// ============================================
const AVATARS_CHAPTER = [
  { id: 'avatar_promise_scroll', type: 'avatar', nameEn: 'Promise Scroll', nameEs: 'Pergamino de Promesa', descriptionEn: 'Ancient scroll bearing divine promises', descriptionEs: 'Pergamino antiguo con promesas divinas', pricePoints: 350, rarity: 'rare', assetRef: '📜' },
  { id: 'avatar_guiding_star', type: 'avatar', nameEn: 'Guiding Star', nameEs: 'Estrella Guia', descriptionEn: 'Star that guides toward fulfillment', descriptionEs: 'Estrella que guia hacia el cumplimiento', pricePoints: 400, rarity: 'rare', assetRef: '🌟' },
  { id: 'avatar_joyful_heart', type: 'avatar', nameEn: 'Joyful Heart', nameEs: 'Corazon Alegre', descriptionEn: 'Heart overflowing with the fruit of joy', descriptionEs: 'Corazon desbordando el fruto del gozo', pricePoints: 300, rarity: 'common', assetRef: '💛' },
  { id: 'avatar_serving_hands', type: 'avatar', nameEn: 'Serving Hands', nameEs: 'Manos Serviciales', descriptionEn: 'Hands of goodness and service', descriptionEs: 'Manos de bondad en servicio', pricePoints: 350, rarity: 'rare', assetRef: '🤲' },
  { id: 'avatar_lamp_lit', type: 'avatar', nameEn: 'Lamp of Truth', nameEs: 'Lampara de la Verdad', descriptionEn: 'Lamp of truth lighting the path', descriptionEs: 'Lampara de verdad iluminando el camino', pricePoints: 350, rarity: 'rare', assetRef: '🪔' },
  { id: 'avatar_sword_spirit', type: 'avatar', nameEn: 'Sword of the Spirit', nameEs: 'Espada del Espiritu', descriptionEn: 'Living Word as a spiritual weapon', descriptionEs: 'Palabra viva como arma espiritual', pricePoints: 500, rarity: 'epic', assetRef: '⚔️' },
];
interface StoreItemInput {
  id: string;
  type: string;
  nameEn: string;
  nameEs: string;
  descriptionEn: string;
  descriptionEs: string;
  pricePoints: number;
  rarity: string;
  assetRef: string;
  metadata?: string;
}

// ============================================
// SEED FUNCTION
// ============================================
async function upsertItem(item: StoreItemInput, sortOrder: number): Promise<void> {
  await prisma.storeItem.upsert({
    where: { id: item.id },
    update: {
      type: item.type,
      nameEn: item.nameEn,
      nameEs: item.nameEs,
      descriptionEn: item.descriptionEn,
      descriptionEs: item.descriptionEs,
      pricePoints: item.pricePoints,
      rarity: item.rarity,
      assetRef: item.assetRef,
      metadata: item.metadata ?? '{}',
      sortOrder,
    },
    create: {
      id: item.id,
      type: item.type,
      nameEn: item.nameEn,
      nameEs: item.nameEs,
      descriptionEn: item.descriptionEn,
      descriptionEs: item.descriptionEs,
      pricePoints: item.pricePoints,
      rarity: item.rarity,
      assetRef: item.assetRef,
      metadata: item.metadata ?? '{}',
      sortOrder,
    },
  });
}

export async function seedStoreItems() {
  console.log('Starting store items seed...\n');

  let sortOrder = 0;

  // Seed themes (original)
  console.log('Seeding themes...');
  for (const theme of THEMES) {
    await upsertItem(theme, sortOrder++);
  }
  console.log(`  Themes: ${THEMES.length} processed`);

  // Seed themes V2 (premium)
  console.log('Seeding themes V2...');
  for (const theme of THEMES_V2) {
    await upsertItem(theme, sortOrder++);
  }
  console.log(`  Themes V2: ${THEMES_V2.length} processed`);

  // Seed frames
  console.log('Seeding avatar frames...');
  for (const frame of FRAMES) {
    await upsertItem(frame, sortOrder++);
  }
  console.log(`  Avatar frames: ${FRAMES.length} processed`);

  // Seed frames V2
  console.log('Seeding avatar frames V2...');
  for (const frame of FRAMES_V2) {
    await upsertItem(frame, sortOrder++);
  }
  console.log(`  Avatar frames V2: ${FRAMES_V2.length} processed`);

  // Seed music tracks
  console.log('Seeding music tracks...');
  for (const track of MUSIC_TRACKS) {
    await upsertItem(track, sortOrder++);
  }
  console.log(`  Music tracks: ${MUSIC_TRACKS.length} processed`);

  // Seed titles
  console.log('Seeding spiritual titles...');
  for (const title of TITLES) {
    await upsertItem(title, sortOrder++);
  }
  console.log(`  Spiritual titles: ${TITLES.length} processed`);

  // Seed chest-only titles
  console.log('Seeding chest-only titles...');
  for (const title of TITLES_CHEST) {
    await upsertItem(title, sortOrder++);
  }
  console.log(`  Chest-only titles: ${TITLES_CHEST.length} processed`);

  // Seed avatars (original)
  console.log('Seeding premium avatars...');
  for (const avatar of AVATARS) {
    await upsertItem(avatar, sortOrder++);
  }
  console.log(`  Premium avatars: ${AVATARS.length} processed`);

  // Seed avatars V2 (premium illustrated)
  console.log('Seeding avatars V2...');
  for (const avatar of AVATARS_V2) {
    await upsertItem(avatar, sortOrder++);
  }
  console.log(`  Avatars V2: ${AVATARS_V2.length} processed`);

  // Seed avatars Level 2 (identity & calling)
  console.log('Seeding avatars Level 2...');
  for (const avatar of AVATARS_L2) {
    await upsertItem(avatar, sortOrder++);
  }
  console.log(`  Avatars L2: ${AVATARS_L2.length} processed`);

  // Seed adventure items (Biblical Adventures)
  console.log('Seeding Biblical Adventure items...');
  for (const avatar of AVATARS_ADVENTURES) {
    await upsertItem(avatar, sortOrder++);
  }
  for (const frame of FRAMES_ADVENTURES) {
    await upsertItem(frame, sortOrder++);
  }
  for (const title of TITLES_ADVENTURES) {
    await upsertItem(title, sortOrder++);
  }
  console.log(`  Adventure items: ${AVATARS_ADVENTURES.length + FRAMES_ADVENTURES.length + TITLES_ADVENTURES.length} processed`);

  // Seed chapter collection themes
  console.log('Seeding chapter collection themes...');
  for (const theme of THEMES_CHAPTER) {
    await upsertItem(theme, sortOrder++);
  }
  console.log(`  Chapter themes: ${THEMES_CHAPTER.length} processed`);

  // Seed chapter collection frames
  console.log('Seeding chapter collection frames...');
  for (const frame of FRAMES_CHAPTER) {
    await upsertItem(frame, sortOrder++);
  }
  console.log(`  Chapter frames: ${FRAMES_CHAPTER.length} processed`);

  // Seed chapter collection titles
  console.log('Seeding chapter collection titles...');
  for (const title of TITLES_CHAPTER) {
    await upsertItem(title, sortOrder++);
  }
  console.log(`  Chapter titles: ${TITLES_CHAPTER.length} processed`);

  // Seed V2 Biblical Citation titles
  console.log('Seeding V2 Citas Bíblicas titles...');
  for (const title of TITLES_V2_CITAS) {
    await upsertItem(title, sortOrder++);
  }
  console.log(`  V2 Citas Bíblicas titles: ${TITLES_V2_CITAS.length} processed`);

  // Seed chapter collection avatars
  console.log('Seeding chapter collection avatars...');
  for (const avatar of AVATARS_CHAPTER) {
    await upsertItem(avatar, sortOrder++);
  }
  console.log(`  Chapter avatars: ${AVATARS_CHAPTER.length} processed`);

  // Seed V3 Premium avatars
  console.log('Seeding V3 Premium avatars...');
  for (const avatar of AVATARS_V3_PREMIUM) {
    await upsertItem(avatar, sortOrder++);
  }
  console.log(`  V3 Premium avatars: ${AVATARS_V3_PREMIUM.length} processed`);

  // Seed badges
  console.log('Seeding badges...');
  const BADGES = [
    { id: 'badge_primer_paso', nameEn: 'First Step',        nameEs: 'Primer Paso',             descriptionEn: 'Completed your first devotional', descriptionEs: 'Completaste tu primer devocional',  rarity: 'common', metadata: JSON.stringify({ icon: '🌱', milestoneType: 'devotionals', milestoneValue: 1     }) },
    { id: 'badge_semana',      nameEn: 'Week of Light',     nameEs: 'Semana de Luz',            descriptionEn: '7 devotionals completed',          descriptionEs: '7 devocionales completados',         rarity: 'common', metadata: JSON.stringify({ icon: '📖', milestoneType: 'devotionals', milestoneValue: 7     }) },
    { id: 'badge_30_dias',     nameEn: 'Flame Keeper',      nameEs: 'Guardián de la Llama',     descriptionEn: '30 devotionals completed',         descriptionEs: '30 devocionales completados',        rarity: 'rare',   metadata: JSON.stringify({ icon: '🕯️', milestoneType: 'devotionals', milestoneValue: 30    }) },
    { id: 'badge_100_dias',    nameEn: 'Centurion of Faith',nameEs: 'Centurión de Fe',          descriptionEn: '100 devotionals completed',        descriptionEs: '100 devocionales completados',       rarity: 'epic',   metadata: JSON.stringify({ icon: '✨',  milestoneType: 'devotionals', milestoneValue: 100   }) },
    { id: 'badge_racha_7',     nameEn: 'On Fire',           nameEs: 'En Llamas',                descriptionEn: '7-day streak',                     descriptionEs: 'Racha de 7 días',                    rarity: 'common', metadata: JSON.stringify({ icon: '🔥', milestoneType: 'streak',      milestoneValue: 7     }) },
    { id: 'badge_racha_30',    nameEn: 'Unstoppable',       nameEs: 'Imparable',                descriptionEn: '30-day streak',                    descriptionEs: 'Racha de 30 días',                   rarity: 'rare',   metadata: JSON.stringify({ icon: '⚡', milestoneType: 'streak',      milestoneValue: 30    }) },
    { id: 'badge_1000_pts',    nameEn: 'Silver Seeker',     nameEs: 'Buscador de Plata',        descriptionEn: 'Reached 1,000 points',             descriptionEs: 'Alcanzaste 1,000 puntos',            rarity: 'common', metadata: JSON.stringify({ icon: '🪙', milestoneType: 'points',      milestoneValue: 1000  }) },
    { id: 'badge_10000_pts',   nameEn: 'Gold Pilgrim',      nameEs: 'Peregrino de Oro',         descriptionEn: 'Reached 10,000 points',            descriptionEs: 'Alcanzaste 10,000 puntos',           rarity: 'rare',   metadata: JSON.stringify({ icon: '👑', milestoneType: 'points',      milestoneValue: 10000 }) },
    { id: 'badge_50000_pts',   nameEn: 'Diamond Faithful',  nameEs: 'Fiel de Diamante',         descriptionEn: 'Reached 50,000 points',            descriptionEs: 'Alcanzaste 50,000 puntos',           rarity: 'epic',   metadata: JSON.stringify({ icon: '💎', milestoneType: 'points',      milestoneValue: 50000 }) },
  ];
  for (const badge of BADGES) {
    await prisma.storeItem.upsert({
      where: { id: badge.id },
      update: {},
      create: {
        id: badge.id,
        type: 'badge',
        nameEn: badge.nameEn,
        nameEs: badge.nameEs,
        descriptionEn: badge.descriptionEn,
        descriptionEs: badge.descriptionEs,
        pricePoints: 0,
        rarity: badge.rarity,
        assetRef: badge.id,
        metadata: badge.metadata,
        sortOrder: sortOrder++,
        available: true,
      },
    });
  }
  console.log(`  Badges: ${BADGES.length} processed`);

  // Seed Pincel Mágico (magic paintbrush token - limited 1 per person lifetime)
  console.log('Seeding Pincel Mágico...');
  await prisma.storeItem.upsert({
    where: { id: 'pincel_magico' },
    update: {
      nameEn: 'Magic Paintbrush',
      nameEs: 'Pincel Mágico',
      descriptionEn: 'Allows you to change your nickname once. Use wisely — this is a one-time item per account.',
      descriptionEs: 'Permite cambiar tu nickname una vez. Úsalo con cabeza — es un ítem único por cuenta.',
      pricePoints: 15000,
      rarity: 'legendary',
      type: 'consumable',
      available: true,
      category: 'tokens',
      isNew: true,
      metadata: JSON.stringify({ icon: '🖌️', consumable: true, limitedOnePerAccount: true, warning: 'Úsalo con cuidado' }),
    },
    create: {
      id: 'pincel_magico',
      type: 'consumable',
      nameEn: 'Magic Paintbrush',
      nameEs: 'Pincel Mágico',
      descriptionEn: 'Allows you to change your nickname once. Use wisely — this is a one-time item per account.',
      descriptionEs: 'Permite cambiar tu nickname una vez. Úsalo con cabeza — es un ítem único por cuenta.',
      pricePoints: 15000,
      rarity: 'legendary',
      assetRef: 'pincel_magico',
      category: 'tokens',
      isNew: true,
      metadata: JSON.stringify({ icon: '🖌️', consumable: true, limitedOnePerAccount: true, warning: 'Úsalo con cuidado' }),
      sortOrder: 9999,
      available: true,
    },
  });
  console.log('  Pincel Mágico: processed');

  // Make rename_token unavailable (replaced by pincel_magico)
  await prisma.storeItem.upsert({
    where: { id: 'rename_token' },
    update: { available: false },
    create: {
      id: 'rename_token',
      type: 'consumable',
      nameEn: 'Nickname Change Token (Legacy)',
      nameEs: 'Token de Cambio de Nombre (Legado)',
      descriptionEn: 'Legacy item.',
      descriptionEs: 'Ítem de legado.',
      pricePoints: 99999,
      rarity: 'common',
      assetRef: 'rename_token',
      metadata: JSON.stringify({ icon: '✏️', consumable: true }),
      sortOrder: 9998,
      available: false,
    },
  });

  // Seed Sobre Bíblico (biblical card pack - repeatable consumable)
  console.log('Seeding Sobre Bíblico...');
  await prisma.storeItem.upsert({
    where: { id: 'sobre_biblico' },
    update: {
      nameEn: 'Biblical Envelope',
      nameEs: 'Sobre Bíblico',
      descriptionEn: 'Contains 1 random biblical card for your collection.',
      descriptionEs: 'Contiene 1 carta bíblica aleatoria para tu colección.',
      pricePoints: 1000,
      rarity: 'rare',
      type: 'consumable',
      available: true,
      category: 'special_objects',
      subcategory: 'cartas_biblicas',
      isNew: true,
      metadata: JSON.stringify({
        icon: '✉️',
        consumable: true,
        repeatablePurchase: true,
        cardPack: true,
      }),
    },
    create: {
      id: 'sobre_biblico',
      type: 'consumable',
      nameEn: 'Biblical Envelope',
      nameEs: 'Sobre Bíblico',
      descriptionEn: 'Contains 1 random biblical card for your collection.',
      descriptionEs: 'Contiene 1 carta bíblica aleatoria para tu colección.',
      pricePoints: 1000,
      rarity: 'rare',
      assetRef: 'sobre_biblico',
      category: 'special_objects',
      subcategory: 'cartas_biblicas',
      isNew: true,
      metadata: JSON.stringify({
        icon: '✉️',
        consumable: true,
        repeatablePurchase: true,
        cardPack: true,
      }),
      sortOrder: 10000,
      available: true,
    },
  });
  console.log('  Sobre Bíblico: processed');

  // Seed Sobre de Pascua (easter event card pack - repeatable consumable)
  console.log('Seeding Sobre de Pascua...');
  await prisma.storeItem.upsert({
    where: { id: 'pack_pascua' },
    update: {
      nameEn: 'Easter Envelope',
      nameEs: 'Sobre de Pascua',
      descriptionEn: 'Special Easter event cards narrating the story of the Passion and Resurrection of Jesus.',
      descriptionEs: 'Cartas especiales del evento de Pascua que narran la historia de la pasión y resurrección de Jesús.',
      pricePoints: 500,
      rarity: 'epic',
      type: 'consumable',
      available: true,
      category: 'special_objects',
      subcategory: 'cartas_biblicas',
      isNew: true,
      metadata: JSON.stringify({
        icon: '✝️',
        consumable: true,
        repeatablePurchase: true,
        cardPack: true,
        eventPack: true,
        eventSet: 'pascua_2026',
        isEventActive: true,
      }),
    },
    create: {
      id: 'pack_pascua',
      type: 'consumable',
      nameEn: 'Easter Envelope',
      nameEs: 'Sobre de Pascua',
      descriptionEn: 'Special Easter event cards narrating the story of the Passion and Resurrection of Jesus.',
      descriptionEs: 'Cartas especiales del evento de Pascua que narran la historia de la pasión y resurrección de Jesús.',
      pricePoints: 500,
      rarity: 'epic',
      assetRef: 'pack_pascua',
      category: 'special_objects',
      subcategory: 'cartas_biblicas',
      isNew: true,
      metadata: JSON.stringify({
        icon: '✝️',
        consumable: true,
        repeatablePurchase: true,
        cardPack: true,
        eventPack: true,
        eventSet: 'pascua_2026',
        isEventActive: true,
      }),
      sortOrder: 10001,
      available: true,
    },
  });
  console.log('  Sobre de Pascua: processed');

  // Seed Sobre de Milagros (milagros 2026 event card pack - 3 cards per pack)
  console.log('Seeding Sobre de Milagros...');
  await prisma.storeItem.upsert({
    where: { id: 'pack_milagros' },
    update: {
      nameEn: 'Miracles Envelope',
      nameEs: 'Sobre de Milagros',
      descriptionEn: 'Contains 3 cards from the Miracles of Jesus collection. Signs and wonders performed by Jesus.',
      descriptionEs: 'Contiene 3 cartas de la colección Milagros de Jesús. Señales y maravillas realizadas por Jesús.',
      pricePoints: 1000,
      rarity: 'epic',
      type: 'consumable',
      available: true,
      category: 'special_objects',
      subcategory: 'cartas_biblicas',
      isNew: true,
      metadata: JSON.stringify({
        icon: '✨',
        consumable: true,
        repeatablePurchase: true,
        cardPack: true,
        eventPack: true,
        eventSet: 'milagros_2026',
        isEventActive: true,
        cardsPerPack: 3,
      }),
    },
    create: {
      id: 'pack_milagros',
      type: 'consumable',
      nameEn: 'Miracles Envelope',
      nameEs: 'Sobre de Milagros',
      descriptionEn: 'Contains 3 cards from the Miracles of Jesus collection. Signs and wonders performed by Jesus.',
      descriptionEs: 'Contiene 3 cartas de la colección Milagros de Jesús. Señales y maravillas realizadas por Jesús.',
      pricePoints: 1000,
      rarity: 'epic',
      assetRef: 'pack_milagros',
      category: 'special_objects',
      subcategory: 'cartas_biblicas',
      isNew: true,
      metadata: JSON.stringify({
        icon: '✨',
        consumable: true,
        repeatablePurchase: true,
        cardPack: true,
        eventPack: true,
        eventSet: 'milagros_2026',
        isEventActive: true,
        cardsPerPack: 3,
      }),
      sortOrder: 10002,
      available: true,
    },
  });
  console.log('  Sobre de Milagros: processed');

  // Seed Sobre de Héroes de la Fe (heroes 2026 event card pack - 3 cards per pack)
  console.log('Seeding Sobre de Héroes de la Fe...');
  await prisma.storeItem.upsert({
    where: { id: 'pack_heroes' },
    update: {
      nameEn: 'Heroes of Faith Pack',
      nameEs: 'Sobre de Héroes de la Fe',
      descriptionEn: 'Contains 3 cards from the Heroes of Faith collection. Legendary figures of the Old Testament.',
      descriptionEs: 'Contiene 3 cartas de la colección Héroes de la Fe. Figuras legendarias del Antiguo Testamento.',
      pricePoints: 1000,
      rarity: 'epic',
      type: 'consumable',
      available: true,
      category: 'special_objects',
      subcategory: 'cartas_biblicas',
      isNew: true,
      metadata: JSON.stringify({
        icon: '⚔️',
        consumable: true,
        repeatablePurchase: true,
        cardPack: true,
        eventPack: true,
        eventSet: 'heroes_2026',
        isEventActive: true,
        cardsPerPack: 3,
      }),
    },
    create: {
      id: 'pack_heroes',
      type: 'consumable',
      nameEn: 'Heroes of Faith Pack',
      nameEs: 'Sobre de Héroes de la Fe',
      descriptionEn: 'Contains 3 cards from the Heroes of Faith collection. Legendary figures of the Old Testament.',
      descriptionEs: 'Contiene 3 cartas de la colección Héroes de la Fe. Figuras legendarias del Antiguo Testamento.',
      pricePoints: 1000,
      rarity: 'epic',
      assetRef: 'pack_heroes',
      category: 'special_objects',
      subcategory: 'cartas_biblicas',
      isNew: true,
      metadata: JSON.stringify({
        icon: '⚔️',
        consumable: true,
        repeatablePurchase: true,
        cardPack: true,
        eventPack: true,
        eventSet: 'heroes_2026',
        isEventActive: true,
        cardsPerPack: 3,
      }),
      sortOrder: 10003,
      available: true,
    },
  });
  console.log('  Sobre de Héroes de la Fe: processed');

  // Summary
  const totalItems = THEMES.length + THEMES_V2.length + THEMES_CHAPTER.length + FRAMES.length + FRAMES_V2.length + FRAMES_CHAPTER.length + MUSIC_TRACKS.length + TITLES.length + TITLES_CHAPTER.length + AVATARS.length + AVATARS_V2.length + AVATARS_L2.length + AVATARS_CHAPTER.length;
  console.log('\n========================================');
  console.log('Store items seed completed!');
  console.log('========================================');
  console.log(`Total items processed: ${totalItems}`);
  console.log(`  - Themes (original): ${THEMES.length}`);
  console.log(`  - Themes V2: ${THEMES_V2.length}`);
  console.log(`  - Themes Chapter: ${THEMES_CHAPTER.length}`);
  console.log(`  - Avatar frames: ${FRAMES.length}`);
  console.log(`  - Music tracks: ${MUSIC_TRACKS.length}`);
  console.log(`  - Spiritual titles: ${TITLES.length}`);
  console.log(`  - Titles Chapter: ${TITLES_CHAPTER.length}`);
  console.log(`  - Premium avatars: ${AVATARS.length}`);
  console.log(`  - Avatars V2: ${AVATARS_V2.length}`);
  console.log(`  - Avatars L2: ${AVATARS_L2.length}`);
  console.log(`  - Avatars Chapter: ${AVATARS_CHAPTER.length}`);
  console.log('----------------------------------------');

  // Verify counts in database
  const dbCounts = await prisma.storeItem.groupBy({
    by: ['type'],
    _count: { id: true },
  });

  console.log('\nDatabase verification:');
  for (const count of dbCounts) {
    console.log(`  - ${count.type}: ${count._count.id} items`);
  }

  const totalInDb = await prisma.storeItem.count();
  console.log(`\nTotal items in database: ${totalInDb}`);
}

// Run the seed only when executed directly (not when imported as a module)
if (import.meta.main) {
  seedStoreItems()
    .then(() => {
      console.log('\nSeed completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding store items:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

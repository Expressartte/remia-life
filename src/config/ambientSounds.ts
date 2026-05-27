// Catálogo de sonidos ambientales para el ritual nocturno de Remia.
//
// Los sonidos se almacenan en Firebase Storage bajo `ambient-sounds/{id}.mp3`.
// ● Naturaleza: generados con ElevenLabs Sound Effects API (Cloud Function).
// ● Ondas binaurales: generados programáticamente con Node.js (script local).
// ● Ruido: generados programáticamente con Node.js (script local).
//
// Se generan una sola vez y se cachean para siempre.

export type AmbientCategory = 'nature' | 'binaural' | 'noise' | 'community';

export interface AmbientSound {
  id: string;
  title: string;
  subtitle: string;
  category: AmbientCategory;
  categoryLabel: string;
  icon: string;          // Ionicons name
  color: string;
  /** Path en Firebase Storage (compartido entre todos los usuarios). */
  storagePath: string;
  /** Prompt de ElevenLabs Sound Effects (solo para naturaleza — usado para generar). */
  elevenLabsPrompt?: string;
  /** Los binaurales requieren auriculares estéreo para funcionar. */
  requiresHeadphones?: boolean;
  /** Solo para sonidos comunitarios — nickname del creador. */
  creatorNickname?: string;
  /** Solo para sonidos comunitarios — uid del creador (para "es mío"). */
  creatorUid?: string;
  /** Marca un sonido como creado por usuarios. */
  isCommunity?: boolean;
}

// ─── Paletas determinísticas para sonidos comunitarios ───────────────────────

const COMMUNITY_COLORS = [
  '#6C8EBF', '#4ECDC4', '#84A98C', '#F4A261', '#56B4D3', '#8D99AE',
  '#C77DFF', '#FFD166', '#FF6B6B', '#E8A0BF', '#A0785A', '#6C63FF',
];
const COMMUNITY_ICONS = [
  'musical-notes-outline', 'pulse-outline', 'flame-outline', 'water-outline',
  'leaf-outline', 'cloud-outline', 'sparkles-outline', 'planet-outline',
  'flash-outline', 'umbrella-outline', 'partly-sunny-outline', 'snow-outline',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickCommunityColor(soundId: string): string {
  return COMMUNITY_COLORS[hashString(soundId) % COMMUNITY_COLORS.length];
}

export function pickCommunityIcon(soundId: string): string {
  return COMMUNITY_ICONS[hashString(soundId + 'icon') % COMMUNITY_ICONS.length];
}

// ─── Timer presets ────────────────────────────────────────────────────────────

export const TIMER_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: 'Toda la noche', minutes: 480 },
] as const;

export type TimerMinutes = (typeof TIMER_OPTIONS)[number]['minutes'];

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export const AMBIENT_SOUNDS: AmbientSound[] = [
  // ── Naturaleza (ElevenLabs Sound Effects) ───────────────────────────────────
  {
    id: 'rain_gentle',
    title: 'Lluvia suave',
    subtitle: 'Gotas de lluvia cayendo sobre un cristal',
    category: 'nature',
    categoryLabel: 'Naturaleza',
    icon: 'rainy-outline',
    color: '#6C8EBF',
    storagePath: 'ambient-sounds/rain_gentle.mp3',
    elevenLabsPrompt: 'Gentle rain falling on a window at night, cozy and warm, soft raindrops, peaceful',
  },
  {
    id: 'ocean_waves',
    title: 'Olas del mar',
    subtitle: 'Olas rompiendo suavemente en la orilla',
    category: 'nature',
    categoryLabel: 'Naturaleza',
    icon: 'water-outline',
    color: '#4ECDC4',
    storagePath: 'ambient-sounds/ocean_waves.mp3',
    elevenLabsPrompt: 'Ocean waves gently breaking on a sandy shore at night, calm and rhythmic, peaceful seashore',
  },
  {
    id: 'forest_night',
    title: 'Bosque nocturno',
    subtitle: 'Grillos y brisa suave entre los árboles',
    category: 'nature',
    categoryLabel: 'Naturaleza',
    icon: 'leaf-outline',
    color: '#84A98C',
    storagePath: 'ambient-sounds/forest_night.mp3',
    elevenLabsPrompt: 'Peaceful forest at night with distant crickets and gentle wind through leaves, serene nature ambient',
  },
  {
    id: 'fireplace',
    title: 'Fogata',
    subtitle: 'Crepitar cálido de leña ardiendo',
    category: 'nature',
    categoryLabel: 'Naturaleza',
    icon: 'flame-outline',
    color: '#F4A261',
    storagePath: 'ambient-sounds/fireplace.mp3',
    elevenLabsPrompt: 'Warm crackling fireplace in a quiet cabin at night, cozy wood fire, gentle pops and crackles',
  },
  {
    id: 'river_stream',
    title: 'Río / arroyo',
    subtitle: 'Agua fluyendo entre piedras',
    category: 'nature',
    categoryLabel: 'Naturaleza',
    icon: 'trail-sign-outline',
    color: '#56B4D3',
    storagePath: 'ambient-sounds/river_stream.mp3',
    elevenLabsPrompt: 'Gentle stream of water flowing over rocks in a quiet forest, peaceful babbling brook, nature ambient',
  },
  {
    id: 'thunder_distant',
    title: 'Tormenta lejana',
    subtitle: 'Truenos distantes con lluvia moderada',
    category: 'nature',
    categoryLabel: 'Naturaleza',
    icon: 'thunderstorm-outline',
    color: '#8D99AE',
    storagePath: 'ambient-sounds/thunder_distant.mp3',
    elevenLabsPrompt: 'Distant thunder with moderate rain, atmospheric storm ambience at night, deep rumbles far away',
  },

  // ── Ondas binaurales (generadas con Node.js) ────────────────────────────────
  {
    id: 'binaural_delta',
    title: 'Delta · 2 Hz',
    subtitle: 'Sueño profundo y reparador',
    category: 'binaural',
    categoryLabel: 'Ondas binaurales',
    icon: 'bed-outline',
    color: '#6C63FF',
    storagePath: 'ambient-sounds/binaural_delta.mp3',
    requiresHeadphones: true,
  },
  {
    id: 'binaural_theta',
    title: 'Theta · 6 Hz',
    subtitle: 'Meditación profunda y creatividad',
    category: 'binaural',
    categoryLabel: 'Ondas binaurales',
    icon: 'eye-outline',
    color: '#C77DFF',
    storagePath: 'ambient-sounds/binaural_theta.mp3',
    requiresHeadphones: true,
  },
  {
    id: 'binaural_alpha',
    title: 'Alpha · 10 Hz',
    subtitle: 'Relajación y calma mental',
    category: 'binaural',
    categoryLabel: 'Ondas binaurales',
    icon: 'sunny-outline',
    color: '#FFD166',
    storagePath: 'ambient-sounds/binaural_alpha.mp3',
    requiresHeadphones: true,
  },
  {
    id: 'binaural_gamma',
    title: 'Gamma · 40 Hz',
    subtitle: 'Lucidez y consciencia expandida',
    category: 'binaural',
    categoryLabel: 'Ondas binaurales',
    icon: 'flash-outline',
    color: '#FF6B6B',
    storagePath: 'ambient-sounds/binaural_gamma.mp3',
    requiresHeadphones: true,
  },

  // ── Ruido (generados con Node.js) ────────────────────────────────────────────
  {
    id: 'noise_pink',
    title: 'Ruido rosa',
    subtitle: 'Concentración profunda y bloqueo de distracciones',
    category: 'noise',
    categoryLabel: 'Ruido',
    icon: 'radio-outline',
    color: '#E8A0BF',
    storagePath: 'ambient-sounds/noise_pink.mp3',
  },
  {
    id: 'noise_brown',
    title: 'Ruido marrón',
    subtitle: 'Suave y envolvente — ideal para dormir',
    category: 'noise',
    categoryLabel: 'Ruido',
    icon: 'volume-low-outline',
    color: '#A0785A',
    storagePath: 'ambient-sounds/noise_brown.mp3',
  },
];

export function getAmbientSoundById(id: string): AmbientSound | undefined {
  return AMBIENT_SOUNDS.find(s => s.id === id);
}

export function getAmbientSoundsByCategory(category: AmbientCategory): AmbientSound[] {
  return AMBIENT_SOUNDS.filter(s => s.category === category);
}

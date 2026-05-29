// Catálogo de sonidos ambientales para el ritual nocturno de Remia.
//
// Los sonidos se almacenan en Firebase Storage bajo `ambient-sounds/{id}.mp3`.
// ● Ondas binaurales: generados programáticamente con Node.js (Cloud Function).
// ● Ruido: generado programáticamente con Node.js (Cloud Function).
//
// Se generan una sola vez y se cachean para siempre.
// (Las categorías "naturaleza" y "comunidad", que usaban ElevenLabs Sound
//  Effects, se removieron al dejar de pagar ElevenLabs — mayo 2026.)

export type AmbientCategory = 'binaural' | 'noise';

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
  /** Los binaurales requieren auriculares estéreo para funcionar. */
  requiresHeadphones?: boolean;
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

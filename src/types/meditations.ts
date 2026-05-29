import { Timestamp } from 'firebase/firestore';

// ─── Catálogo curado de meditaciones YouTube ──────────────────────────────────
//
// Este tipo describe los documentos de la colección global /meditations en
// Firestore. Reemplazó al array estático de TTS (antes en src/config/meditations.ts,
// removido en el cleanup de ElevenLabs).
//
// El catálogo lo curan humanos (ver content/CURATION_GUIDE.md) y se siembra vía
// scripts/seedMeditationsCatalog.js.

export type MeditationCategory =
  | 'sleep'      // body scan, descenso al sueño, cuenta regresiva
  | 'recall'    // intención MILD para recordar sueños
  | 'lucid'     // sueño lúcido, WILD, reality checks guiados
  | 'anxiety'   // respiración 4-7-8, calma para mente acelerada
  | 'gratitude' // cierre del día agradecido
  | 'focus';    // reconexión cuerpo-mente, presencia

/** Contexto desde el que se solicita una recomendación. Mapea a categorías
 *  pero con más resolución (e.g. 'pre_sleep' y 'sleep' pueden coincidir en
 *  categoría pero el ranking interno difiere). */
export type MeditationContext =
  | 'pre_sleep'
  | 'post_dream'
  | 'anxiety'
  | 'recall'
  | 'gratitude'
  | 'focus'
  | 'lucid'
  | 'sleep';

export interface YoutubeMeditation {
  id: string;
  title: string;
  subtitle: string;
  category: MeditationCategory;
  /** Etiqueta humana pre-traducida al español, para evitar mapeo en cliente. */
  categoryLabel: string;
  /** Tags libres para filtrar por mood. P.ej. ['noche', 'tormenta-mental']. */
  mood_tags: string[];
  duration_min: number;
  /** YouTube video ID (11 chars). Validar con /^[A-Za-z0-9_-]{11}$/ antes de seed. */
  youtube_id: string;
  /** True si el curador verificó manualmente que no aparecen ads pre-roll
   *  al ver el video sin Premium. */
  verified_no_ads: boolean;
  /** Código ISO del idioma narrado. Por defecto 'es'. */
  language: string;
  creator: string;
  /** YouTube permite a creadores deshabilitar embeds; comprobar con oEmbed. */
  embed_allowed: boolean;
  /** Marcado por validateMeditationsCatalog CF cuando el video desaparece o
   *  empieza a fallar el embed; el cliente filtra estos del listado. */
  unavailable: boolean;
  last_validated_at: Timestamp | null;
}

// ─── Resultado de una recomendación ───────────────────────────────────────────

export interface MeditationRecommendation {
  meditations: YoutubeMeditation[];
  /** Razón por la que se eligieron — útil para mostrar en la UI o telemetría. */
  reason: string;
}

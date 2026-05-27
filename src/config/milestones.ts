// Fuente única de verdad para los hitos de desbloqueo de insights.
// Consumido por InsightsScreen (para bloqueos) y JournalScreen (para el empty state).

export interface Milestone {
  threshold: number;
  name: string;       // Nombre completo mostrado en Insights / LockedSection
  shortName: string;  // Etiqueta corta para chips en el Diario
  color: string;
}

export const MILESTONES: Milestone[] = [
  { threshold: 7,  name: 'Dream Map',                shortName: 'Dream Map',    color: '#4ECDC4' },
  { threshold: 14, name: 'Hilos Narrativos',         shortName: 'Hilos',        color: '#FFD166' },
  { threshold: 21, name: 'Perfil Arquetípico',       shortName: 'Arquetípico',  color: '#6C63FF' },
  { threshold: 50, name: 'Retrato del Inconsciente', shortName: 'Retrato',      color: '#FF6B6B' },
];

export const DREAM_MAP_THRESHOLD = MILESTONES[0].threshold;
export const THREADS_THRESHOLD   = MILESTONES[1].threshold;
export const ARCHETYPE_THRESHOLD = MILESTONES[2].threshold;
export const PORTRAIT_THRESHOLD  = MILESTONES[3].threshold;

// Devuelve el siguiente hito no alcanzado, o null si están todos desbloqueados.
export function nextMilestone(totalDreams: number): Milestone | null {
  return MILESTONES.find(m => totalDreams < m.threshold) ?? null;
}

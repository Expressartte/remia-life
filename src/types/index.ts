import { FieldValue, Timestamp } from 'firebase/firestore';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type AuthMode = 'login' | 'register';

// ─── Engagement Levels ────────────────────────────────────────────────────────

export type UserLevel = 'novato' | 'explorador' | 'arquitecto' | 'oneironaut';

export interface LevelConfig {
  key: UserLevel;
  label: string;
  subtitle: string;
  minDreams: number;
  maxDreams: number | null; // null = no upper cap
  color: string;
  icon: string;            // Ionicons name
  unlocks: string[];
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    key: 'novato',
    label: 'Soñador Novato',
    subtitle: 'Comenzando el viaje',
    minDreams: 0,
    maxDreams: 6,
    color: '#4ECDC4',
    icon: 'moon-outline',
    unlocks: ['Grabación de sueños', 'Análisis individual'],
  },
  {
    key: 'explorador',
    label: 'Explorador Onírico',
    subtitle: 'Primeros patrones',
    minDreams: 7,
    maxDreams: 20,
    color: '#6C63FF',
    icon: 'git-branch-outline',
    unlocks: ['Dream Map', 'Análisis de patrones'],
  },
  {
    key: 'arquitecto',
    label: 'Arquitecto Mental',
    subtitle: 'Dominio simbólico',
    minDreams: 21,
    maxDreams: 49,
    color: '#FFD166',
    icon: 'person-outline',
    unlocks: ['Perfil arquetípico completo', 'Entrenamiento lúcido'],
  },
  {
    key: 'oneironaut',
    label: 'Oneironaut',
    subtitle: 'Maestría del inconsciente',
    minDreams: 50,
    maxDreams: null,
    color: '#FF6B6B',
    icon: 'eye-outline',
    unlocks: ['Retrato del Inconsciente', 'Análisis predictivo'],
  },
];

// ─── User Document ────────────────────────────────────────────────────────────

export interface UserSettings {
  theme: 'dark' | 'light' | 'system';
  morningReminderEnabled: boolean;
  morningReminderTime: string;
  nightReminderEnabled: boolean;
  nightReminderTime: string;
  socraticQuestionsCount: 1 | 2 | 3;
  analysisDepth: 'brief' | 'standard' | 'deep';
}

export interface UserStreaks {
  morningCurrent: number;
  morningLongest: number;
  nightCurrent: number;
  nightLongest: number;
  lastMorningDate: string;      // YYYY-MM-DD
  lastNightDate: string;        // YYYY-MM-DD
  combinedCurrent: number;
  // Streak freeze mechanic — 1 auto-freeze per week
  morningStreakFreezeAvailable: boolean;
  nightStreakFreezeAvailable: boolean;
  lastFreezeResetWeek: string;  // ISO week, e.g. "2026-W15"
}

export interface UserProfile {
  totalDreams: number;
  totalNightCheckins: number;
  totalAnsweredQuestions: number;  // for clarity index quality component
  stressLevel: 'low' | 'moderate' | 'high' | 'critical';
  currentArchetype: string;
  archetypeHistory: string[];
  dominantEmotionLast30: string;
  topSymbolsLast30: string[];
  insightMilestones: number[];
  nextInsightAt: number;
  // Engagement
  clarityIndex: number;           // composite score 0-100
  currentLevel: UserLevel;
}

export interface UserDocument {
  userId: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  lastActiveAt: Timestamp | FieldValue;
  timezone: string;
  language: string;
  onboardingCompleted: boolean;
  accountStatus: 'active' | 'suspended' | 'deleted';
  settings: UserSettings;
  streaks: UserStreaks;
  profile: UserProfile;
  fcmTokens: string[];
  lastEngagementNotificationDate: string; // YYYY-MM-DD, deduplicates 10 AM cron
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
};

export type MainTabParamList = {
  Morning: undefined;
  Journal: undefined;
  Insights: undefined;
  Night: undefined;
};

export type MorningStackParamList = {
  MorningHome: undefined;
  SocraticDialog: { dreamId: string };
  DreamAnalysis: { dreamId: string };
};

export type JournalStackParamList = {
  JournalHome: undefined;
  DreamAnalysis: { dreamId: string };
};

// ─── Socratic Dialog ──────────────────────────────────────────────────────────

export type QuestionDimension =
  | 'emotion'
  | 'figure'
  | 'symbol'
  | 'waking_connection'
  | 'somatic';

export interface SocraticQuestion {
  id: number;
  question: string;
  dimension: QuestionDimension;
  answer: string | null;
  answeredAt: Timestamp | null;
  answerType: 'text' | 'voice' | null;
}

// ─── Dream Document ───────────────────────────────────────────────────────────

export type DreamStatus =
  | 'recording'
  | 'pending_upload'
  | 'transcribing'
  | 'awaiting_questions'
  | 'answering_questions'
  | 'analyzing'
  | 'complete'
  | 'error';

// ─── Insights: Narrative Threads ──────────────────────────────────────────────

export interface NarrativeThreadEvidence {
  dreamId: string;
  element: string;
}

export interface NarrativeThread {
  title: string;
  description: string;
  evidence: NarrativeThreadEvidence[];
  jungian_compensation: string;
  recommendation: string;
}

export interface NarrativeThreadsDoc {
  threads: NarrativeThread[];
  generatedAt: Timestamp;
  dreamsAnalyzed: number;
}

// ─── Insights: Portrait of the Unconscious ────────────────────────────────────

export interface PortraitSections {
  emotional_pattern: string;
  dominant_archetypes: string;
  active_conflicts: string;
  defense_mechanisms: string;
  psychic_progress: string;
  long_term_recommendations: string;
}

export interface PortraitDoc {
  sections: PortraitSections;
  generatedAt: Timestamp;
  dreamsAnalyzed: number;
}

// ─── Night Ritual ─────────────────────────────────────────────────────────────

export type NightMood = 'great' | 'good' | 'normal' | 'low' | 'difficult';

export interface NightMoodOption {
  key: NightMood;
  emoji: string;
  label: string;
  color: string;
}

export type CapsuleCategory =
  | 'neuroscience'
  | 'neuroplasticity'
  | 'nutrition'
  | 'recall'
  | 'lucid'
  | 'ritual'
  | 'interpretation'
  | 'circadian'
  | 'wellness';

export interface NightCapsule {
  id: string;
  category: CapsuleCategory;
  categoryLabel: string;
  title: string;
  content: string;
  icon: string;
  audioUrl?: string;
}

export interface NightCheckinDoc {
  userId: string;
  date: string;                          // YYYY-MM-DD
  mood: NightMood;
  moodEmoji: string;
  moodLabel: string;
  note: string;
  capsuleId: string;
  meditationCompleted: boolean;
  meditationSeconds: number;
  wbtbEnabled: boolean;
  lucidTrainingEnabled: boolean;
  completedAt: Timestamp | FieldValue;
}

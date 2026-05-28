import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../styles/theme';
import { DreamListItem } from '../../hooks/useDreamList';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMOTION_EMOJIS: Record<string, string> = {
  miedo: '😨',
  angustia: '😰',
  tristeza: '😢',
  alegria: '😊',
  alegría: '😊',
  ansiedad: '😟',
  calma: '😌',
  confusion: '😕',
  confusión: '😕',
  sorpresa: '😮',
  frustracion: '😤',
  frustración: '😤',
  amor: '❤️',
  soledad: '🫥',
  euforia: '🤩',
  culpa: '😞',
  verguenza: '😳',
  vergüenza: '😳',
  esperanza: '🌟',
  nostalgia: '🌙',
  rabia: '😡',
  ira: '😡',
  panico: '😱',
  pánico: '😱',
  curiosidad: '🤔',
  asombro: '😲',
  alivio: '😮‍💨',
  pena: '😢',
  excitacion: '⚡',
  excitación: '⚡',
};

function getEmotionEmoji(emotion: string): string {
  if (!emotion) return '💭';
  const normalized = emotion
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    EMOTION_EMOJIS[normalized] ??
    EMOTION_EMOJIS[emotion.toLowerCase()] ??
    '💭'
  );
}

function intensityColor(intensity: number): string {
  if (intensity >= 0.75) return Colors.error;
  if (intensity >= 0.45) return Colors.warning;
  return Colors.primary;
}

function relativeDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T12:00:00');
    const diff = Math.round(
      (today.getTime() - d.getTime()) / 86400000,
    );

    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    if (diff < 7) return `Hace ${diff} días`;

    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: diff > 365 ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DreamCardProps {
  item: DreamListItem;
  onPress: () => void;
}

export default function DreamCard({ item, onPress }: DreamCardProps) {
  const isCaptured = item.status === 'captured';
  const emoji = getEmotionEmoji(item.dominant_emotion);
  const color = intensityColor(item.emotional_intensity);
  const dateLabel = relativeDate(item.date);
  const title =
    item.dream_title ||
    (isCaptured
      ? 'Sueño guardado'
      : item.dominant_emotion
      ? item.dominant_emotion.charAt(0).toUpperCase() +
        item.dominant_emotion.slice(1)
      : 'Sueño sin título');

  return (
    <TouchableOpacity
      style={[styles.card, isCaptured && styles.cardCaptured]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top row: date + emotion (or "deepen" badge for captured) */}
      <View style={styles.topRow}>
        <Text style={styles.date}>{dateLabel}</Text>
        {isCaptured ? (
          <View style={styles.deepenBadge}>
            <Ionicons name="chatbubbles-outline" size={12} color={Colors.primary} />
            <Text style={styles.deepenBadgeText}>Profundizar</Text>
          </View>
        ) : (
          <View style={styles.emotionBadge}>
            <Text style={styles.emotionEmoji}>{emoji}</Text>
            <Text style={[styles.emotionText, { color }]}>
              {item.dominant_emotion || 'Emoción desconocida'}
            </Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      {/* Archetype + intensity bar (only meaningful for analysed dreams) */}
      {!isCaptured && (
        <View style={styles.midRow}>
          {item.dominant_archetype ? (
            <View style={styles.archetypeBadge}>
              <Text style={styles.archetypeText}>{item.dominant_archetype}</Text>
            </View>
          ) : (
            <View />
          )}

          {/* Intensity bar */}
          <View style={styles.intensityContainer}>
            <View
              style={[
                styles.intensityBar,
                { width: `${Math.round(item.emotional_intensity * 100)}%`, backgroundColor: color },
              ]}
            />
          </View>
        </View>
      )}

      {/* Transcription preview */}
      {item.transcriptionPreview ? (
        <Text style={styles.preview} numberOfLines={isCaptured ? 3 : 2}>
          {item.transcriptionPreview}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  // Subtle visual hint: captured dreams use the primary tint on the border
  // to invite the user to tap and deepen, without making the card noisy.
  cardCaptured: {
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  deepenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  deepenBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.3,
  },
  emotionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emotionEmoji: {
    fontSize: 14,
  },
  emotionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'capitalize',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  archetypeBadge: {
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexShrink: 1,
  },
  archetypeText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    textTransform: 'capitalize',
  },
  intensityContainer: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  intensityBar: {
    height: '100%',
    borderRadius: 2,
  },
  preview: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    lineHeight: 20,
  },
});

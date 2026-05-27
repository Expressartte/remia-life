import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../styles/theme';

// Paleta por sección
const SECTION_META: Record<string, { color: string; emoji: string; previewText: string }> = {
  'Dream Map':           { color: '#4ECDC4', emoji: '🗺️', previewText: 'Verás cómo tus símbolos y emociones se conectan en un mapa interactivo' },
  'Hilos Narrativos':    { color: '#FFD166', emoji: '🧵', previewText: 'Los temas recurrentes de tu inconsciente emergerán como hilos de una historia' },
  'Perfil Arquetípico':  { color: '#6C63FF', emoji: '🪞', previewText: 'Descubre qué arquetipos junguianos dominan tu psique' },
  'Retrato del Inconsciente': { color: '#FF6B6B', emoji: '🌌', previewText: 'Una síntesis completa de tu mundo interior, única e irrepetible' },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface LockedSectionProps {
  sectionName: string;
  dreamThreshold: number;
  totalDreams: number;
  children: React.ReactNode;
}

export default function LockedSection({
  sectionName,
  dreamThreshold,
  totalDreams,
  children,
}: LockedSectionProps) {
  const unlocked = totalDreams >= dreamThreshold;
  const dreamsLeft = Math.max(0, dreamThreshold - totalDreams);
  const progress = Math.min(totalDreams / dreamThreshold, 1);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const meta = SECTION_META[sectionName] ?? {
    color: Colors.primary,
    emoji: '🔒',
    previewText: `Desbloquea con ${dreamThreshold} sueños`,
  };

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      delay: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Shimmer en la barra de progreso
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 0,    useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (unlocked) return <>{children}</>;

  return (
    <View style={styles.wrapper}>
      {/* Card aspiracional — no mostramos el contenido bloqueado */}
      <View style={[styles.card, { borderColor: `${meta.color}30` }]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.emojiCircle, { backgroundColor: `${meta.color}18` }]}>
            <Text style={styles.emoji}>{meta.emoji}</Text>
          </View>
          <View style={styles.lockPill}>
            <Ionicons name="lock-closed" size={11} color={Colors.textTertiary} />
            <Text style={styles.lockPillText}>Bloqueado</Text>
          </View>
        </View>

        {/* Nombre de la sección */}
        <Text style={[styles.sectionTitle, { color: meta.color }]}>{sectionName}</Text>

        {/* Preview text */}
        <Text style={styles.previewText}>{meta.previewText}</Text>

        {/* Barra de progreso */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {totalDreams} / {dreamThreshold} sueños
            </Text>
            <Text style={[styles.dreamsLeftPill, { backgroundColor: `${meta.color}18`, color: meta.color }]}>
              {dreamsLeft === 1 ? '1 sueño más' : `${dreamsLeft} sueños más`}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: meta.color,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
            {/* Shimmer */}
            <Animated.View
              style={[
                styles.shimmer,
                {
                  left: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '90%'],
                  }),
                  opacity: shimmerAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.6, 0],
                  }),
                },
              ]}
            />
          </View>
        </View>

      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emojiCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 26,
  },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockPillText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },
  previewText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  progressSection: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  dreamsLeftPill: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: Radius.full,
  },
});

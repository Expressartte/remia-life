import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius, MIN_TOUCH } from '../../styles/theme';
import { MEDITATIONS, Meditation } from '../../config/meditations';
import { useMeditationPlayer } from '../../hooks/useMeditationPlayer';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Tarjeta de una meditación ─────────────────────────────────────────────────

function MeditationCard({
  meditation,
  onPress,
}: {
  meditation: Meditation;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.cardIcon, { backgroundColor: meditation.color + '22' }]}>
        <Ionicons name={meditation.icon as any} size={24} color={meditation.color} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardCategory}>{meditation.categoryLabel}</Text>
        <Text style={styles.cardTitle}>{meditation.title}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {meditation.subtitle}
        </Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardDuration}>{meditation.durationMinutes}′</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Vista del player ──────────────────────────────────────────────────────────

function PlayerView({
  meditation,
  onBack,
}: {
  meditation: Meditation;
  onBack: () => void;
}) {
  const { state, error, progress, durationMs, positionMs, play, pause, stop } =
    useMeditationPlayer({
      kind: `meditation-${meditation.id}`,
      text: meditation.script,
      provider: 'elevenlabs',
    });

  useEffect(() => {
    return () => {
      stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = state === 'loading';
  const isPlaying = state === 'playing';
  const isPaused = state === 'paused';

  const onMain = () => {
    if (isLoading) return;
    if (isPlaying) pause();
    else play();
  };

  const handleClose = async () => {
    await stop();
    onBack();
  };

  return (
    <View style={styles.playerContainer}>
      {/* Header */}
      <View style={styles.playerHeader}>
        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.playerHeaderTitle}>Meditación</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Hero */}
      <ScrollView
        contentContainerStyle={styles.playerScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.playerIconLarge, { backgroundColor: meditation.color + '22' }]}>
          <Ionicons name={meditation.icon as any} size={56} color={meditation.color} />
        </View>

        <Text style={styles.playerCategory}>{meditation.categoryLabel}</Text>
        <Text style={styles.playerTitle}>{meditation.title}</Text>
        <Text style={styles.playerSubtitle}>{meditation.subtitle}</Text>

        {/* Texto del guión (visible para quien quiera leer) */}
        <View style={styles.scriptBox}>
          <Text style={styles.scriptLabel}>Guión</Text>
          <Text style={styles.scriptText}>{meditation.script}</Text>
        </View>
      </ScrollView>

      {/* Controles fijos abajo */}
      <View style={styles.controlsArea}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, progress * 100)}%`, backgroundColor: meditation.color },
            ]}
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatMs(positionMs)}</Text>
          <Text style={styles.timeText}>
            {durationMs ? `−${formatMs(durationMs - positionMs)}` : '--:--'}
          </Text>
        </View>

        {/* Botón principal */}
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: meditation.color }]}
          onPress={onMain}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color={Colors.textOnPrimary}
            />
          )}
        </TouchableOpacity>

        <Text style={styles.providerHint}>
          {isLoading ? 'Generando audio (primera vez ~10s)…' : 'Voz por ElevenLabs'}
        </Text>

        {error && (
          <Text style={styles.errorText} numberOfLines={3}>
            {error}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export default function MeditationsModal({ visible, onClose }: Props) {
  const [selected, setSelected] = useState<Meditation | null>(null);

  // Reset selección al cerrar
  useEffect(() => {
    if (!visible) setSelected(null);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {selected ? (
          <PlayerView meditation={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerLabel}>Biblioteca</Text>
                <Text style={styles.headerTitle}>Meditaciones guiadas</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={26} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.headerHint}>
              Voz natural generada por IA. La primera vez tarda unos segundos; después es instantánea.
            </Text>

            <ScrollView
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {MEDITATIONS.map(med => (
                <MeditationCard
                  key={med.id}
                  meditation={med}
                  onPress={() => setSelected(med)}
                />
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Library list
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  headerLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.screen,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  list: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 32,
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardCategory: {
    fontSize: 10,
    color: Colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  cardSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDuration: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: FontWeight.semibold,
  },

  // Player
  playerContainer: { flex: 1 },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  playerHeaderTitle: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  playerScroll: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
  },
  playerIconLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.lg,
  },
  playerCategory: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  playerTitle: {
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  playerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    marginHorizontal: Spacing.lg,
  },
  scriptBox: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
  },
  scriptLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  scriptText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  controlsArea: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  progressTrack: {
    height: 4,
    width: '100%',
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 6,
    marginBottom: Spacing.sm,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  providerHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});

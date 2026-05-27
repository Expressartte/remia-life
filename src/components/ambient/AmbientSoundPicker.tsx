import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import {
  AMBIENT_SOUNDS,
  TIMER_OPTIONS,
  AmbientSound,
  AmbientCategory,
  TimerMinutes,
} from '../../config/ambientSounds';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  MIN_TOUCH,
} from '../../styles/theme';
import { AmbientState } from '../../hooks/useAmbientSound';
import { useCommunityAmbientSounds } from '../../hooks/useCommunityAmbientSounds';
import { functions } from '../../services/firebase';
import CreateAmbientSoundModal from './CreateAmbientSoundModal';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  state: AmbientState;
  currentSound: AmbientSound | null;
  timerMinutes: TimerMinutes;
  timerRemaining: number | null;
  onSelect: (sound: AmbientSound, minutes: TimerMinutes) => void;
  onStop: () => void;
  onPreview: (sound: AmbientSound) => void;
  onTimerChange: (minutes: TimerMinutes) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRemaining(ms: number): string {
  const totalSecs = Math.ceil(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CATEGORIES: { key: AmbientCategory; label: string; icon: string }[] = [
  { key: 'nature', label: 'Naturaleza', icon: 'leaf-outline' },
  { key: 'binaural', label: 'Ondas', icon: 'pulse-outline' },
  { key: 'noise', label: 'Ruido', icon: 'radio-outline' },
  { key: 'community', label: 'Comunidad', icon: 'people-outline' },
];

// Confirmación cross-plataforma (Alert.alert en RN no muestra botones en web)
function confirmAsync(title: string, message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

async function handleReport(soundId: string): Promise<void> {
  const ok = await confirmAsync(
    'Reportar este sonido',
    '¿Quieres reportar este sonido? Si recibe varios reportes, se ocultará automáticamente.',
  );
  if (!ok) return;
  try {
    const fn = httpsCallable<{ soundId: string }, { success: boolean; reportCount: number }>(
      functions,
      'reportAmbientSound',
    );
    await fn({ soundId });
    if (Platform.OS === 'web') window.alert('Reporte enviado. Gracias.');
    else Alert.alert('Reporte enviado', 'Gracias por avisarnos.');
  } catch (err: any) {
    console.error('[reportAmbientSound] error:', err);
    const msg = err?.message ?? 'No se pudo enviar el reporte';
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Error', msg);
  }
}

// ─── Tarjeta de sonido ────────────────────────────────────────────────────────

function SoundCard({
  sound,
  isActive,
  isLoading,
  onPress,
  onLongPress,
  onReport,
}: {
  sound: AmbientSound;
  isActive: boolean;
  isLoading: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onReport?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isActive && { borderColor: sound.color, backgroundColor: `${sound.color}12` },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <View style={[styles.cardIcon, { backgroundColor: `${sound.color}22` }]}>
        {isLoading && isActive ? (
          <ActivityIndicator size="small" color={sound.color} />
        ) : (
          <Ionicons name={sound.icon as any} size={22} color={sound.color} />
        )}
      </View>
      <View style={styles.cardBody}>
        <Text
          style={[styles.cardTitle, isActive && { color: sound.color }]}
          numberOfLines={1}
        >
          {sound.title}
        </Text>
        {sound.isCommunity && sound.creatorNickname ? (
          <Text style={styles.cardCreator} numberOfLines={1}>
            por {sound.creatorNickname}
          </Text>
        ) : (
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {sound.subtitle}
          </Text>
        )}
      </View>
      {sound.requiresHeadphones && (
        <Ionicons name="headset-outline" size={14} color={Colors.textTertiary} />
      )}
      {sound.isCommunity && onReport && (
        <TouchableOpacity
          onPress={onReport}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.reportBtn}
        >
          <Ionicons name="flag-outline" size={13} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}
      {isActive && (
        <View style={[styles.activeDot, { backgroundColor: sound.color }]} />
      )}
    </TouchableOpacity>
  );
}

// ─── Mini-player flotante ────────────────────────────────────────────────────

export function AmbientMiniPlayer({
  currentSound,
  state,
  timerRemaining,
  onStop,
}: {
  currentSound: AmbientSound | null;
  state: AmbientState;
  timerRemaining: number | null;
  onStop: () => void;
}) {
  if (!currentSound || state === 'idle') return null;

  return (
    <View style={styles.miniPlayer}>
      <View style={[styles.miniPlayerDot, { backgroundColor: currentSound.color }]} />
      <Ionicons name={currentSound.icon as any} size={16} color={currentSound.color} />
      <View style={styles.miniPlayerBody}>
        <Text style={styles.miniPlayerTitle} numberOfLines={1}>
          {currentSound.title}
        </Text>
        {timerRemaining != null && timerRemaining > 0 && (
          <Text style={styles.miniPlayerTimer}>
            {formatRemaining(timerRemaining)}
          </Text>
        )}
      </View>
      {state === 'loading' ? (
        <ActivityIndicator size="small" color={currentSound.color} />
      ) : (
        <TouchableOpacity
          onPress={onStop}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AmbientSoundPicker({
  state,
  currentSound,
  timerMinutes,
  timerRemaining,
  onSelect,
  onStop,
  onPreview,
  onTimerChange,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<AmbientCategory>('nature');
  const [createOpen, setCreateOpen] = useState(false);
  const { sounds: communitySounds, loading: loadingCommunity } = useCommunityAmbientSounds();

  const filteredSounds = useMemo(() => {
    if (activeCategory === 'community') return communitySounds;
    return AMBIENT_SOUNDS.filter(s => s.category === activeCategory);
  }, [activeCategory, communitySounds]);

  const isPlaying = state === 'playing' || state === 'loading';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="musical-notes-outline" size={18} color={Colors.primary} />
          <Text style={styles.headerTitle}>Sonido de fondo</Text>
        </View>
        {isPlaying && currentSound && (
          <TouchableOpacity onPress={onStop} style={styles.stopBtn}>
            <Ionicons name="stop-circle-outline" size={16} color={Colors.error} />
            <Text style={styles.stopBtnLabel}>Detener</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Now playing */}
      {isPlaying && currentSound && (
        <View style={[styles.nowPlaying, { borderColor: `${currentSound.color}44` }]}>
          <View style={[styles.nowPlayingPulse, { backgroundColor: currentSound.color }]} />
          <Ionicons name={currentSound.icon as any} size={18} color={currentSound.color} />
          <Text style={[styles.nowPlayingTitle, { color: currentSound.color }]}>
            {currentSound.title}
          </Text>
          {timerRemaining != null && timerRemaining > 0 && (
            <Text style={styles.nowPlayingTimer}>{formatRemaining(timerRemaining)}</Text>
          )}
          {state === 'loading' && (
            <ActivityIndicator size="small" color={currentSound.color} />
          )}
        </View>
      )}

      {/* Category tabs */}
      <View style={styles.tabs}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.tab, activeCategory === cat.key && styles.tabActive]}
            onPress={() => setActiveCategory(cat.key)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={cat.icon as any}
              size={14}
              color={activeCategory === cat.key ? Colors.primary : Colors.textTertiary}
            />
            <Text
              style={[
                styles.tabLabel,
                activeCategory === cat.key && styles.tabLabelActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Headphones hint for binaural */}
      {activeCategory === 'binaural' && (
        <View style={styles.headphonesHint}>
          <Ionicons name="headset-outline" size={13} color={Colors.textTertiary} />
          <Text style={styles.headphonesHintText}>
            Las ondas binaurales requieren auriculares estéreo
          </Text>
        </View>
      )}

      {/* Sound grid */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.soundsRow}
      >
        {/* CTA: crear sonido (solo en tab Comunidad) */}
        {activeCategory === 'community' && (
          <TouchableOpacity
            style={styles.createCard}
            onPress={() => setCreateOpen(true)}
            activeOpacity={0.85}
          >
            <View style={styles.createIcon}>
              <Ionicons name="add" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.createLabel}>Crear sonido</Text>
            <Text style={styles.createSubLabel}>con IA</Text>
          </TouchableOpacity>
        )}

        {filteredSounds.map(sound => (
          <SoundCard
            key={sound.id}
            sound={sound}
            isActive={currentSound?.id === sound.id}
            isLoading={state === 'loading' && currentSound?.id === sound.id}
            onPress={() => {
              if (currentSound?.id === sound.id && isPlaying) {
                onStop();
              } else {
                onSelect(sound, timerMinutes);
              }
            }}
            onLongPress={() => onPreview(sound)}
            onReport={sound.isCommunity ? () => handleReport(sound.id) : undefined}
          />
        ))}

        {/* Estado vacío de comunidad */}
        {activeCategory === 'community' && filteredSounds.length === 0 && (
          <View style={styles.emptyCommunity}>
            {loadingCommunity ? (
              <ActivityIndicator size="small" color={Colors.textTertiary} />
            ) : (
              <Text style={styles.emptyCommunityText}>
                Aún no hay sonidos de la comunidad. ¡Crea el primero!
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal de creación */}
      <CreateAmbientSoundModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          // El listener de Firestore actualizará la lista solo. Cambiamos al
          // tab de comunidad para que el usuario vea su nuevo sonido.
          setActiveCategory('community');
        }}
      />

      {/* Timer selector */}
      <View style={styles.timerSection}>
        <Text style={styles.timerLabel}>
          <Ionicons name="timer-outline" size={12} color={Colors.textTertiary} />
          {'  '}Duración del sonido
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timerRow}
        >
          {TIMER_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.minutes}
              style={[
                styles.timerChip,
                timerMinutes === opt.minutes && styles.timerChipActive,
              ]}
              onPress={() => onTimerChange(opt.minutes)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.timerChipLabel,
                  timerMinutes === opt.minutes && styles.timerChipLabelActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: `${Colors.error}15`,
    borderWidth: 1,
    borderColor: `${Colors.error}33`,
  },
  stopBtnLabel: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: FontWeight.medium,
  },

  // Now playing
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
  },
  nowPlayingPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nowPlayingTitle: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  nowPlayingTimer: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    gap: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    borderColor: `${Colors.primary}44`,
    backgroundColor: `${Colors.primary}12`,
  },
  tabLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
  tabLabelActive: {
    color: Colors.primary,
  },

  // Headphones hint
  headphonesHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    backgroundColor: `${Colors.warning}12`,
    borderWidth: 1,
    borderColor: `${Colors.warning}22`,
  },
  headphonesHintText: {
    fontSize: 10,
    color: Colors.textTertiary,
  },

  // Sound cards (horizontal scroll)
  soundsRow: {
    gap: 10,
    paddingVertical: 2,
  },
  card: {
    width: 150,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    gap: 2,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 10,
    color: Colors.textTertiary,
    lineHeight: 14,
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Timer
  timerSection: {
    gap: 6,
  },
  timerLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  timerRow: {
    gap: 6,
  },
  timerChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timerChipActive: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}15`,
  },
  timerChipLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
  timerChipLabelActive: {
    color: Colors.primary,
  },

  // Mini player
  miniPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: Spacing.screen,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniPlayerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniPlayerBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniPlayerTitle: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  miniPlayerTimer: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
});

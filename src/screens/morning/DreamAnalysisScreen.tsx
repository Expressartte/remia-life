import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  Share,
  Dimensions,
  LayoutAnimation,
  UIManager,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import {
  useDreamAnalysis,
  DreamAnalysisData,
  Archetype,
  DreamSymbol,
  FreudianDefense,
  EmotionPhase,
} from '../../hooks/useDreamAnalysis';
import { useDreamSummaryAudio } from '../../hooks/useDreamSummaryAudio';
import SafeScreen from '../../components/common/SafeScreen';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  Shadow,
  MIN_TOUCH,
} from '../../styles/theme';
import { MorningStackParamList } from '../../types';

// ─── Habilitar LayoutAnimation en Android ─────────────────────────────────────
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARCHETYPE_CARD_WIDTH = Math.min(260, SCREEN_WIDTH * 0.7);

// ─── Tipos de navegación ──────────────────────────────────────────────────────
type Props = NativeStackScreenProps<MorningStackParamList, 'DreamAnalysis'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function emotionColor(intensity: number): string {
  if (intensity >= 0.75) return Colors.error;
  if (intensity >= 0.5) return Colors.warning;
  return Colors.primary;
}

const ARCHETYPE_ICONS: { [key: string]: string } = {
  sombra: 'moon',
  anima: 'heart',
  animus: 'thunderstorm-outline',
  mismo: 'infinite-outline',
  héroe: 'shield-outline',
  mentor: 'school-outline',
  embaucador: 'shuffle-outline',
  madre: 'flower-outline',
  padre: 'compass-outline',
  niño: 'star-outline',
  sabio: 'book-outline',
  mago: 'sparkles-outline',
  guerrero: 'flame-outline',
  amante: 'rose-outline',
};

function getArchetypeIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(ARCHETYPE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return 'person-outline';
}

// ─── Hooks utilitarios ────────────────────────────────────────────────────────

/** Cuenta progresivamente de 0 al valor objetivo */
function useCountUp(target: number, duration = 1200, startDelay = 0): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    const timer = setTimeout(() => {
      const steps = 50;
      const interval = duration / steps;
      let step = 0;
      const id = setInterval(() => {
        step += 1;
        setCurrent(Math.round((step / steps) * target));
        if (step >= steps) clearInterval(id);
      }, interval);
      return () => clearInterval(id);
    }, startDelay);
    return () => clearTimeout(timer);
  }, [target, duration, startDelay]);
  return current;
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function ShimmerBlock({
  width = '100%',
  height = 16,
  borderRadius = Radius.sm,
  style,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}) {
  const shimmer = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: Colors.surfaceHighlight, opacity: shimmer },
        style,
      ]}
    />
  );
}

function SkeletonView() {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header skeleton */}
      <View style={styles.headerSection}>
        <ShimmerBlock width={200} height={14} />
        <View style={styles.headerBottom}>
          <ShimmerBlock width={140} height={32} borderRadius={Radius.full} />
          <ShimmerBlock width={80} height={80} borderRadius={40} />
        </View>
      </View>

      {/* Message card skeleton */}
      <View style={[styles.card, { gap: 12, alignItems: 'center' }]}>
        <ShimmerBlock width={48} height={48} borderRadius={24} />
        <ShimmerBlock width={120} height={12} />
        <ShimmerBlock width="100%" height={22} />
        <ShimmerBlock width="85%" height={22} />
        <ShimmerBlock width="60%" height={22} />
        <ShimmerBlock width={130} height={24} borderRadius={Radius.full} />
      </View>

      {/* Emotion card skeleton */}
      <View style={[styles.card, { gap: 12 }]}>
        <ShimmerBlock width={160} height={14} />
        <ShimmerBlock width="100%" height={8} borderRadius={4} />
        <ShimmerBlock width="75%" height={8} borderRadius={4} />
        <ShimmerBlock width="90%" height={8} borderRadius={4} />
      </View>

      {/* Archetype skeleton */}
      <View style={[styles.card, { gap: 12 }]}>
        <ShimmerBlock width={200} height={14} />
        <ShimmerBlock width="100%" height={90} borderRadius={Radius.md} />
      </View>

      {/* Symbols skeleton */}
      <View style={[styles.card, { gap: 12 }]}>
        <ShimmerBlock width={180} height={14} />
        <ShimmerBlock width="100%" height={60} borderRadius={Radius.md} />
        <ShimmerBlock width="100%" height={60} borderRadius={Radius.md} />
      </View>
    </ScrollView>
  );
}

// ─── Progreso circular ────────────────────────────────────────────────────────

function CircularProgress({ value, size = 80 }: { value: number; size?: number }) {
  const strokeWidth = size * 0.1;
  const half = size / 2;
  const pct = Math.min(1, Math.max(0, value));
  const degrees = pct * 360;
  const color = pct >= 0.75 ? Colors.error : pct >= 0.5 ? Colors.warning : Colors.primary;
  const rightRotate = `${Math.min(degrees, 180) - 180}deg`;
  const leftRotate = `${Math.max(0, degrees - 180) - 180}deg`;

  const countUp = useCountUp(Math.round(pct * 100), 1400, 400);

  return (
    <View style={{ width: size, height: size }}>
      {/* Track */}
      <View
        style={{
          position: 'absolute',
          width: size, height: size,
          borderRadius: half,
          borderWidth: strokeWidth,
          borderColor: Colors.surfaceHighlight,
        }}
      />
      {/* Right half (0–180°) */}
      <View style={{ position: 'absolute', width: half, height: size, right: 0, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            width: size, height: size,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: color,
            left: -half,
            transform: [{ rotate: rightRotate }],
          }}
        />
      </View>
      {/* Left half (180–360°) */}
      {degrees > 180 && (
        <View style={{ position: 'absolute', width: half, height: size, left: 0, overflow: 'hidden' }}>
          <View
            style={{
              position: 'absolute',
              width: size, height: size,
              borderRadius: half,
              borderWidth: strokeWidth,
              borderColor: color,
              left: 0,
              transform: [{ rotate: leftRotate }],
            }}
          />
        </View>
      )}
      {/* Center text */}
      <View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color, fontSize: size * 0.18, fontWeight: FontWeight.bold }}>
          {countUp}%
        </Text>
      </View>
    </View>
  );
}

// ─── Componentes de sección ───────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={15} color={Colors.secondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.7 ? Colors.success : value >= 0.4 ? Colors.warning : Colors.error;
  return (
    <View style={[styles.confidenceBadge, { borderColor: color }]}>
      <Ionicons name="analytics-outline" size={11} color={color} />
      <Text style={[styles.confidenceText, { color }]}>Confianza del análisis: {pct}%</Text>
    </View>
  );
}

// ─── SECCIÓN 1: Header ────────────────────────────────────────────────────────

function HeaderSection({
  date,
  analysis,
}: {
  date: string;
  analysis: DreamAnalysisData;
}) {
  const dominantArchetype = analysis.active_archetypes.length > 0
    ? analysis.active_archetypes.reduce((a, b) => (a.relevance > b.relevance ? a : b))
    : null;
  const archetypeIcon = dominantArchetype ? getArchetypeIcon(dominantArchetype.name) : 'moon-outline';

  return (
    <View style={styles.headerSection}>
      <Text style={styles.headerDate}>{formatDate(date)}</Text>
      <View style={styles.headerBottom}>
        {dominantArchetype && (
          <View style={styles.archetypeBadge}>
            <Ionicons name={archetypeIcon as any} size={14} color={Colors.secondary} />
            <Text style={styles.archetypeBadgeText}>{dominantArchetype.name}</Text>
          </View>
        )}
        <CircularProgress value={analysis.emotional_intensity} size={72} />
      </View>
    </View>
  );
}

// ─── Botón "Escuchar resumen" ─────────────────────────────────────────────────

function ListenSummaryButton({
  dreamId,
  analysis,
}: {
  dreamId: string;
  analysis: DreamAnalysisData;
}) {
  const { state, error, progress, play, pause, stop } = useDreamSummaryAudio(dreamId, analysis);

  const isLoading = state === 'loading';
  const isPlaying = state === 'playing';
  const isPaused = state === 'paused';
  const isError = state === 'error';

  const onMainPress = () => {
    if (isLoading) return;
    if (isPlaying) pause();
    else play();
  };

  const label = isLoading
    ? 'Generando audio…'
    : isPlaying
    ? 'Pausar'
    : isPaused
    ? 'Continuar'
    : 'Escuchar resumen';

  const iconName = isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play';

  return (
    <View style={listenStyles.container}>
      <TouchableOpacity
        style={[listenStyles.button, (isPlaying || isPaused) && listenStyles.buttonActive]}
        onPress={onMainPress}
        activeOpacity={0.85}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons name={iconName as any} size={18} color={Colors.primary} />
        )}
        <Text style={listenStyles.label}>{label}</Text>
        {(isPlaying || isPaused) && (
          <TouchableOpacity
            onPress={stop}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={listenStyles.stopBtn}
          >
            <Ionicons name="stop" size={14} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {(isPlaying || isPaused) && (
        <View style={listenStyles.progressTrack}>
          <View style={[listenStyles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
        </View>
      )}

      {isError && error && (
        <Text style={listenStyles.errorText} numberOfLines={2}>
          {error}
        </Text>
      )}
    </View>
  );
}

const listenStyles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.4)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  buttonActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.22)',
  },
  label: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  stopBtn: {
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    borderRadius: 2,
    marginTop: 8,
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: FontSize.xs,
    marginTop: 6,
  },
});

// ─── SECCIÓN 2: Mensaje subconsciente ─────────────────────────────────────────

function SubconsciousCard({ analysis }: { analysis: DreamAnalysisData }) {
  return (
    <LinearGradient
      colors={['rgba(108, 99, 255, 0.18)', 'rgba(232, 213, 183, 0.08)', 'rgba(13,13,26,0)']}
      style={styles.messageCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.messageIconWrap}>
        <Ionicons name="eye-outline" size={22} color={Colors.secondary} />
      </View>
      <Text style={styles.messageLabel}>Tu subconsciente dice…</Text>
      <Text style={styles.messageText}>"{analysis.subconscious_message}"</Text>
      <ConfidenceBadge value={analysis.confidence_level} />
    </LinearGradient>
  );
}

// ─── SECCIÓN 3: Emociones ─────────────────────────────────────────────────────

function AnimatedEmotionBar({
  phase,
  index,
}: {
  phase: EmotionPhase;
  index: number;
}) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const displayPct = useCountUp(Math.round(phase.intensity * 100), 1000, 200 + index * 120);

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: phase.intensity,
      duration: 1000,
      delay: 200 + index * 120,
      useNativeDriver: false,
    }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const barColor = emotionColor(phase.intensity);

  return (
    <View style={styles.emotionBarRow}>
      <View style={styles.emotionBarLabelGroup}>
        <Text style={styles.emotionPhaseName}>{phase.phase}</Text>
        <Text style={styles.emotionPhaseEmotion}>{phase.emotion}</Text>
      </View>
      <View style={styles.emotionBarTrack}>
        <Animated.View
          style={[
            styles.emotionBarFill,
            {
              backgroundColor: barColor,
              width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <Text style={[styles.emotionBarPct, { color: barColor }]}>{displayPct}%</Text>
    </View>
  );
}

function EmotionSection({ analysis }: { analysis: DreamAnalysisData }) {
  return (
    <View style={styles.card}>
      <SectionHeader title="Mapa emocional" icon="pulse-outline" />
      {/* Emoción dominante */}
      <View style={styles.dominantEmotionRow}>
        <View style={[styles.dominantDot, { backgroundColor: emotionColor(analysis.emotional_intensity) }]} />
        <Text style={styles.dominantEmotionText}>{analysis.dominant_emotion}</Text>
        <Text style={styles.dominantIntensityLabel}>intensidad global</Text>
      </View>
      {/* Progresión por fases */}
      {analysis.emotion_progression.length > 0 && (
        <View style={styles.emotionBarsContainer}>
          {analysis.emotion_progression.map((phase, i) => (
            <AnimatedEmotionBar key={i} phase={phase} index={i} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── SECCIÓN 4: Arquetipos (carrusel) ─────────────────────────────────────────

function ArchetypeCard({
  archetype,
  isExpanded,
  onPress,
}: {
  archetype: Archetype;
  isExpanded: boolean;
  onPress: () => void;
}) {
  const icon = getArchetypeIcon(archetype.name);
  const relevancePct = Math.round(archetype.relevance * 100);
  const barColor = archetype.relevance >= 0.7 ? Colors.primary : Colors.secondary;

  return (
    <TouchableOpacity
      style={[styles.archetypeCard, isExpanded && styles.archetypeCardExpanded]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.archetypeCardHeader}>
        <View style={[styles.archetypeIconCircle, { backgroundColor: isExpanded ? Colors.primaryDim : Colors.surfaceHighlight }]}>
          <Ionicons name={icon as any} size={18} color={isExpanded ? Colors.primary : Colors.textSecondary} />
        </View>
        <View style={styles.archetypeCardTitleGroup}>
          <Text style={styles.archetypeCardName}>{archetype.name}</Text>
          <Text style={[styles.archetypeCardRelevance, { color: barColor }]}>{relevancePct}% relevancia</Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.textTertiary}
        />
      </View>
      {/* Barra de relevancia */}
      <View style={styles.archetypeTrack}>
        <View style={[styles.archetypeFill, { width: `${relevancePct}%`, backgroundColor: barColor }]} />
      </View>
      {/* Descripción expandida */}
      {isExpanded && (
        <Text style={styles.archetypeDescription}>{archetype.description}</Text>
      )}
    </TouchableOpacity>
  );
}

function ArchetypeSection({ archetypes }: { archetypes: Archetype[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const sorted = useMemo(
    () => [...archetypes].sort((a, b) => b.relevance - a.relevance),
    [archetypes]
  );

  const handlePress = (index: number) => {
    LayoutAnimation.easeInEaseOut();
    setExpandedIndex(prev => (prev === index ? null : index));
  };

  return (
    <View style={styles.card}>
      <SectionHeader title="Arquetipos junguianos activos" icon="people-outline" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.archetypeScrollContent}
        decelerationRate="fast"
        snapToInterval={ARCHETYPE_CARD_WIDTH + 12}
      >
        {sorted.map((arch, i) => (
          <ArchetypeCard
            key={i}
            archetype={arch}
            isExpanded={expandedIndex === i}
            onPress={() => handlePress(i)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── SECCIÓN 5: Símbolos (acordeón) ──────────────────────────────────────────

function SymbolAccordionItem({
  symbol,
  isExpanded,
  onPress,
}: {
  symbol: DreamSymbol;
  isExpanded: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.symbolItem}>
      <TouchableOpacity
        style={styles.symbolHeader}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.symbolQuoteWrap}>
          <Text style={styles.symbolQuoteMark}>«</Text>
          <Text style={styles.symbolName}>{symbol.symbol}</Text>
          <Text style={styles.symbolQuoteMark}>»</Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.textTertiary}
        />
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.symbolBody}>
          <View style={styles.symbolInterpRow}>
            <View style={[styles.symbolTag, { backgroundColor: Colors.primaryDim }]}>
              <Text style={styles.symbolTagText}>Freud</Text>
            </View>
            <Text style={styles.symbolInterpText}>{symbol.freudian_interpretation}</Text>
          </View>
          <View style={styles.symbolInterpRow}>
            <View style={[styles.symbolTag, { backgroundColor: Colors.secondaryDim }]}>
              <Text style={styles.symbolTagText}>Jung</Text>
            </View>
            <Text style={styles.symbolInterpText}>{symbol.jungian_interpretation}</Text>
          </View>
          <View style={styles.symbolInterpRow}>
            <View style={[styles.symbolTag, { backgroundColor: Colors.successDim }]}>
              <Text style={styles.symbolTagText}>Tuyo</Text>
            </View>
            <Text style={styles.symbolInterpText}>{symbol.personal_interpretation}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function SymbolsSection({ symbols }: { symbols: DreamSymbol[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const handlePress = (index: number) => {
    LayoutAnimation.easeInEaseOut();
    setExpandedIndex(prev => (prev === index ? null : index));
  };

  return (
    <View style={styles.card}>
      <SectionHeader title="Símbolos interpretados" icon="search-outline" />
      {symbols.map((symbol, i) => (
        <SymbolAccordionItem
          key={i}
          symbol={symbol}
          isExpanded={expandedIndex === i}
          onPress={() => handlePress(i)}
        />
      ))}
    </View>
  );
}

// ─── SECCIÓN 6: Mecanismos de defensa ────────────────────────────────────────

function DefenseMechanismsSection({ defenses }: { defenses: FreudianDefense[] }) {
  const [selected, setSelected] = useState<FreudianDefense | null>(null);

  return (
    <View style={styles.card}>
      <SectionHeader title="Mecanismos de defensa" icon="shield-outline" />
      <Text style={styles.defenseHint}>Toca un mecanismo para ver la evidencia en tu sueño</Text>
      <View style={styles.defenseChipsRow}>
        {defenses.map((defense, i) => (
          <TouchableOpacity
            key={i}
            style={styles.defenseChip}
            onPress={() => setSelected(defense)}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-half-outline" size={12} color={Colors.primary} />
            <Text style={styles.defenseChipText}>{defense.mechanism}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Modal de detalle */}
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSelected(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.defenseModal}>
            <View style={styles.defenseModalHeader}>
              <View style={styles.defenseModalIconWrap}>
                <Ionicons name="shield-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.defenseModalTitle}>{selected?.mechanism}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <View style={styles.defenseModalDivider} />
            <Text style={styles.defenseModalLabel}>Evidencia en tu sueño</Text>
            <Text style={styles.defenseModalEvidence}>{selected?.evidence}</Text>
            <LinearGradient
              colors={[Colors.primaryDim, 'rgba(108,99,255,0.05)']}
              style={styles.defenseExplanationCard}
            >
              <Ionicons name="information-circle-outline" size={14} color={Colors.primary} />
              <Text style={styles.defenseExplanationText}>
                Este mecanismo protege al ego de contenidos inconscientes difíciles de integrar conscientemente.
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── SECCIÓN 7: Compensación ──────────────────────────────────────────────────

function CompensationSection({ text }: { text: string }) {
  return (
    <View style={styles.card}>
      <SectionHeader title="Función compensatoria" icon="sync-outline" />
      <Text style={styles.bodyText}>{text}</Text>
    </View>
  );
}

// ─── SECCIÓN 8: Pantalla Mental Silva ────────────────────────────────────────

function SilvaCard({
  recommendation,
  onPractice,
}: {
  recommendation: string;
  onPractice: () => void;
}) {
  return (
    <View style={[styles.card, styles.silvaCard]}>
      <View style={styles.silvaTitleRow}>
        <Ionicons name="tv-outline" size={16} color={Colors.primary} />
        <Text style={styles.silvaSectionTitle}>Ejercicio de Pantalla Mental</Text>
      </View>
      <Text style={styles.silvaSubtitle}>
        Basado en el Método Silva — realízalo esta noche antes de dormir
      </Text>
      <Text style={styles.bodyText}>{recommendation}</Text>
      <TouchableOpacity style={styles.silvaButton} onPress={onPractice} activeOpacity={0.85}>
        <Ionicons name="moon-outline" size={16} color={Colors.textOnPrimary} />
        <Text style={styles.silvaButtonLabel}>Practicar esta noche</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── SECCIÓN 9: Acciones ──────────────────────────────────────────────────────

function ActionsSection({
  analysis,
  dreamId,
  userId,
  date,
}: {
  analysis: DreamAnalysisData;
  dreamId: string;
  userId: string;
  date: string;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `✨ Lo que mi subconsciente me dijo (${formatDate(date)}):\n\n"${analysis.subconscious_message}"\n\n— Analizado con Remia`,
        title: 'Remia — Mensaje de mi subconsciente',
      });
    } catch { /* user cancelled */ }
  }, [analysis.subconscious_message, date]);

  const handleSaveNote = useCallback(async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const dreamRef = doc(db, 'users', userId, 'dreams', dreamId);
      await updateDoc(dreamRef, {
        personalNote: note.trim(),
        personalNoteAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.warn('Error saving note:', e);
    } finally {
      setSaving(false);
    }
  }, [note, userId, dreamId]);

  return (
    <View style={styles.actionsSection}>
      {/* Compartir */}
      <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.85}>
        <Ionicons name="share-outline" size={18} color={Colors.textOnPrimary} />
        <Text style={styles.shareButtonLabel}>Compartir insight</Text>
      </TouchableOpacity>

      {/* Nota personal */}
      <View style={styles.noteCard}>
        <SectionHeader title="Mi reflexión personal" icon="pencil-outline" />
        <TextInput
          style={styles.noteInput}
          placeholder="¿Qué sientes sobre este análisis? ¿Resuena contigo?"
          placeholderTextColor={Colors.textTertiary}
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
          maxLength={600}
        />
        <View style={styles.noteFooter}>
          <Text style={styles.noteCharCount}>{note.length}/600</Text>
          <TouchableOpacity
            style={[styles.noteSaveButton, (!note.trim() || saving) && styles.noteSaveButtonDisabled]}
            onPress={handleSaveNote}
            disabled={!note.trim() || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.textOnPrimary} />
            ) : saved ? (
              <>
                <Ionicons name="checkmark" size={14} color={Colors.textOnPrimary} />
                <Text style={styles.noteSaveLabel}>Guardado</Text>
              </>
            ) : (
              <Text style={styles.noteSaveLabel}>Guardar nota</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Toast de confirmación ────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Vista de análisis completo ───────────────────────────────────────────────

function AnalysisView({
  analysis,
  date,
  dreamId,
  userId,
  onDone,
}: {
  analysis: DreamAnalysisData;
  date: string;
  dreamId: string;
  userId: string;
  onDone: () => void;
}) {
  // Animaciones secuenciales de entrada para cada sección
  const NUM_SECTIONS = 10;
  const fadeAnims = useRef(
    Array.from({ length: NUM_SECTIONS }, () => new Animated.Value(0))
  ).current;
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    Animated.stagger(
      110,
      fadeAnims.map(anim =>
        Animated.timing(anim, { toValue: 1, duration: 550, useNativeDriver: true })
      )
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const section = (i: number, children: React.ReactNode) => (
    <Animated.View
      style={{
        opacity: fadeAnims[i],
        transform: [
          {
            translateY: fadeAnims[i].interpolate({
              inputRange: [0, 1],
              outputRange: [24, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );

  const handlePractice = useCallback(() => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {section(0, <HeaderSection date={date} analysis={analysis} />)}
        {section(0, <ListenSummaryButton dreamId={dreamId} analysis={analysis} />)}
        {section(1, <SubconsciousCard analysis={analysis} />)}
        {section(2, <EmotionSection analysis={analysis} />)}
        {analysis.active_archetypes.length > 0 &&
          section(3, <ArchetypeSection archetypes={analysis.active_archetypes} />)}
        {analysis.symbols.length > 0 &&
          section(4, <SymbolsSection symbols={analysis.symbols} />)}
        {analysis.freudian_defenses.length > 0 &&
          section(5, <DefenseMechanismsSection defenses={analysis.freudian_defenses} />)}
        {section(6, <CompensationSection text={analysis.compensation_analysis} />)}
        {section(7, <SilvaCard recommendation={analysis.mental_screen_recommendation} onPractice={handlePractice} />)}
        {section(8, <ActionsSection analysis={analysis} dreamId={dreamId} userId={userId} date={date} />)}
        {section(9, (
          <TouchableOpacity style={styles.doneButton} onPress={onDone} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.doneButtonLabel}>Entendido, cerrar</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Toast
        message="Ejercicio añadido al ritual de esta noche ✓"
        visible={showToast}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Estado: analizando ───────────────────────────────────────────────────────

function AnalyzingView() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(rotateAnim, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.centeredView}>
      <View style={styles.orbContainer}>
        <Animated.View style={[styles.orbRing, { transform: [{ rotate }] }]} />
        <Animated.View style={[styles.analyzeOrb, { opacity: pulseAnim }]}>
          <Ionicons name="sparkles" size={36} color={Colors.primary} />
        </Animated.View>
      </View>
      <Text style={styles.analyzingTitle}>Interpretando tu sueño</Text>
      <Text style={styles.analyzingSubtitle}>
        La IA está construyendo un análisis psicoanalítico profundo.{'\n'}
        Esto puede tomar hasta un minuto.
      </Text>
      <ActivityIndicator size="small" color={Colors.textTertiary} style={{ marginTop: 12 }} />
    </View>
  );
}

// ─── Pantalla raíz ────────────────────────────────────────────────────────────

export default function DreamAnalysisScreen({ route, navigation }: Props) {
  const { dreamId } = route.params;
  const { user } = useAuth();
  const userId = user?.uid ?? '';
  const { loadState, dream, analysis, errorMessage } = useDreamAnalysis(userId, dreamId);

  // Ocultar tab bar
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    }, [navigation])
  );

  const handleDone = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

  const HeaderBar = (
    <View style={styles.topBar}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
      </TouchableOpacity>
      <View style={styles.topBarCenter}>
        <Text style={styles.topBarTitle}>Análisis onírico</Text>
      </View>
      <View style={styles.backButton} />
    </View>
  );

  // ── Estados de carga y error ───────────────────────────────────────────────

  if (loadState === 'analyzing' || loadState === 'loading') {
    return (
      <SafeScreen>
        {HeaderBar}
        {loadState === 'loading' ? <SkeletonView /> : <AnalyzingView />}
      </SafeScreen>
    );
  }

  if (loadState === 'error') {
    return (
      <SafeScreen>
        {HeaderBar}
        <View style={styles.centeredView}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
          </View>
          <Text style={styles.analyzingTitle}>Error en el análisis</Text>
          <Text style={styles.analyzingSubtitle}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryLabel}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  // Estado 'complete'
  return (
    <SafeScreen noPadding>
      {HeaderBar}
      {analysis && dream && (
        <AnalysisView
          analysis={analysis}
          date={dream.date}
          dreamId={dreamId}
          userId={userId}
          onDone={handleDone}
        />
      )}
    </SafeScreen>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Top bar ────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },

  // ── ScrollView ────────────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 56,
    gap: 14,
  },

  // ── Sección header de pantalla ────────────────────────────────────────────
  headerSection: {
    gap: 12,
    paddingTop: 4,
  },
  headerDate: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textTransform: 'capitalize',
  },
  headerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  archetypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${Colors.secondary}22`,
  },
  archetypeBadgeText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.secondary,
  },

  // ── Card genérica ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.secondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  bodyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },

  // ── Mensaje subconsciente ─────────────────────────────────────────────────
  messageCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: `${Colors.secondary}22`,
    padding: Spacing.lg,
    gap: 12,
    alignItems: 'center',
  },
  messageIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.secondaryDim,
    borderWidth: 1,
    borderColor: `${Colors.secondary}33`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageLabel: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  confidenceText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },

  // ── Emociones ─────────────────────────────────────────────────────────────
  dominantEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dominantDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dominantEmotionText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  dominantIntensityLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  emotionBarsContainer: { gap: 10 },
  emotionBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emotionBarLabelGroup: { width: 100 },
  emotionPhaseName: {
    fontSize: 10,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  emotionPhaseEmotion: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  emotionBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  emotionBarFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  emotionBarPct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    width: 34,
    textAlign: 'right',
  },

  // ── Arquetipos ────────────────────────────────────────────────────────────
  archetypeScrollContent: {
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  archetypeCard: {
    width: ARCHETYPE_CARD_WIDTH,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  archetypeCardExpanded: {
    borderColor: `${Colors.primary}44`,
    backgroundColor: Colors.surfaceHighlight,
  },
  archetypeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  archetypeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archetypeCardTitleGroup: { flex: 1 },
  archetypeCardName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  archetypeCardRelevance: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  archetypeTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  archetypeFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  archetypeDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // ── Símbolos ──────────────────────────────────────────────────────────────
  symbolItem: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  symbolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceElevated,
  },
  symbolQuoteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  symbolQuoteMark: {
    fontSize: FontSize.lg,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  symbolName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  symbolBody: {
    padding: 14,
    gap: 10,
    backgroundColor: Colors.surface,
  },
  symbolInterpRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  symbolTag: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexShrink: 0,
    marginTop: 2,
  },
  symbolTagText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  symbolInterpText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },

  // ── Mecanismos de defensa ─────────────────────────────────────────────────
  defenseHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: -4,
  },
  defenseChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  defenseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: `${Colors.primary}33`,
  },
  defenseChipText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
    padding: Spacing.screen,
  },
  defenseModal: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.md,
  },
  defenseModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  defenseModalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defenseModalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  modalCloseBtn: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defenseModalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: -Spacing.lg,
  },
  defenseModalLabel: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  defenseModalEvidence: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  defenseExplanationCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: Radius.md,
    padding: 12,
  },
  defenseExplanationText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },

  // ── Silva ─────────────────────────────────────────────────────────────────
  silvaCard: {
    borderColor: `${Colors.primary}44`,
    backgroundColor: Colors.primaryDim,
  },
  silvaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  silvaSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  silvaSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: -4,
  },
  silvaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    marginTop: 4,
    ...Shadow.md,
  },
  silvaButtonLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },

  // ── Acciones ──────────────────────────────────────────────────────────────
  actionsSection: { gap: 12 },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 14,
    minHeight: MIN_TOUCH,
  },
  shareButtonLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  noteCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: 10,
  },
  noteInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 90,
    lineHeight: 22,
  },
  noteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteCharCount: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  noteSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
    minWidth: 110,
    justifyContent: 'center',
  },
  noteSaveButtonDisabled: {
    opacity: 0.45,
  },
  noteSaveLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },

  // ── Botón final ───────────────────────────────────────────────────────────
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    minHeight: MIN_TOUCH,
    paddingVertical: 16,
    ...Shadow.md,
  },
  doneButtonLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: `${Colors.success}44`,
    ...Shadow.md,
  },
  toastText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },

  // ── Estado: analizando / error ────────────────────────────────────────────
  centeredView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: Spacing.screen,
  },
  orbContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: `${Colors.primary}44`,
    borderStyle: 'dashed',
  },
  analyzeOrb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: `${Colors.primary}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  analyzingSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  retryButton: {
    minHeight: MIN_TOUCH,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 32,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  retryLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.errorDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
  TextInput,
  KeyboardAvoidingView,
  Dimensions,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import {
  useNightRitual,
  MOOD_OPTIONS,
  buildMeditationPhases,
  MeditationPhase,
  RitualStep,
} from '../../hooks/useNightRitual';
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
import { NightMood, NightCapsule } from '../../types';
import MeditationsModal from '../../components/meditation/MeditationsModal';
import { useRitualNarration } from '../../hooks/useRitualNarration';
import { useAmbientSound } from '../../hooks/useAmbientSound';
import AmbientSoundPicker, { AmbientMiniPlayer } from '../../components/ambient/AmbientSoundPicker';
import { AmbientSound, TimerMinutes } from '../../config/ambientSounds';

// ─── Constantes ───────────────────────────────────────────────────────────────

const { height: SH } = Dimensions.get('window');
const MEDITATION_TOTAL_SECONDS_FULL = 300;  // 5 min (con Silva)
const MEDITATION_TOTAL_SECONDS_SHORT = 180; // 3 min (sin Silva)

const CATEGORY_COLORS: Record<string, string> = {
  neuroscience: Colors.primary,
  neuroplasticity: Colors.success,
  nutrition: '#FFD166',
  recall: Colors.secondary,
  lucid: '#C77DFF',
  ritual: '#F4A261',
  interpretation: '#8D99AE',
  circadian: '#F6BD60',
  wellness: '#84A98C',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Buenas noches, pronto';
  if (h >= 12 && h < 19) return 'Esta noche te espera';
  return 'Es hora de prepararse';
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ─── Hook: timer de meditación ────────────────────────────────────────────────

function useMeditationTimer(totalSeconds: number) {
  const [elapsed, setElapsed] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev >= totalSeconds) {
            clearInterval(intervalRef.current!);
            setIsPlaying(false);
            return totalSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, totalSeconds]);

  const toggle = useCallback(() => {
    if (elapsed >= totalSeconds) return;
    setIsPlaying(p => !p);
  }, [elapsed, totalSeconds]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setElapsed(0);
  }, []);

  const isComplete = elapsed >= totalSeconds;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;

  return { elapsed, isPlaying, toggle, reset, isComplete, progress };
}

// ─── Componente: estrellas de fondo ──────────────────────────────────────────

const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 1 + Math.random() * 2,
  opacity: 0.2 + Math.random() * 0.5,
}));

function StarField() {
  const twinkle = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0.5, duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {STARS.map(s => (
        <Animated.View
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: Colors.textPrimary,
            opacity: Animated.multiply(twinkle, s.opacity),
          }}
        />
      ))}
    </View>
  );
}

// ─── Componente: anillo de onda expansiva ─────────────────────────────────────

function RippleRing({ delay, color, size }: { delay: number; color: string; size: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const animate = () => {
      scale.setValue(1);
      opacity.setValue(0.35);
      Animated.parallel([
        Animated.timing(scale, { toValue: 2.8, duration: 3200, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 3200, delay, useNativeDriver: true }),
      ]).start(() => animate());
    };
    animate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size, height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

// ─── Componente: partícula flotante ───────────────────────────────────────────

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: 5 + Math.random() * 90,
  size: 2 + Math.random() * 5,
  duration: 6000 + Math.random() * 8000,
  delay: Math.random() * 8000,
  opacity: 0.1 + Math.random() * 0.35,
}));

function FloatingParticle({
  x, size, duration, delay, opacity,
}: typeof PARTICLES[0]) {
  const translateY = useRef(new Animated.Value(SH * 0.5)).current;
  const particleOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animate = () => {
      translateY.setValue(SH * 0.6 + Math.random() * 80);
      particleOpacity.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -50, duration, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(particleOpacity, { toValue: opacity, duration: duration * 0.2, useNativeDriver: true }),
            Animated.timing(particleOpacity, { toValue: opacity, duration: duration * 0.6, useNativeDriver: true }),
            Animated.timing(particleOpacity, { toValue: 0, duration: duration * 0.2, useNativeDriver: true }),
          ]),
        ]),
      ]).start(() => animate());
    };
    animate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${x}%`,
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.primary,
        opacity: particleOpacity,
        transform: [{ translateY }],
      }}
    />
  );
}

// ─── Componente: visualizador ambient ────────────────────────────────────────

function AmbientVisualizer({ isPlaying }: { isPlaying: boolean }) {
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0.4)).current;
  const orbLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isPlaying) {
      orbLoop.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(orbScale, { toValue: 1.08, duration: 4000, useNativeDriver: true }),
            Animated.timing(orbOpacity, { toValue: 0.85, duration: 4000, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(orbScale, { toValue: 1, duration: 4000, useNativeDriver: true }),
            Animated.timing(orbOpacity, { toValue: 0.4, duration: 4000, useNativeDriver: true }),
          ]),
        ])
      );
      orbLoop.current.start();
    } else {
      orbLoop.current?.stop();
      Animated.parallel([
        Animated.timing(orbScale, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(orbOpacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]).start();
    }
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.visualizerContainer}>
      {/* Partículas flotantes */}
      {isPlaying && PARTICLES.map(p => (
        <FloatingParticle key={p.id} {...p} />
      ))}
      {/* Ondas expansivas */}
      {isPlaying && (
        <>
          <RippleRing delay={0} color={`${Colors.primary}66`} size={100} />
          <RippleRing delay={1067} color={`${Colors.secondary}44`} size={100} />
          <RippleRing delay={2133} color={`${Colors.primary}44`} size={100} />
        </>
      )}
      {/* Orbe central */}
      <Animated.View
        style={[
          styles.centralOrb,
          { opacity: orbOpacity, transform: [{ scale: orbScale }] },
        ]}
      >
        <Ionicons name="moon" size={40} color={Colors.primary} />
      </Animated.View>
    </View>
  );
}

// ─── Componente: barra de progreso de pasos ────────────────────────────────────

function StepProgressBar({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <View style={styles.progressBar}>
      {[1, 2, 3].map(n => (
        <View key={n} style={styles.progressSegmentWrap}>
          <View
            style={[
              styles.progressSegment,
              n <= currentStep && styles.progressSegmentActive,
              n < currentStep && styles.progressSegmentDone,
            ]}
          />
        </View>
      ))}
    </View>
  );
}

// ─── PASO 1: Check-in emocional ────────────────────────────────────────────────

function CheckInStep({
  mood,
  note,
  onMoodSelect,
  onNoteChange,
  onContinue,
}: {
  mood: NightMood | null;
  note: string;
  onMoodSelect: (m: NightMood) => void;
  onNoteChange: (t: string) => void;
  onContinue: () => void;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.stepContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepHeader}>
          <View style={styles.stepIconBadge}>
            <Ionicons name="heart-outline" size={22} color={Colors.primary} />
          </View>
          <Text style={styles.stepLabel}>Paso 1 de 3</Text>
          <Text style={styles.stepTitle}>¿Cómo fue tu día?</Text>
          <Text style={styles.stepSubtitle}>
            Tu estado emocional enriquece el análisis de tus sueños de mañana.
          </Text>
        </View>

        {/* Emojis de estado */}
        <View style={styles.moodRow}>
          {MOOD_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.moodButton,
                mood === opt.key && { borderColor: opt.color, borderWidth: 2, backgroundColor: `${opt.color}18` },
              ]}
              onPress={() => onMoodSelect(opt.key)}
              activeOpacity={0.75}
            >
              <Text style={styles.moodEmoji}>{opt.emoji}</Text>
              <Text style={[styles.moodLabel, mood === opt.key && { color: opt.color }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Nota opcional */}
        <View style={styles.noteSection}>
          <Text style={styles.noteSectionLabel}>¿Algo importante que quieras registrar?</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Discusión con alguien, buena noticia, evento estresante..."
            placeholderTextColor={Colors.textTertiary}
            value={note}
            onChangeText={onNoteChange}
            multiline
            textAlignVertical="top"
            maxLength={400}
          />
          <Text style={styles.charCount}>{note.length}/400 (opcional)</Text>
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !mood && styles.continueButtonDisabled]}
          onPress={onContinue}
          disabled={!mood}
          activeOpacity={0.85}
        >
          <Text style={styles.continueLabel}>Continuar</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.textOnPrimary} />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── PASO 2: Cápsula educativa ─────────────────────────────────────────────────

function CapsuleStep({
  capsule,
  onComplete,
}: {
  capsule: NightCapsule;
  onComplete: () => void;
}) {
  if (!capsule) return null;
  const catColor = CATEGORY_COLORS[capsule.category] ?? Colors.primary;

  return (
    <ScrollView
      contentContainerStyle={styles.stepContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stepHeader}>
        <View style={[styles.stepIconBadge, { backgroundColor: `${catColor}22` }]}>
          <Ionicons name={capsule.icon as any} size={22} color={catColor} />
        </View>
        <Text style={styles.stepLabel}>Paso 2 de 3</Text>
        <Text style={styles.stepTitle}>Cápsula de conocimiento</Text>
        <Text style={styles.stepSubtitle}>
          60 segundos para entender mejor tu cerebro y tus sueños.
        </Text>
      </View>

      <View style={[styles.capsuleCard, { borderColor: `${catColor}33` }]}>
        {/* Header de categoría */}
        <View style={[styles.capsuleCategoryRow, { backgroundColor: `${catColor}18` }]}>
          <Ionicons name={capsule.icon as any} size={13} color={catColor} />
          <Text style={[styles.capsuleCategoryLabel, { color: catColor }]}>
            {capsule.categoryLabel}
          </Text>
        </View>

        {/* Contenido */}
        <View style={styles.capsuleBody}>
          <Text style={styles.capsuleTitle}>{capsule.title}</Text>
          <Text style={styles.capsuleContent}>{capsule.content}</Text>
        </View>

        {/* Nota de fuente */}
        <View style={styles.capsuleFooter}>
          <Ionicons name="flask-outline" size={12} color={Colors.textTertiary} />
          <Text style={styles.capsuleFooterText}>Remia · Base de conocimiento</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.learnedButton} onPress={onComplete} activeOpacity={0.85}>
        <Ionicons name="checkmark" size={18} color={Colors.textOnPrimary} />
        <Text style={styles.learnedLabel}>Aprendido ✓</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Indicador de fase de meditación ─────────────────────────────────────────

function PhaseIndicator({
  phases,
  progress,
}: {
  phases: MeditationPhase[];
  progress: number;
}) {
  const currentPhase = useMemo(() => {
    return phases.find(p => progress >= p.startPct && progress < p.endPct)
      ?? phases[phases.length - 1];
  }, [phases, progress]);

  return (
    <View style={styles.phaseContainer}>
      {/* Dots de fases */}
      <View style={styles.phaseDots}>
        {phases.map((phase, i) => {
          const isDone = progress >= phase.endPct;
          const isActive = currentPhase.id === phase.id;
          return (
            <React.Fragment key={phase.id}>
              <View style={[
                styles.phaseDot,
                isActive && styles.phaseDotActive,
                isDone && styles.phaseDotDone,
              ]} />
              {i < phases.length - 1 && (
                <View style={[styles.phaseConnector, isDone && styles.phaseConnectorDone]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      {/* Texto de la fase actual */}
      <Text style={styles.phaseName}>{currentPhase.title}</Text>
      <Text style={styles.phaseGuidance}>{currentPhase.guidance}</Text>
    </View>
  );
}

// ─── PASO 3: Meditación ────────────────────────────────────────────────────────

function MeditationStep({
  pendingSilvaText,
  onComplete,
  saving,
}: {
  pendingSilvaText: string | null;
  onComplete: (seconds: number) => void;
  saving: boolean;
}) {
  const totalSeconds = pendingSilvaText
    ? MEDITATION_TOTAL_SECONDS_FULL
    : MEDITATION_TOTAL_SECONDS_SHORT;

  const { elapsed, isPlaying, toggle, isComplete, progress } =
    useMeditationTimer(totalSeconds);

  const phases = useMemo(
    () => buildMeditationPhases(pendingSilvaText !== null),
    [pendingSilvaText]
  );

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  useRitualNarration(phases, progress, voiceEnabled && isPlaying, pendingSilvaText, totalSeconds);

  const remaining = totalSeconds - elapsed;

  // Cuando termina el timer → completar automáticamente
  const completedRef = useRef(false);
  useEffect(() => {
    if (isComplete && !completedRef.current) {
      completedRef.current = true;
      setTimeout(() => onComplete(elapsed), 1000);
    }
  }, [isComplete, elapsed, onComplete]);

  return (
    <View style={[styles.stepContent, { flex: 1, justifyContent: 'space-between', paddingBottom: 32 }]}>
      {/* Visualizador ambient */}
      <AmbientVisualizer isPlaying={isPlaying} />

      {/* Fase actual */}
      <PhaseIndicator phases={phases} progress={progress} />

      {/* Controles del reproductor */}
      <View style={styles.playerArea}>
        {/* Barra de progreso */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {/* Timer */}
        <View style={styles.timerRow}>
          <Text style={styles.timerElapsed}>{formatSeconds(elapsed)}</Text>
          <Text style={styles.timerRemaining}>−{formatSeconds(remaining)}</Text>
        </View>

        {/* Botón play / pause / listo */}
        {isComplete ? (
          <TouchableOpacity
            style={[styles.playButton, styles.donePlayButton]}
            onPress={() => onComplete(elapsed)}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color={Colors.textOnPrimary} />
                <Text style={styles.playButtonLabel}>Ritual completado</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.playButton}
            onPress={toggle}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={Colors.textOnPrimary}
            />
            <Text style={styles.playButtonLabel}>
              {isPlaying ? 'Pausar' : elapsed === 0 ? 'Comenzar meditación' : 'Reanudar'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Toggle de voz guiada */}
        {!isComplete && (
          <TouchableOpacity
            style={[styles.voiceToggle, voiceEnabled && styles.voiceToggleActive]}
            onPress={() => setVoiceEnabled(v => !v)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={voiceEnabled ? 'volume-high' : 'volume-mute-outline'}
              size={16}
              color={voiceEnabled ? Colors.primary : Colors.textTertiary}
            />
            <Text
              style={[
                styles.voiceToggleLabel,
                voiceEnabled && styles.voiceToggleLabelActive,
              ]}
            >
              {voiceEnabled ? 'Voz guiada activa' : 'Activar voz guiada'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Instrucción inicial */}
        {!isPlaying && elapsed === 0 && (
          <Text style={styles.playerHint}>
            Busca una posición cómoda · Cierra los ojos · Respira profundo
          </Text>
        )}

        {/* Saltar si lleva >60s */}
        {elapsed >= 60 && !isComplete && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => onComplete(elapsed)}
            disabled={saving}
          >
            <Text style={styles.skipLabel}>Terminar sesión</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Vista: lobby ─────────────────────────────────────────────────────────────

const LOBBY_STEPS = [
  { icon: 'heart-outline' as const, title: 'Check-in emocional', desc: '¿Cómo fue tu día?', time: '1 min' },
  { icon: 'flask-outline' as const, title: 'Cápsula de neurociencia', desc: 'Aprende sobre el sueño', time: '1 min' },
  { icon: 'moon-outline' as const, title: 'Meditación Silva', desc: 'Programa tu intención onírica', time: '3–5 min' },
];

function LobbyView({
  streakDay,
  loading,
  onBegin,
  onOpenLibrary,
  ambientState,
  ambientCurrentSound,
  ambientTimerMinutes,
  ambientTimerRemaining,
  onAmbientSelect,
  onAmbientStop,
  onAmbientPreview,
  onAmbientTimerChange,
}: {
  streakDay: number;
  loading: boolean;
  onBegin: () => void;
  onOpenLibrary: () => void;
  ambientState: import('../../hooks/useAmbientSound').AmbientState;
  ambientCurrentSound: AmbientSound | null;
  ambientTimerMinutes: TimerMinutes;
  ambientTimerRemaining: number | null;
  onAmbientSelect: (sound: AmbientSound, minutes: TimerMinutes) => void;
  onAmbientStop: () => void;
  onAmbientPreview: (sound: AmbientSound) => void;
  onAmbientTimerChange: (minutes: TimerMinutes) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.lobbyContent} showsVerticalScrollIndicator={false}>
      <StarField />

      {/* Header */}
      <View style={styles.lobbyHeader}>
        <Text style={styles.lobbyGreeting}>{getGreeting()}</Text>
        <Text style={styles.lobbyTitle}>Puerta de la Noche</Text>
        <Text style={styles.lobbySubtitle}>
          Prepara tu mente para soñar con intención
        </Text>
      </View>

      {/* Streak badge */}
      {streakDay > 0 && (
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={16} color="#FF6B35" />
          <Text style={styles.streakText}>
            {streakDay} {streakDay === 1 ? 'noche consecutiva' : 'noches consecutivas'}
          </Text>
        </View>
      )}

      {/* Pasos */}
      <View style={styles.lobbySteps}>
        {LOBBY_STEPS.map((step, i) => (
          <View key={i} style={styles.lobbyStepRow}>
            {i < LOBBY_STEPS.length - 1 && <View style={styles.lobbyConnector} />}
            <View style={styles.lobbyStepIcon}>
              <Ionicons name={step.icon} size={20} color={Colors.primary} />
            </View>
            <View style={styles.lobbyStepBody}>
              <Text style={styles.lobbyStepTitle}>{step.title}</Text>
              <Text style={styles.lobbyStepDesc}>{step.desc}</Text>
            </View>
            <View style={styles.lobbyTimeBadge}>
              <Text style={styles.lobbyTimeText}>{step.time}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Sonido de fondo */}
      <View style={styles.lobbyAmbientSection}>
        <AmbientSoundPicker
          state={ambientState}
          currentSound={ambientCurrentSound}
          timerMinutes={ambientTimerMinutes}
          timerRemaining={ambientTimerRemaining}
          onSelect={onAmbientSelect}
          onStop={onAmbientStop}
          onPreview={onAmbientPreview}
          onTimerChange={onAmbientTimerChange}
        />
      </View>

      {/* CTA */}
      <View style={styles.lobbyCTA}>
        <TouchableOpacity
          style={styles.beginButton}
          onPress={onBegin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="moon" size={18} color={Colors.textOnPrimary} />
              <Text style={styles.beginLabel}>Comenzar ritual</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.lobbyDuration}>~5–7 minutos</Text>

        <TouchableOpacity
          style={styles.libraryButton}
          onPress={onOpenLibrary}
          activeOpacity={0.85}
        >
          <Ionicons name="library-outline" size={18} color={Colors.primary} />
          <Text style={styles.libraryButtonLabel}>Biblioteca de meditaciones</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Vista: completado ────────────────────────────────────────────────────────

const CELEBRATION_STARS = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: 5 + Math.random() * 90,
  y: 5 + Math.random() * 60,
  size: 12 + Math.random() * 14,
  delay: i * 100,
}));

function CelebrationStar({
  x, y, size, delay,
}: typeof CELEBRATION_STARS[0]) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        fontSize: size,
        opacity,
        transform: [{ scale }],
      }}
    >
      ✦
    </Animated.Text>
  );
}

function CompleteView({
  streakDay,
  isAdvanced,
  wbtbEnabled,
  lucidEnabled,
  alreadyDoneToday,
  onWbtbToggle,
  onLucidToggle,
  onDone,
}: {
  streakDay: number;
  isAdvanced: boolean;
  wbtbEnabled: boolean;
  lucidEnabled: boolean;
  alreadyDoneToday: boolean;
  onWbtbToggle: (v: boolean) => void;
  onLucidToggle: (v: boolean) => void;
  onDone: () => void;
}) {
  const titleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(titleAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView contentContainerStyle={styles.completeContent} showsVerticalScrollIndicator={false}>
      <StarField />

      {/* Estrellas de celebración */}
      {!alreadyDoneToday && CELEBRATION_STARS.map(s => (
        <CelebrationStar key={s.id} {...s} />
      ))}

      {/* Orbe luna */}
      <Animated.View style={[styles.completeMoon, { opacity: titleAnim, transform: [{ scale: titleAnim }] }]}>
        <Text style={styles.completeMoonEmoji}>🌙</Text>
      </Animated.View>

      <Animated.View style={{ opacity: titleAnim, alignItems: 'center', gap: 8 }}>
        <Text style={styles.completeTitle}>
          {alreadyDoneToday ? 'Ritual completado hoy' : 'Ritual completado'}
        </Text>
        <Text style={styles.completeSubtitle}>
          {alreadyDoneToday
            ? 'Ya preparaste tu mente esta noche. Dulces sueños.'
            : 'Tu mente está lista para soñar con intención.'}
        </Text>
      </Animated.View>

      {/* Streak */}
      {streakDay > 0 && (
        <View style={styles.completeStreakCard}>
          <Ionicons name="flame" size={20} color="#FF6B35" />
          <Text style={styles.completeStreakNum}>{streakDay}</Text>
          <Text style={styles.completeStreakLabel}>
            {streakDay === 1 ? 'noche' : 'noches'} consecutivas
          </Text>
        </View>
      )}

      {/* Opciones avanzadas — visible solo si streak >= 21 */}
      {isAdvanced && !alreadyDoneToday && (
        <View style={styles.advancedSection}>
          <View style={styles.advancedBadge}>
            <Ionicons name="infinite-outline" size={13} color={Colors.primary} />
            <Text style={styles.advancedBadgeLabel}>Nivel avanzado · 21+ noches</Text>
          </View>
          <Text style={styles.advancedTitle}>Entrenamiento de sueño lúcido</Text>

          {/* WBTB */}
          <View style={styles.advancedOption}>
            <View style={styles.advancedOptionText}>
              <Text style={styles.advancedOptionName}>Protocolo WBTB</Text>
              <Text style={styles.advancedOptionDesc}>
                Alarma silenciosa a las 5h de sueño para entrar en REM consciente.
                Tasa de éxito: 46%.
              </Text>
            </View>
            <Switch
              value={wbtbEnabled}
              onValueChange={onWbtbToggle}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.textOnPrimary}
            />
          </View>

          {/* MILD */}
          <View style={styles.advancedOption}>
            <View style={styles.advancedOptionText}>
              <Text style={styles.advancedOptionName}>Técnica MILD</Text>
              <Text style={styles.advancedOptionDesc}>
                Repite el mantra onírico mientras te duermes y visualiza reconocer que estás soñando.
              </Text>
            </View>
            <Switch
              value={lucidEnabled}
              onValueChange={onLucidToggle}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.textOnPrimary}
            />
          </View>

          {wbtbEnabled && (
            <View style={styles.wbtbNote}>
              <Ionicons name="information-circle-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.wbtbNoteText}>
                Configura una alarma silenciosa en tu reloj a las 5 horas desde ahora para
                practicar el WBTB.
              </Text>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.doneButton} onPress={onDone} activeOpacity={0.85}>
        <Text style={styles.doneLabel}>Dulces sueños</Text>
        <Ionicons name="moon-outline" size={18} color={Colors.textOnPrimary} />
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Pantalla raíz ────────────────────────────────────────────────────────────

export default function NightScreen() {
  const { user } = useAuth();
  const ritual = useNightRitual(user?.uid ?? '');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const ambient = useAmbientSound();

  const {
    step,
    mood,
    note,
    capsule,
    wbtbEnabled,
    lucidEnabled,
    streakDay,
    isAdvanced,
    pendingSilvaText,
    alreadyDoneToday,
    loading,
    saving,
    setMood,
    setNote,
    setWbtbEnabled,
    setLucidEnabled,
    setStep,
    beginRitual,
    completeRitual,
  } = ritual;

  // Animación de transición entre pasos
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const transitionTo = useCallback(
    (nextStep: RitualStep) => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setStep(nextStep);
        Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
      });
    },
    [fadeAnim, setStep]
  );

  const handleCheckinContinue = useCallback(() => transitionTo(2), [transitionTo]);
  const handleCapsuleContinue = useCallback(() => transitionTo(3), [transitionTo]);
  const handleMeditationComplete = useCallback(
    (secs: number) => completeRitual(secs),
    [completeRitual]
  );
  const handleDone = useCallback(() => {
    // Volver al lobby con estado actualizado
    transitionTo('lobby');
  }, [transitionTo]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeScreen noPadding style={styles.safeScreen}>
      {/* Gradiente de fondo nocturno */}
      <LinearGradient
        colors={['#0A0A1A', '#0D0D2A', '#0A0A1A']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Header fijo con progreso (solo durante los 3 pasos) */}
      {(step === 1 || step === 2 || step === 3) && (
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => transitionTo(step === 1 ? 'lobby' : ((step - 1) as RitualStep))}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <StepProgressBar currentStep={step} />
          <View style={styles.backBtn} />
        </View>
      )}

      {/* Contenido con fade */}
      <Animated.View style={[styles.contentArea, { opacity: fadeAnim }]}>
        {step === 'lobby' && (
          <LobbyView
            streakDay={streakDay}
            loading={loading}
            onBegin={beginRitual}
            onOpenLibrary={() => setLibraryOpen(true)}
            ambientState={ambient.state}
            ambientCurrentSound={ambient.currentSound}
            ambientTimerMinutes={ambient.timerMinutes}
            ambientTimerRemaining={ambient.timerRemaining}
            onAmbientSelect={ambient.play}
            onAmbientStop={ambient.stop}
            onAmbientPreview={ambient.preview}
            onAmbientTimerChange={ambient.setTimerMinutes}
          />
        )}

        {step === 1 && (
          <CheckInStep
            mood={mood}
            note={note}
            onMoodSelect={setMood}
            onNoteChange={setNote}
            onContinue={handleCheckinContinue}
          />
        )}

        {step === 2 && capsule && (
          <CapsuleStep
            capsule={capsule}
            onComplete={handleCapsuleContinue}
          />
        )}

        {step === 3 && (
          <MeditationStep
            pendingSilvaText={pendingSilvaText}
            onComplete={handleMeditationComplete}
            saving={saving}
          />
        )}

        {step === 'complete' && (
          <CompleteView
            streakDay={streakDay}
            isAdvanced={isAdvanced}
            wbtbEnabled={wbtbEnabled}
            lucidEnabled={lucidEnabled}
            alreadyDoneToday={alreadyDoneToday}
            onWbtbToggle={setWbtbEnabled}
            onLucidToggle={setLucidEnabled}
            onDone={handleDone}
          />
        )}
      </Animated.View>

      {/* Mini-player de sonido ambient durante los pasos del ritual */}
      {(step === 1 || step === 2 || step === 3 || step === 'complete') && (
        <AmbientMiniPlayer
          currentSound={ambient.currentSound}
          state={ambient.state}
          timerRemaining={ambient.timerRemaining}
          onStop={ambient.stop}
        />
      )}

      {/* Modal de biblioteca de meditaciones (overlay) */}
      <MeditationsModal visible={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </SafeScreen>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeScreen: {
    backgroundColor: '#0A0A1A',
  },

  // ── Layout general ────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentArea: {
    flex: 1,
  },

  // ── Barra de progreso de pasos ────────────────────────────────────────────
  progressBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  progressSegmentWrap: { flex: 1 },
  progressSegment: {
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHighlight,
  },
  progressSegmentActive: {
    backgroundColor: `${Colors.primary}88`,
  },
  progressSegmentDone: {
    backgroundColor: Colors.primary,
  },

  // ── Lobby ────────────────────────────────────────────────────────────────
  lobbyContent: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.xl,
    paddingBottom: 48,
    flexGrow: 1,
  },
  lobbyHeader: {
    marginBottom: Spacing.xl,
    gap: 8,
  },
  lobbyGreeting: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  lobbyTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  lobbySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
    marginBottom: Spacing.xl,
  },
  streakText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#FF6B35',
  },
  lobbySteps: {
    gap: 0,
    flex: 1,
    marginBottom: Spacing.xxl,
  },
  lobbyStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    position: 'relative',
  },
  lobbyConnector: {
    position: 'absolute',
    left: 19,
    top: 52,
    width: 2,
    height: 30,
    backgroundColor: Colors.border,
  },
  lobbyStepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  lobbyStepBody: { flex: 1, gap: 2 },
  lobbyStepTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  lobbyStepDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  lobbyTimeBadge: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  lobbyTimeText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
  lobbyAmbientSection: {
    marginBottom: Spacing.xl,
  },
  lobbyCTA: {
    alignItems: 'center',
    gap: 10,
  },
  beginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    width: '100%',
    minHeight: MIN_TOUCH,
    paddingVertical: 16,
    ...Shadow.glow,
  },
  beginLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
  lobbyDuration: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  libraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: Spacing.lg,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.4)',
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
  },
  libraryButtonLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },

  // ── Pasos 1 y 2: contenido general ───────────────────────────────────────
  stepContent: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.base,
    paddingBottom: 48,
    gap: 20,
    flexGrow: 1,
  },
  stepHeader: {
    gap: 8,
    alignItems: 'flex-start',
  },
  stepIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: FontWeight.semibold,
  },
  stepTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  stepSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // ── Paso 1: mood ──────────────────────────────────────────────────────────
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  moodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  moodEmoji: { fontSize: 26 },
  moodLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  noteSection: { gap: 8 },
  noteSectionLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 100,
    lineHeight: 22,
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    alignSelf: 'flex-end',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    minHeight: MIN_TOUCH,
    paddingVertical: 16,
    marginTop: 4,
    ...Shadow.md,
  },
  continueButtonDisabled: { opacity: 0.4 },
  continueLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },

  // ── Paso 2: cápsula ───────────────────────────────────────────────────────
  capsuleCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  capsuleCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  capsuleCategoryLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  capsuleBody: {
    padding: Spacing.base,
    gap: 10,
  },
  capsuleTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  capsuleContent: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 26,
  },
  capsuleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  capsuleFooterText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  learnedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.success,
    borderRadius: Radius.lg,
    minHeight: MIN_TOUCH,
    paddingVertical: 16,
  },
  learnedLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },

  // ── Paso 3: meditación ───────────────────────────────────────────────────
  visualizerContainer: {
    height: SH * 0.38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centralOrb: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: `${Colors.primary}55`,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.glow,
  },
  phaseContainer: {
    paddingHorizontal: Spacing.screen,
    alignItems: 'center',
    gap: 10,
  },
  phaseDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  phaseDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  phaseDotActive: {
    width: 12, height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  phaseDotDone: {
    backgroundColor: Colors.success,
  },
  phaseConnector: {
    width: 28, height: 2,
    backgroundColor: Colors.border,
  },
  phaseConnectorDone: {
    backgroundColor: Colors.success,
  },
  phaseName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  phaseGuidance: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
    fontStyle: 'italic',
  },
  playerArea: {
    paddingHorizontal: Spacing.screen,
    gap: 12,
    paddingBottom: 8,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timerElapsed: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  timerRemaining: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    minHeight: MIN_TOUCH,
    paddingVertical: 16,
    ...Shadow.glow,
  },
  donePlayButton: {
    backgroundColor: Colors.success,
  },
  playButtonLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
  playerHint: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipLabel: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignSelf: 'center',
  },
  voiceToggleActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  voiceToggleLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.semibold,
  },
  voiceToggleLabelActive: {
    color: Colors.primary,
  },

  // ── Complete ──────────────────────────────────────────────────────────────
  completeContent: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.xxl,
    paddingBottom: 56,
    alignItems: 'center',
    gap: 24,
    flexGrow: 1,
  },
  completeMoon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: `${Colors.primary}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeMoonEmoji: { fontSize: 48 },
  completeTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  completeSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  completeStreakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
    borderRadius: Radius.lg,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.25)',
  },
  completeStreakNum: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    color: '#FF6B35',
  },
  completeStreakLabel: {
    fontSize: FontSize.md,
    color: '#FF6B35',
    fontWeight: FontWeight.medium,
  },

  // ── Avanzado ──────────────────────────────────────────────────────────────
  advancedSection: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: `${Colors.primary}33`,
    padding: Spacing.base,
    gap: 14,
  },
  advancedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  advancedBadgeLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  advancedTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginTop: -4,
  },
  advancedOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  advancedOptionText: { flex: 1, gap: 3 },
  advancedOptionName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  advancedOptionDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  wbtbNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: 12,
  },
  wbtbNoteText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    lineHeight: 18,
    flex: 1,
  },

  // ── Botón final ───────────────────────────────────────────────────────────
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    width: '100%',
    minHeight: MIN_TOUCH,
    paddingVertical: 16,
    ...Shadow.glow,
  },
  doneLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
});

import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NeonIcon from '../../components/icons/NeonIcon';
import { PulseIcon } from '../../components/icons/MysticalIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useAudioUpload } from '../../hooks/useAudioUpload';
import WaveformVisualizer from '../../components/audio/WaveformVisualizer';
import AudioPreview from '../../components/audio/AudioPreview';
import SafeScreen from '../../components/common/SafeScreen';
import { MorningStackParamList, DreamStatus } from '../../types';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  Shadow,
  MIN_TOUCH,
} from '../../styles/theme';

// ─── Utilidades ───────────────────────────────────────────────────────────────

const formatTimer = (secs: number): string => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// ─── Sub-componentes de estado ────────────────────────────────────────────────

interface IdleViewProps {
  onStart: () => void;
  onWriteInstead: () => void;
}
function IdleView({ onStart, onWriteInstead }: IdleViewProps) {
  const [isHovered, setIsHovered] = useState(false);
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.92, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: isHovered ? 1.05 : 1, useNativeDriver: true }).start();
  };

  const handleHoverIn = () => {
    setIsHovered(true);
    Animated.spring(scale, { toValue: 1.05, useNativeDriver: true }).start();
  };

  const handleHoverOut = () => {
    setIsHovered(false);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <View style={styles.idleContainer}>
      {/* Aura exterior */}
      <View style={styles.auraOuter}>
        <View style={styles.auraInner}>
          {/* Botón principal animado */}
          <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
              style={styles.recordButton}
              onPress={onStart}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              {...Platform.select({
                web: {
                  onHoverIn: handleHoverIn,
                  onHoverOut: handleHoverOut,
                },
              })}
            >
              <NeonIcon 
                size={108} 
                glowColor={isHovered ? '#BD00FF' : Colors.primary}
              >
                <PulseIcon 
                  size={64} 
                  gradientColors={
                    isHovered ? ['#BD00FF', '#FF00A0'] : ['#6C63FF', '#00F0FF']
                  } 
                />
              </NeonIcon>
            </Pressable>
          </Animated.View>
        </View>
      </View>
      <Text style={[styles.recordCTA, isHovered && { color: '#BD00FF' }]}>Cuéntame tu sueño</Text>
      <Text style={styles.recordHint}>Toca para comenzar</Text>

      <TouchableOpacity
        style={styles.writeInsteadLink}
        onPress={onWriteInstead}
        activeOpacity={0.7}
      >
        <Ionicons name="create-outline" size={14} color={Colors.textTertiary} />
        <Text style={styles.writeInsteadText}>Prefiero escribirlo</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Vista: captura de sueño por texto ────────────────────────────────────────

const MIN_TEXT_LENGTH = 30;

interface TextEntryViewProps {
  onCancel: () => void;
  onSubmit: (text: string) => Promise<void>;
  submitting: boolean;
}
function TextEntryView({ onCancel, onSubmit, submitting }: TextEntryViewProps) {
  const [text, setText] = useState('');
  const trimmedLength = text.trim().length;
  const canSubmit = trimmedLength >= MIN_TEXT_LENGTH && !submitting;

  return (
    <View style={styles.textEntryContainer}>
      <Text style={styles.textEntryEyebrow}>MODO TEXTO</Text>
      <Text style={styles.textEntryTitle}>Escribe tu sueño</Text>
      <Text style={styles.textEntryHint}>
        Cuéntalo en primera persona y con el detalle que recuerdes.
      </Text>

      <TextInput
        style={styles.textEntryInput}
        value={text}
        onChangeText={setText}
        placeholder="Anoche soñé que…"
        placeholderTextColor={Colors.textTertiary}
        multiline
        textAlignVertical="top"
        autoCorrect
        editable={!submitting}
      />

      <Text
        style={[
          styles.textEntryCounter,
          trimmedLength < MIN_TEXT_LENGTH && styles.textEntryCounterShort,
        ]}
      >
        {trimmedLength < MIN_TEXT_LENGTH
          ? `Mínimo ${MIN_TEXT_LENGTH} caracteres (${trimmedLength}/${MIN_TEXT_LENGTH})`
          : `${trimmedLength} caracteres`}
      </Text>

      <View style={styles.textEntryActions}>
        <TouchableOpacity
          style={styles.textEntryCancel}
          onPress={onCancel}
          disabled={submitting}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
          <Text style={styles.textEntryCancelText}>Volver al audio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.textEntrySubmit,
            !canSubmit && styles.textEntrySubmitDisabled,
          ]}
          onPress={() => onSubmit(text.trim())}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color={Colors.textOnPrimary} />
              <Text style={styles.textEntrySubmitText}>Guardar sueño</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface RecordingViewProps {
  meteringBuffer: number[];
  durationSecs: number;
  isPaused: boolean;
  warning: string | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}
function RecordingView({
  meteringBuffer,
  durationSecs,
  isPaused,
  warning,
  onPause,
  onResume,
  onStop,
}: RecordingViewProps) {
  return (
    <View style={styles.recordingContainer}>
      {/* Aviso de tiempo */}
      {warning && (
        <View style={styles.warningBanner}>
          <Ionicons name="time-outline" size={14} color={Colors.warning} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      )}

      {/* Aviso de pausa automática */}
      {isPaused && (
        <View style={styles.pausedBanner}>
          <Ionicons name="pause-circle" size={14} color={Colors.secondary} />
          <Text style={styles.pausedText}>
            Grabación pausada · La app pasó a segundo plano
          </Text>
        </View>
      )}

      {/* Waveform */}
      <View style={styles.waveformArea}>
        <WaveformVisualizer
          meteringBuffer={meteringBuffer}
          isActive={!isPaused}
          height={72}
        />
      </View>

      {/* Timer */}
      <Text style={[styles.timer, isPaused && styles.timerPaused]}>
        {formatTimer(durationSecs)}
      </Text>
      <Text style={styles.timerLabel}>
        {isPaused ? 'pausado' : 'grabando'}
      </Text>

      {/* Controles */}
      <View style={styles.controls}>
        {/* Pausar / Reanudar */}
        <TouchableOpacity
          style={styles.controlSecondary}
          onPress={isPaused ? onResume : onPause}
          activeOpacity={0.75}
        >
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={22}
            color={Colors.textSecondary}
          />
          <Text style={styles.controlSecondaryLabel}>
            {isPaused ? 'Reanudar' : 'Pausar'}
          </Text>
        </TouchableOpacity>

        {/* Terminar */}
        <TouchableOpacity
          style={styles.controlPrimary}
          onPress={onStop}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={26} color={Colors.textOnPrimary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.stopHint}>Toca ✓ para terminar</Text>
    </View>
  );
}

interface UploadingViewProps {
  progress: number;
  isOffline: boolean;
}
function UploadingView({ progress, isOffline }: UploadingViewProps) {
  return (
    <View style={styles.uploadingContainer}>
      {isOffline ? (
        <>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.secondary} />
          <Text style={styles.uploadingTitle}>Sin conexión</Text>
          <Text style={styles.uploadingSubtitle}>
            Tu sueño está guardado localmente.{'\n'}
            Se sincronizará cuando recuperes internet.
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="cloud-upload-outline" size={48} color={Colors.primary} />
          <Text style={styles.uploadingTitle}>Guardando tu sueño</Text>
          <View style={styles.uploadBar}>
            <View
              style={[
                styles.uploadBarFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.uploadingPct}>{Math.round(progress * 100)}%</Text>
          <Text style={styles.uploadingSubtitle}>
            En un momento podrás ver tu análisis
          </Text>
        </>
      )}
    </View>
  );
}

interface DoneViewProps {
  dreamId: string;
  dreamStatus: DreamStatus | null;
  onStartDialog: () => void;
}
function DoneView({ dreamId, dreamStatus, onStartDialog }: DoneViewProps) {
  const isReady =
    dreamStatus === 'awaiting_questions' || dreamStatus === 'answering_questions';

  return (
    <View style={styles.doneContainer}>
      <View style={styles.doneIconWrap}>
        <Ionicons name="checkmark-circle" size={56} color={Colors.success} />
      </View>
      <Text style={styles.doneTitle}>¡Sueño capturado!</Text>
      <Text style={styles.doneSubtitle}>
        {isReady
          ? 'La transcripción está lista. Responde unas preguntas para profundizar en tu sueño.'
          : 'Remia está transcribiendo tu relato. Esto puede tomar un momento.'}
      </Text>

      {isReady ? (
        <TouchableOpacity
          style={styles.startDialogButton}
          onPress={onStartDialog}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={Colors.textOnPrimary} />
          <Text style={styles.startDialogLabel}>Comenzar entrevista</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.doneInfoPill}>
          <Ionicons name="hourglass-outline" size={14} color={Colors.secondary} />
          <Text style={styles.doneInfoText}>Transcribiendo...</Text>
        </View>
      )}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function MorningScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<MorningStackParamList, 'MorningHome'>>();

  const recorder = useAudioRecorder();
  const uploader = useAudioUpload();

  // Modo de captura: 'voice' (por defecto) o 'text' (sueño escrito)
  const [captureMode, setCaptureMode] = useState<'voice' | 'text'>('voice');
  const [submittingText, setSubmittingText] = useState(false);

  // ── Listener de estado del sueño (para saber cuándo la transcripción termina) ──

  const [dreamStatus, setDreamStatus] = useState<DreamStatus | null>(null);

  useEffect(() => {
    if (!uploader.dreamId || !user) {
      setDreamStatus(null);
      return;
    }
    const dreamRef = doc(db, 'users', user.uid, 'dreams', uploader.dreamId);
    const unsub = onSnapshot(dreamRef, (snap) => {
      if (snap.exists()) setDreamStatus(snap.data().status as DreamStatus);
    });
    return unsub;
  }, [uploader.dreamId, user]);

  // ── Confirmar y subir audio ────────────────────────────────────────────────

  const handleConfirmUpload = useCallback(async () => {
    if (!recorder.audioUri || !user) return;

    await uploader.uploadAudio({
      audioUri: recorder.audioUri,
      userId: user.uid,
      durationSecs: recorder.durationSecs,
    });
  }, [recorder.audioUri, recorder.durationSecs, user, uploader]);

  // ── Descartar y volver a idle ──────────────────────────────────────────────

  const handleDiscard = useCallback(() => {
    Alert.alert(
      'Descartar grabación',
      '¿Seguro que quieres eliminar esta grabación y volver a empezar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            recorder.discardRecording();
            uploader.reset();
          },
        },
      ]
    );
  }, [recorder, uploader]);

  // ── Grabar de nuevo después de un error ───────────────────────────────────

  const handleRetryFromError = useCallback(() => {
    recorder.discardRecording();
    uploader.reset();
  }, [recorder, uploader]);

  // ── Guardar sueño escrito a mano (sin audio) ──────────────────────────────

  const handleSubmitTextDream = useCallback(
    async (text: string) => {
      if (!user) return;
      setSubmittingText(true);
      try {
        const dreamsRef = collection(db, 'users', user.uid, 'dreams');
        const docRef = await addDoc(dreamsRef, {
          userId: user.uid,
          date: new Date().toISOString().slice(0, 10),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'awaiting_questions',
          transcription: {
            text,
            language: 'es',
            source: 'text_input',
            transcribedAt: serverTimestamp(),
          },
        });
        navigation.navigate('SocraticDialog', { dreamId: docRef.id });
        setCaptureMode('voice'); // reset para la próxima vez
      } catch (err: any) {
        console.error('[MorningScreen] text dream save error', err);
        Alert.alert(
          'No se pudo guardar',
          err?.message ?? 'Inténtalo de nuevo en un momento.',
        );
      } finally {
        setSubmittingText(false);
      }
    },
    [user, navigation],
  );

  // ── Decidir qué vista renderizar ──────────────────────────────────────────

  const renderContent = () => {
    // Error de grabación
    if (recorder.state === 'error') {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="mic-off-outline" size={48} color={Colors.error} />
          <Text style={styles.errorTitle}>No se pudo grabar</Text>
          <Text style={styles.errorBody}>{recorder.errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetryFromError}
          >
            <Text style={styles.retryLabel}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Error de subida
    if (uploader.uploadState === 'error') {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.error} />
          <Text style={styles.errorTitle}>Error al guardar</Text>
          <Text style={styles.errorBody}>
            No se pudo subir el audio. Tu grabación sigue disponible.
          </Text>
          {uploader.errorMessage && (
            <Text selectable style={[styles.errorBody, { fontSize: 12, opacity: 0.7, marginTop: 8 }]}>
              {uploader.errorMessage}
            </Text>
          )}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleConfirmUpload}
          >
            <Text style={styles.retryLabel}>Reintentar subida</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDiscard} style={styles.discardLink}>
            <Text style={styles.discardLinkText}>Descartar grabación</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Subida completada
    if (uploader.uploadState === 'done' && uploader.dreamId) {
      return (
        <DoneView
          dreamId={uploader.dreamId}
          dreamStatus={dreamStatus}
          onStartDialog={() => {
            navigation.navigate('SocraticDialog', { dreamId: uploader.dreamId! });
          }}
        />
      );
    }

    // Subiendo (o guardado offline)
    if (
      uploader.uploadState === 'uploading' ||
      uploader.uploadState === 'creating_doc' ||
      uploader.uploadState === 'offline'
    ) {
      return (
        <UploadingView
          progress={uploader.progress}
          isOffline={uploader.uploadState === 'offline'}
        />
      );
    }

    // Preview post-grabación
    if (recorder.state === 'preview' && recorder.audioUri) {
      return (
        <AudioPreview
          audioUri={recorder.audioUri}
          recordedDurationSecs={recorder.durationSecs}
          onConfirm={handleConfirmUpload}
          onDiscard={handleDiscard}
          isUploading={false}
          uploadProgress={uploader.progress}
        />
      );
    }

    // Grabando o en pausa
    if (recorder.state === 'recording' || recorder.state === 'paused') {
      return (
        <RecordingView
          meteringBuffer={recorder.meteringBuffer}
          durationSecs={recorder.durationSecs}
          isPaused={recorder.state === 'paused'}
          warning={recorder.warning}
          onPause={recorder.pauseRecording}
          onResume={recorder.resumeRecording}
          onStop={recorder.stopRecording}
        />
      );
    }

    // Modo texto: escribir el sueño directamente
    if (captureMode === 'text') {
      return (
        <TextEntryView
          onCancel={() => setCaptureMode('voice')}
          onSubmit={handleSubmitTextDream}
          submitting={submittingText}
        />
      );
    }

    // Idle (estado inicial) o solicitando permisos
    return (
      <IdleView
        onStart={recorder.startRecording}
        onWriteInstead={() => setCaptureMode('text')}
      />
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Idle visual: recorder libre Y modo voz. En modo texto el input usa todo el espacio.
  const isVoiceIdle =
    (recorder.state === 'idle' || recorder.state === 'requesting') &&
    captureMode === 'voice';

  return (
    <SafeScreen noPadding>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header — se contrae cuando no es idle para dar espacio al visualizador */}
        {isVoiceIdle && (() => {
          const greeting = getTimeGreeting();
          return (
            <View style={styles.header}>
              <Text style={styles.headerEyebrow}>Puerta de la Mañana</Text>
              <Text style={styles.headerTitle}>{greeting.title}</Text>
              <Text style={styles.headerSubtitle}>{greeting.subtitle}</Text>
            </View>
          );
        })()}

        {/* Contenido central */}
        <View style={[styles.content, isVoiceIdle && styles.contentCentered]}>
          {renderContent()}
        </View>
      </ScrollView>
    </SafeScreen>
  );
}

// ─── Saludo dinámico ──────────────────────────────────────────────────────────

// El eyebrow siempre dice "Puerta de la Mañana", así que el título y subtítulo
// reconocen el momento del día en lugar de chocar con un "Buenas tardes".

function getTimeGreeting(): { title: string; subtitle: string } {
  const h = new Date().getHours();
  if (h < 5) {
    return {
      title: 'La noche aún despierta',
      subtitle: 'Captura cualquier sueño antes de que se desvanezca.',
    };
  }
  if (h < 12) {
    return {
      title: 'Buenos días',
      subtitle: 'Habla libremente. Remia escucha.',
    };
  }
  return {
    title: 'La mañana ya pasó',
    subtitle: 'Captura lo que aún recuerdes — cuenta igual.',
  };
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screen,
    paddingBottom: 40,
  },

  // Header
  header: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: 6,
  },
  headerEyebrow: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Content
  content: {
    flex: 1,
  },
  contentCentered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── IDLE ─────────────────────────────────────────────────────────────────

  idleContainer: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: Spacing.xxl,
  },
  auraOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auraInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: `${Colors.primary}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // En web LinearGradient recorta los iconos SVG — usamos color sólido
  recordButtonWeb: {
    backgroundColor: Colors.primary,
    borderRadius: 54,
  },
  recordCTA: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  recordHint: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  writeInsteadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.lg,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  writeInsteadText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },

  // ── TEXT ENTRY ────────────────────────────────────────────────────────────

  textEntryContainer: {
    flex: 1,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.screen,
    gap: Spacing.sm,
  },
  textEntryEyebrow: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
  },
  textEntryTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  textEntryHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  textEntryInput: {
    minHeight: 220,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.base,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  textEntryCounter: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  textEntryCounterShort: {
    color: Colors.warning,
  },
  textEntryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  textEntryCancel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  textEntryCancelText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  textEntrySubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radius.full,
    minHeight: MIN_TOUCH,
  },
  textEntrySubmitDisabled: {
    opacity: 0.5,
  },
  textEntrySubmitText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },

  // ── RECORDING ─────────────────────────────────────────────────────────────

  recordingContainer: {
    flex: 1,
    paddingTop: Spacing.xl,
    alignItems: 'center',
    gap: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.warning}22`,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${Colors.warning}44`,
  },
  warningText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: FontWeight.medium,
  },
  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${Colors.secondary}33`,
  },
  pausedText: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontWeight: FontWeight.medium,
  },
  waveformArea: {
    width: '100%',
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  timerPaused: {
    color: Colors.textSecondary,
  },
  timerLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: -8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: Spacing.lg,
  },
  controlSecondary: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  controlSecondaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  controlPrimary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  stopHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },

  // ── UPLOADING ─────────────────────────────────────────────────────────────

  uploadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: Spacing.xxxl,
  },
  uploadingTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  uploadBar: {
    width: '70%',
    height: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  uploadBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  uploadingPct: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    marginTop: -8,
  },
  uploadingSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── DONE ──────────────────────────────────────────────────────────────────

  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: Spacing.xxxl,
  },
  doneIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.successDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  startDialogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  startDialogLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
  doneInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.secondaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${Colors.secondary}33`,
    marginTop: 8,
  },
  doneInfoText: {
    fontSize: FontSize.sm,
    color: Colors.secondary,
    fontWeight: FontWeight.medium,
  },

  // ── ERROR ─────────────────────────────────────────────────────────────────

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: Spacing.xxxl,
  },
  errorTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
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
  discardLink: {
    paddingVertical: 8,
  },
  discardLinkText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
});

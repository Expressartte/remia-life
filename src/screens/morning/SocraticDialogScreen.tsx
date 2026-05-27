import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useSocraticDialog } from '../../hooks/useSocraticDialog';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import ChatBubble from '../../components/dialog/ChatBubble';
import ProgressDots from '../../components/dialog/ProgressDots';
import TranscriptionCard from '../../components/dialog/TranscriptionCard';
import SafeScreen from '../../components/common/SafeScreen';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  MIN_TOUCH,
} from '../../styles/theme';
import { MorningStackParamList } from '../../types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<MorningStackParamList, 'SocraticDialog'>;

// ─── Indicador de escritura (3 puntos animados) ────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );

    const anim = Animated.parallel([animate(dot1, 0), animate(dot2, 200), animate(dot3, 400)]);
    anim.start();
    return () => anim.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dotStyle = (val: Animated.Value) => ({
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [
      {
        translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
      },
    ],
  });

  return (
    <View style={styles.typingRow}>
      <View style={styles.typingAvatar}>
        <Text style={styles.typingAvatarText}>R</Text>
      </View>
      <View style={styles.typingBubble}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} style={[styles.typingDot, dotStyle(d)]} />
        ))}
      </View>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function SocraticDialogScreen({ route, navigation }: Props) {
  const { dreamId } = route.params;
  const { user } = useAuth();
  const userId = user?.uid ?? '';

  const dialog = useSocraticDialog(userId, dreamId);
  const voice = useVoiceInput();

  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // ── Ocultar tab bar mientras esta pantalla está activa ────────────────────

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => {
        navigation.getParent()?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  // ── Scroll al fondo cuando llegan nuevos mensajes / indicador typing ──────

  useEffect(() => {
    if (dialog.messages.length > 0 || dialog.isTyping) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [dialog.messages.length, dialog.isTyping]);

  // ── Navegar al análisis cuando el diálogo termina ─────────────────────────

  useEffect(() => {
    if (dialog.dialogState === 'done') {
      navigation.replace('DreamAnalysis', { dreamId });
    }
  }, [dialog.dialogState, navigation, dreamId]);

  // ── Sincronizar texto transcrito desde voz al input ───────────────────────

  const handleMicPress = useCallback(async () => {
    if (voice.state === 'idle') {
      await voice.startRecording();
    } else if (voice.state === 'recording') {
      const transcribed = await voice.stopAndTranscribe();
      if (transcribed) setInputText(transcribed);
    }
  }, [voice]);

  // ── Enviar respuesta ──────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || dialog.dialogState !== 'ready') return;
    setInputText('');
    await dialog.submitAnswer(text, 'text');
  }, [inputText, dialog]);

  // ── Render de cada mensaje ────────────────────────────────────────────────

  const renderMessage = useCallback(
    ({ item }: { item: (typeof dialog.messages)[0] }) => {
      const question = dialog.questions.find((q) => q.id === item.questionId);
      return (
        <ChatBubble
          type={item.type}
          text={item.text}
          dimension={item.type === 'ai' ? question?.dimension : undefined}
          animated
        />
      );
    },
    [dialog.questions]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Estados de carga / error
  // ─────────────────────────────────────────────────────────────────────────

  if (dialog.dialogState === 'waiting_transcription') {
    return (
      <SafeScreen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingTitle}>Procesando tu sueño</Text>
          <Text style={styles.loadingSubtitle}>
            La transcripción puede tardar unos segundos...
          </Text>
        </View>
      </SafeScreen>
    );
  }

  if (dialog.dialogState === 'error') {
    return (
      <SafeScreen>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
          <Text style={styles.loadingTitle}>No se pudieron generar las preguntas</Text>
          <Text style={styles.loadingSubtitle}>{dialog.errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={dialog.retryGenerating}>
            <Text style={styles.retryLabel}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </SafeScreen>
    );
  }

  if (dialog.dialogState === 'done') {
    return (
      <SafeScreen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeScreen>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Vista principal del diálogo
  // ─────────────────────────────────────────────────────────────────────────

  const isInputDisabled =
    dialog.dialogState !== 'ready' || voice.state === 'transcribing';

  const isMicRecording = voice.state === 'recording';
  const isMicLoading = voice.state === 'transcribing';

  return (
    <SafeScreen noPadding>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Entrevista del sueño</Text>
            {dialog.questions.length > 0 && (
              <ProgressDots
                total={dialog.questions.length}
                current={Math.min(dialog.currentQuestionIndex, dialog.questions.length)}
              />
            )}
          </View>

          <View style={styles.headerRight}>
            {dialog.dialogState === 'generating' && (
              <ActivityIndicator size="small" color={Colors.primary} />
            )}
          </View>
        </View>

        {/* ─── Transcripción colapsable ─── */}
        {dialog.transcriptionText !== '' && (
          <TranscriptionCard
            text={dialog.transcriptionText}
            onEdit={dialog.updateTranscription}
          />
        )}

        {/* ─── Lista de mensajes ─── */}
        <FlatList
          ref={flatListRef}
          data={dialog.messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={dialog.isTyping ? <TypingIndicator /> : null}
          ListFooterComponentStyle={styles.typingWrapper}
        />

        {/* ─── Botón "Analizar mi sueño" ─── */}
        {dialog.dialogState === 'all_answered' && (
          <View style={styles.analyzeContainer}>
            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={dialog.startAnalysis}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles" size={20} color={Colors.textOnPrimary} />
              <Text style={styles.analyzeLabel}>Analizar mi sueño</Text>
            </TouchableOpacity>
            {dialog.errorMessage && (
              <Text style={styles.analyzeError}>{dialog.errorMessage}</Text>
            )}
          </View>
        )}

        {dialog.dialogState === 'submitting' && (
          <View style={styles.analyzeContainer}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.submittingText}>Iniciando análisis...</Text>
          </View>
        )}

        {/* ─── Input de texto + micrófono ─── */}
        {(dialog.dialogState === 'ready' || dialog.dialogState === 'typing') && (
          <View style={styles.inputArea}>
            {voice.errorMessage && (
              <Text style={styles.voiceError}>{voice.errorMessage}</Text>
            )}

            <View style={styles.inputRow}>
              {/* Campo de texto */}
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Escribe tu respuesta..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                maxLength={1000}
                editable={!isInputDisabled}
                selectionColor={Colors.primary}
                returnKeyType="default"
              />

              {/* Botón de micrófono */}
              <TouchableOpacity
                style={[
                  styles.micButton,
                  isMicRecording && styles.micButtonRecording,
                  isInputDisabled && !isMicRecording && styles.micButtonDisabled,
                ]}
                onPress={handleMicPress}
                disabled={isMicLoading}
                activeOpacity={0.8}
              >
                {isMicLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons
                    name={isMicRecording ? 'stop' : 'mic'}
                    size={20}
                    color={isMicRecording ? Colors.error : Colors.primary}
                  />
                )}
              </TouchableOpacity>

              {/* Botón de enviar */}
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isInputDisabled) && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || isInputDisabled}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-up" size={20} color={Colors.textOnPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Loading / Error / Done
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: Spacing.screen,
  },
  loadingTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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

  // Done state
  doneIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.secondaryDim,
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
    maxWidth: 300,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen,
    paddingVertical: 14,
    gap: 12,
  },
  backButton: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  headerRight: {
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Message list
  messageList: {
    paddingVertical: 8,
    paddingBottom: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  // Typing indicator
  typingWrapper: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 8,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.screen,
    marginVertical: 6,
  },
  typingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: `${Colors.primary}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingAvatarText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
  },

  // Analyze button
  analyzeContainer: {
    paddingHorizontal: Spacing.screen,
    paddingVertical: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    minHeight: MIN_TOUCH,
    paddingVertical: 16,
  },
  analyzeLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
  analyzeError: {
    fontSize: FontSize.xs,
    color: Colors.error,
    textAlign: 'center',
  },
  submittingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Input area
  inputArea: {
    paddingHorizontal: Spacing.screen,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: {
    backgroundColor: Colors.errorDim,
    borderColor: Colors.error,
  },
  micButtonDisabled: {
    opacity: 0.4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  voiceError: {
    fontSize: FontSize.xs,
    color: Colors.error,
  },
});

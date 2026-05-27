import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { Colors, FontSize, FontWeight, Spacing, Radius, MIN_TOUCH } from '../../styles/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Llamado tras crear; recibe el soundId. La lista comunitaria se actualiza vía Firestore listener. */
  onCreated: (soundId: string) => void;
}

interface SynthRequest {
  title: string;
  prompt: string;
  durationSeconds?: number;
}

interface SynthResponse {
  soundId: string;
  storagePath: string;
  durationSeconds: number;
  isCommunity: boolean;
}

const TITLE_MAX = 40;
const PROMPT_MAX = 500;

const DURATION_OPTIONS = [
  { label: '10s', value: 10 },
  { label: '22s', value: 22 },
];

const PROMPT_EXAMPLES = [
  'Soft cabin rain on a tin roof at dawn',
  'Gentle Tibetan singing bowls reverberating in a stone temple',
  'Distant whale songs underwater with soft current sounds',
  'Wind chimes on a porch in a soft summer breeze',
];

export default function CreateAmbientSoundModal({ visible, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(22);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setPrompt('');
    setDuration(22);
    setGenerating(false);
    setError(null);
  };

  const handleClose = () => {
    if (generating) return; // No cerrar mientras genera
    reset();
    onClose();
  };

  const canGenerate = title.trim().length > 0 && prompt.trim().length >= 10 && !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError(null);
    setGenerating(true);
    try {
      const fn = httpsCallable<SynthRequest, SynthResponse>(functions, 'generateAmbientSound');
      const result = await fn({
        title: title.trim(),
        prompt: prompt.trim(),
        durationSeconds: duration,
      });
      reset();
      onClose();
      onCreated(result.data.soundId);
    } catch (err: any) {
      console.error('[CreateAmbientSoundModal] generate error:', err);
      const msg = err?.message ?? 'No se pudo generar el sonido. Intenta de nuevo.';
      setError(msg);
      setGenerating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleClose}
            disabled={generating}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="close"
              size={26}
              color={generating ? Colors.textTertiary : Colors.textSecondary}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crear sonido</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Título */}
          <View style={styles.field}>
            <Text style={styles.label}>Título</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej. Lluvia en techo de zinc"
              placeholderTextColor={Colors.textTertiary}
              value={title}
              onChangeText={t => setTitle(t.slice(0, TITLE_MAX))}
              editable={!generating}
              maxLength={TITLE_MAX}
            />
            <Text style={styles.charCount}>
              {title.length}/{TITLE_MAX}
            </Text>
          </View>

          {/* Prompt */}
          <View style={styles.field}>
            <Text style={styles.label}>Descripción del sonido (en inglés funciona mejor)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Soft cabin rain on a tin roof at dawn, distant thunder, peaceful and continuous"
              placeholderTextColor={Colors.textTertiary}
              value={prompt}
              onChangeText={t => setPrompt(t.slice(0, PROMPT_MAX))}
              editable={!generating}
              maxLength={PROMPT_MAX}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {prompt.length}/{PROMPT_MAX}
            </Text>
          </View>

          {/* Ejemplos */}
          <View style={styles.examplesBox}>
            <Text style={styles.examplesLabel}>Ejemplos</Text>
            {PROMPT_EXAMPLES.map(ex => (
              <TouchableOpacity
                key={ex}
                onPress={() => !generating && setPrompt(ex)}
                disabled={generating}
                style={styles.exampleRow}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={14} color={Colors.primary} />
                <Text style={styles.exampleText} numberOfLines={2}>{ex}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Duración */}
          <View style={styles.field}>
            <Text style={styles.label}>Duración del clip</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.durationChip,
                    duration === opt.value && styles.durationChipActive,
                  ]}
                  onPress={() => !generating && setDuration(opt.value)}
                  disabled={generating}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.durationLabel,
                      duration === opt.value && styles.durationLabelActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              El sonido se procesa para loopear sin click. Aparecerá automáticamente
              en la biblioteca para todos los usuarios.
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText} numberOfLines={4}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={!canGenerate}
            activeOpacity={0.85}
          >
            {generating ? (
              <>
                <ActivityIndicator color={Colors.textOnPrimary} />
                <Text style={styles.generateLabel}>Generando ~15s…</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color={Colors.textOnPrimary} />
                <Text style={styles.generateLabel}>Generar y publicar</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.footerHint}>
            Límite: 5 sonidos por día · Voz por ElevenLabs
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  field: { gap: 6 },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: FontWeight.semibold,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    minHeight: MIN_TOUCH,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  examplesBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
  },
  examplesLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: FontWeight.semibold,
    marginBottom: 4,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  exampleText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  durationRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  durationChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  durationChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  durationLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  durationLabelActive: {
    color: Colors.primary,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginTop: 4,
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.4)',
    alignItems: 'flex-start',
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.error,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    gap: 6,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
  },
  generateBtnDisabled: {
    opacity: 0.45,
  },
  generateLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
  footerHint: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
});

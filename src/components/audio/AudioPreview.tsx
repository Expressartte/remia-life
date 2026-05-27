import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  MIN_TOUCH,
} from '../../styles/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AudioPreviewProps {
  audioUri: string;
  recordedDurationSecs: number;
  onConfirm: () => void;
  onDiscard: () => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

const formatTime = (secs: number): string => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AudioPreview({
  audioUri,
  recordedDurationSecs,
  onConfirm,
  onDiscard,
  isUploading = false,
  uploadProgress = 0,
}: AudioPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSecs, setPositionSecs] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // ── Carga el audio al montar ──────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false },
          (status) => {
            if (!mounted) return;
            if (status.isLoaded) {
              setPositionSecs((status.positionMillis ?? 0) / 1000);
              setIsPlaying(status.isPlaying);
              // Auto-stop al llegar al final
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPositionSecs(0);
                sound.setPositionAsync(0).catch(() => {});
              }
            }
          }
        );
        soundRef.current = sound;
        if (mounted) setIsLoaded(true);
      } catch (err) {
        console.warn('[AudioPreview] load error:', err);
      }
    };

    load();

    return () => {
      mounted = false;
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [audioUri]);

  // ── Detiene el sonido si se inicia la subida ──────────────────────────────

  useEffect(() => {
    if (isUploading) {
      soundRef.current?.pauseAsync().catch(() => {});
      setIsPlaying(false);
    }
  }, [isUploading]);

  // ── Toggle play / pause ───────────────────────────────────────────────────

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current || !isLoaded) return;
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (err) {
      console.warn('[AudioPreview] playback error:', err);
    }
  }, [isPlaying, isLoaded]);

  // ── Scrub: salta a una posición en el timeline ───────────────────────────

  const scrubTo = useCallback(
    async (pct: number) => {
      if (!soundRef.current || !isLoaded) return;
      const ms = pct * recordedDurationSecs * 1000;
      await soundRef.current.setPositionAsync(ms);
    },
    [isLoaded, recordedDurationSecs]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const progressPct =
    recordedDurationSecs > 0 ? positionSecs / recordedDurationSecs : 0;

  return (
    <View style={styles.container}>
      {/* Título */}
      <Text style={styles.title}>Tu sueño grabado</Text>
      <Text style={styles.subtitle}>
        Escúchalo antes de confirmar
      </Text>

      {/* Player */}
      <View style={styles.playerCard}>
        {/* Play / Pause */}
        <TouchableOpacity
          style={[styles.playButton, !isLoaded && styles.playButtonDisabled]}
          onPress={togglePlayback}
          disabled={!isLoaded || isUploading}
          activeOpacity={0.8}
        >
          {!isLoaded ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={Colors.textOnPrimary}
            />
          )}
        </TouchableOpacity>

        {/* Timeline */}
        <View style={styles.timeline}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, progressPct * 100)}%` },
              ]}
            />
            {/* Scrub thumb */}
            <View
              style={[
                styles.scrubThumb,
                { left: `${Math.min(98, progressPct * 100)}%` },
              ]}
            />
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(positionSecs)}</Text>
            <Text style={styles.timeText}>
              {formatTime(recordedDurationSecs)}
            </Text>
          </View>
        </View>
      </View>

      {/* Upload progress (visible durante la subida) */}
      {isUploading && (
        <View style={styles.uploadProgress}>
          <View style={styles.uploadProgressTrack}>
            <View
              style={[
                styles.uploadProgressFill,
                { width: `${Math.round(uploadProgress * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.uploadLabel}>
            Subiendo... {Math.round(uploadProgress * 100)}%
          </Text>
        </View>
      )}

      {/* Acciones */}
      {!isUploading && (
        <View style={styles.actions}>
          {/* Re-grabar */}
          <TouchableOpacity
            style={styles.discardButton}
            onPress={onDiscard}
            activeOpacity={0.75}
          >
            <Ionicons name="refresh" size={18} color={Colors.textSecondary} />
            <Text style={styles.discardLabel}>Re-grabar</Text>
          </TouchableOpacity>

          {/* Confirmar */}
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={onConfirm}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={20} color={Colors.textOnPrimary} />
            <Text style={styles.confirmLabel}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      )}

      {isUploading && (
        <View style={styles.uploadingRow}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.uploadingText}>
            Guardando tu sueño...
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: -12,
  },

  // Player
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playButtonDisabled: {
    opacity: 0.6,
  },
  timeline: {
    flex: 1,
    gap: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    position: 'relative',
    justifyContent: 'center',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  scrubThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    marginLeft: -6,
    top: -4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },

  // Upload progress
  uploadProgress: {
    gap: 8,
  },
  uploadProgressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  uploadLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  discardButton: {
    flex: 1,
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  discardLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 2,
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  confirmLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },

  // Uploading state
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  uploadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});

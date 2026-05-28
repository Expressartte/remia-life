import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Colors, FontSize, FontWeight, Spacing } from '../../styles/theme';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  youtubeId: string | null;
  title?: string;
  creator?: string;
  onClose: () => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function YouTubePlayerModal({
  visible,
  youtubeId,
  title,
  creator,
  onClose,
}: Props) {
  const { width } = useWindowDimensions();
  // 16:9 aspect ratio cap a 720px de ancho para tablets / web.
  const playerWidth = Math.min(width - Spacing.lg * 2, 720);
  const playerHeight = Math.round((playerWidth * 9) / 16);

  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Reset al abrir un nuevo video o cerrar.
  useEffect(() => {
    if (visible && youtubeId) {
      setPlaying(true);
      setLoaded(false);
      setErrored(false);
    }
    if (!visible) {
      setPlaying(false);
    }
  }, [visible, youtubeId]);

  const onChangeState = useCallback(
    (state: string) => {
      if (state === 'ended') {
        setPlaying(false);
      }
      if (state === 'playing' || state === 'paused' || state === 'buffering') {
        setLoaded(true);
      }
    },
    [],
  );

  const onError = useCallback(() => {
    setErrored(true);
    setLoaded(true);
  }, []);

  if (!youtubeId) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.titleColumn}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {creator ? (
              <Text style={styles.creator} numberOfLines={1}>
                {creator}
              </Text>
            ) : null}
          </View>
          <View style={styles.closeBtn} />
        </View>

        <View style={styles.playerWrap}>
          {/* Spinner mientras carga el embed la primera vez */}
          {!loaded && !errored && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Cargando reproductor…</Text>
            </View>
          )}

          {errored && (
            <View style={styles.errorOverlay}>
              <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
              <Text style={styles.errorTitle}>No se pudo cargar el video</Text>
              <Text style={styles.errorBody}>
                Puede que el creador haya deshabilitado el embed o el video
                ya no esté disponible. Probá con otra meditación del catálogo.
              </Text>
            </View>
          )}

          {!errored && (
            <YoutubePlayer
              height={playerHeight}
              width={playerWidth}
              play={playing}
              videoId={youtubeId}
              onChangeState={onChangeState}
              onError={onError}
              // Hardware layer on Android avoids occasional black frames.
              webViewProps={
                Platform.OS === 'android'
                  ? { androidLayerType: 'hardware' }
                  : undefined
              }
            />
          )}
        </View>

        {/* Hint sutil: cierre con gesto / botón */}
        <Text style={styles.hint}>Tocá ✕ cuando termines</Text>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : Spacing.xxl,
    paddingBottom: Spacing.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  creator: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  playerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    zIndex: -1, // detrás del player; visible solo cuando el player no llenó aún
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  errorOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
});

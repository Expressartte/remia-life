import React from 'react';
import { Platform } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

// ─── Interfaz común (compartida con YouTubeEmbed.web.tsx) ─────────────────────
//
// En nativo (iOS/Android) usamos react-native-youtube-iframe, que monta el
// reproductor dentro de un react-native-webview. En web, Metro resuelve
// automáticamente YouTubeEmbed.web.tsx, que usa un <iframe> nativo y evita la
// dependencia react-native-web-webview (vieja y sin mantenimiento).

export interface YouTubeEmbedProps {
  videoId: string;
  width: number;
  height: number;
  /** Native only: controla play/pause. En web el iframe usa autoplay. */
  playing?: boolean;
  /** Native only: 'playing' | 'paused' | 'buffering' | 'ended' | ... */
  onChangeState?: (state: string) => void;
  onError?: () => void;
  onReady?: () => void;
}

export default function YouTubeEmbed({
  videoId,
  width,
  height,
  playing = true,
  onChangeState,
  onError,
  onReady,
}: YouTubeEmbedProps) {
  return (
    <YoutubePlayer
      height={height}
      width={width}
      play={playing}
      videoId={videoId}
      onChangeState={onChangeState}
      onError={onError}
      onReady={onReady}
      webViewProps={
        Platform.OS === 'android' ? { androidLayerType: 'hardware' } : undefined
      }
    />
  );
}

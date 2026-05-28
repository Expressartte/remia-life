import React from 'react';
import { View } from 'react-native';
import type { YouTubeEmbedProps } from './YouTubeEmbed';

// ─── Web implementation ───────────────────────────────────────────────────────
//
// On web we render a plain YouTube <iframe> via React.createElement, which
// react-native-web passes straight through to the DOM. This avoids the
// react-native-web-webview dependency that react-native-youtube-iframe pulls in
// on web (unmaintained, breaks the Metro web bundle).

export default function YouTubeEmbed({
  videoId,
  width,
  height,
  onError,
  onReady,
}: YouTubeEmbedProps) {
  return (
    <View style={{ width, height }}>
      {React.createElement('iframe', {
        width,
        height,
        src: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
        title: 'YouTube meditation',
        frameBorder: '0',
        allow:
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowFullScreen: true,
        onLoad: onReady,
        onError,
        style: { border: 0, borderRadius: 12 },
      })}
    </View>
  );
}

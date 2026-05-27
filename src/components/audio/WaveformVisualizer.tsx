import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WaveformVisualizerProps {
  /** Valores normalizados 0–1, uno por barra */
  meteringBuffer: number[];
  isActive: boolean;
  width?: number;
  height?: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 52;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const ANIMATION_DURATION = 60; // ms por frame de animación

// ─── Colores del gradiente (primario → secundario) ────────────────────────────
const GRADIENT_START = '#6C63FF';
const GRADIENT_END = '#E8D5B7';

/** Interpola linealmente entre dos hex colors según t ∈ [0,1] */
const lerpColor = (from: string, to: string, t: number): string => {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
};

// ─── Componente de una barra individual ──────────────────────────────────────

interface BarProps {
  animHeight: Animated.Value;
  color: string;
  totalHeight: number;
}

const Bar = React.memo(({ animHeight, color, totalHeight }: BarProps) => {
  const translateY = animHeight.interpolate({
    inputRange: [BAR_MIN_HEIGHT, BAR_MAX_HEIGHT],
    outputRange: [(totalHeight - BAR_MIN_HEIGHT) / 2, (totalHeight - BAR_MAX_HEIGHT) / 2],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: color,
          height: animHeight,
          transform: [{ translateY }],
        },
      ]}
    />
  );
});

// ─── Componente principal ─────────────────────────────────────────────────────

export default function WaveformVisualizer({
  meteringBuffer,
  isActive,
  width,
  height = 64,
}: WaveformVisualizerProps) {
  const barCount = meteringBuffer.length;
  const animValues = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(BAR_MIN_HEIGHT))
  ).current;

  const idleAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Animación idle (estado pausado o detenido) ────────────────────────────

  const startIdleAnimation = () => {
    idleAnimRef.current?.stop();
    const animations = animValues.map((val, i) => {
      const delay = (i / barCount) * 600;
      const targetHeight = BAR_MIN_HEIGHT + Math.random() * 8 + 4;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: targetHeight,
            duration: 800 + Math.random() * 400,
            useNativeDriver: false,
          }),
          Animated.timing(val, {
            toValue: BAR_MIN_HEIGHT + 2,
            duration: 800 + Math.random() * 400,
            useNativeDriver: false,
          }),
        ])
      );
    });
    idleAnimRef.current = Animated.parallel(animations);
    idleAnimRef.current.start();
  };

  const stopIdleAnimation = () => {
    idleAnimRef.current?.stop();
    idleAnimRef.current = null;
  };

  useEffect(() => {
    if (!isActive) {
      startIdleAnimation();
    } else {
      stopIdleAnimation();
    }
    return () => stopIdleAnimation();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actualiza alturas de barras con datos de metering ─────────────────────

  useEffect(() => {
    if (!isActive) return;

    const animations = animValues.map((val, i) => {
      const normalized = meteringBuffer[i] ?? 0;
      const targetHeight =
        BAR_MIN_HEIGHT + normalized * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);

      return Animated.timing(val, {
        toValue: targetHeight,
        duration: ANIMATION_DURATION,
        useNativeDriver: false,
      });
    });

    Animated.parallel(animations, { stopTogether: false }).start();
  }, [meteringBuffer, isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Colores precalculados por posición ────────────────────────────────────

  const barColors = Array.from({ length: barCount }, (_, i) =>
    lerpColor(GRADIENT_START, GRADIENT_END, i / (barCount - 1))
  );

  return (
    <View style={[styles.container, { height, width }]}>
      {animValues.map((val, i) => (
        <Bar
          key={i}
          animHeight={val}
          color={barColors[i]}
          totalHeight={height}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: 2,
  },
});

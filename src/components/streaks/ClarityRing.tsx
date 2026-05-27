import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight, Colors, Spacing } from '../../styles/theme';
import {
  CrescentMoonIcon,
  LotusIcon,
  MysticalEyeIcon,
  MeditatingIcon,
  WaveHexagonIcon,
} from '../icons/MysticalIcons';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ringColor(score: number): string {
  if (score >= 67) return '#FFD166';
  if (score >= 34) return '#6C63FF';
  if (score >= 1)  return '#4ECDC4';
  return '#2A2A4A'; // vacío — usa el color del track
}

function ringLabel(score: number): { title: string; icon: React.ReactNode } {
  if (score === 0)  return { title: 'Comienza a soñar', icon: <CrescentMoonIcon size={32} gradientColors={['#2A2A4A', '#4A4A6A']} glowOpacity={0} /> };
  if (score < 20)   return { title: 'Despertando', icon: <WaveHexagonIcon size={32} /> };
  if (score < 40)   return { title: 'Explorando', icon: <MysticalEyeIcon size={32} /> };
  if (score < 60)   return { title: 'Conectando', icon: <CrescentMoonIcon size={32} /> };
  if (score < 80)   return { title: 'Revelando', icon: <LotusIcon size={32} /> };
  return { title: 'Iluminado', icon: <MeditatingIcon size={36} /> };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ClarityRingProps {
  score: number;    // 0-100
  size?: number;
  strokeWidth?: number;
}

export default function ClarityRing({
  score,
  size = 180,
  strokeWidth = 14,
}: ClarityRingProps) {
  const animScore = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(animScore, {
      toValue: score,
      duration: 1400,
      useNativeDriver: false,
    }).start();
  }, [score]);

  // Pulso suave cuando score es 0 (invita a interacción)
  useEffect(() => {
    if (score > 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [score]);

  const color = ringColor(score);
  const degrees = (score / 100) * 360;
  const { title, icon } = ringLabel(score);

  const rightDeg = `${Math.min(degrees, 180) - 180}deg`;
  const leftDeg  = `${Math.max(0, degrees - 180) - 180}deg`;

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: score === 0 ? pulseAnim : 1 }],
      }}
    >
      {/* Track exterior glow (solo cuando hay score) */}
      {score > 0 && (
        <View
          style={{
            position: 'absolute',
            width: size + 16,
            height: size + 16,
            borderRadius: (size + 16) / 2,
            borderWidth: 1,
            borderColor: `${color}20`,
          }}
        />
      )}

      {/* Background track */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: '#2A2A4A',
        }}
      />

      {/* Progress ring — right half */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, overflow: 'hidden' }]}>
        <View style={{ position: 'absolute', right: 0, width: size / 2, height: size, overflow: 'hidden' }}>
          <View
            style={{
              position: 'absolute',
              right: 0,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: degrees >= 1 ? color : 'transparent',
              transform: [{ rotate: rightDeg }],
            }}
          />
        </View>

        {/* Progress ring — left half */}
        <View style={{ position: 'absolute', left: 0, width: size / 2, height: size, overflow: 'hidden' }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: degrees > 180 ? color : 'transparent',
              transform: [{ rotate: leftDeg }],
            }}
          />
        </View>
      </View>

      {/* Inner content */}
      <View style={styles.inner}>
        <View style={styles.iconContainer}>{icon}</View>
        <Text style={[styles.score, { color: score === 0 ? Colors.textTertiary : color }]}>
          {score}
        </Text>
        <Text style={styles.scoreMax}>/100</Text>
        <Text style={[styles.label, { color: score === 0 ? Colors.textTertiary : color }]}>
          {title}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    gap: 0,
  },
  iconContainer: {
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36, // Asegura que no varíe mucho la altura
  },
  score: {
    fontSize: 44,
    fontWeight: FontWeight.extrabold,
    lineHeight: 48,
  },
  scoreMax: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: -4,
    letterSpacing: 1,
  },
  label: {
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
    fontWeight: FontWeight.semibold,
  },
});

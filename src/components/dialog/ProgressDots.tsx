import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Colors } from '../../styles/theme';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProgressDotsProps {
  total: number;
  current: number; // índice de la pregunta actual (0-based). Igual a total = todas respondidas
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }, (_, i) => (
        <Dot key={i} state={i < current ? 'done' : i === current ? 'active' : 'pending'} />
      ))}
    </View>
  );
}

// ─── Dot individual ───────────────────────────────────────────────────────────

type DotState = 'done' | 'active' | 'pending';

function Dot({ state }: { state: DotState }) {
  const scale = useRef(new Animated.Value(state === 'active' ? 1 : 0.7)).current;
  const opacity = useRef(new Animated.Value(state === 'pending' ? 0.3 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: state === 'active' ? 1.2 : state === 'done' ? 1 : 0.7,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: state === 'pending' ? 0.3 : 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const bgColor =
    state === 'done'
      ? Colors.success
      : state === 'active'
      ? Colors.primary
      : Colors.textTertiary;

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: bgColor, opacity, transform: [{ scale }] },
        state === 'active' && styles.dotActive,
      ]}
    />
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
});

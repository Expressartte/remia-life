import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontSize, FontWeight } from '../../styles/theme';
import { pluralize } from '../../utils/strings';

// ─── Tier config ──────────────────────────────────────────────────────────────

type FlameTier = 'small' | 'medium' | 'large' | 'legendary';

interface TierConfig {
  color: string;
  glowColor: string;
  iconSize: number;
  countSize: number;
}

const TIER_CONFIG: Record<FlameTier, TierConfig> = {
  small: {
    color: '#4ECDC4',
    glowColor: 'rgba(78, 205, 196, 0.2)',
    iconSize: 28,
    countSize: FontSize.lg,
  },
  medium: {
    color: '#6C63FF',
    glowColor: 'rgba(108, 99, 255, 0.22)',
    iconSize: 36,
    countSize: FontSize.xl,
  },
  large: {
    color: '#FFD166',
    glowColor: 'rgba(255, 209, 102, 0.22)',
    iconSize: 44,
    countSize: FontSize.xxl,
  },
  legendary: {
    color: '#FF6B6B',
    glowColor: 'rgba(255, 107, 107, 0.25)',
    iconSize: 52,
    countSize: FontSize.xxl,
  },
};

function getTier(streak: number): FlameTier {
  if (streak >= 50) return 'legendary';
  if (streak >= 21) return 'large';
  if (streak >= 7) return 'medium';
  return 'small';
}

// ─── Floating particle (legendary only) ──────────────────────────────────────

interface ParticleProps {
  color: string;
  delay: number;
  offsetX: number;
}

function FloatingParticle({ color, delay, offsetX }: ParticleProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      opacity.setValue(0);
      translateY.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.9,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -30,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => animate());
    };
    animate();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX: offsetX }],
        bottom: 6,
        alignSelf: 'center',
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface StreakFlameProps {
  streak: number;
  label: string;
  compact?: boolean; // smaller layout for side-by-side cards
}

export default function StreakFlame({ streak, label, compact = false }: StreakFlameProps) {
  const tier = getTier(streak);
  const cfg = TIER_CONFIG[tier];

  // Gentle breathe pulse
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const glowSize = cfg.iconSize + (compact ? 20 : 28);

  return (
    <View style={styles.container}>
      {/* Flame + glow */}
      <View style={styles.flameWrap}>
        <Animated.View
          style={[
            styles.glow,
            {
              width: glowSize,
              height: glowSize,
              borderRadius: glowSize / 2,
              backgroundColor: cfg.glowColor,
              transform: [{ scale: pulse }],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Ionicons name="flame" size={cfg.iconSize} color={cfg.color} />
        </Animated.View>

        {tier === 'legendary' && (
          <>
            <FloatingParticle color={cfg.color} delay={0} offsetX={-8} />
            <FloatingParticle color={cfg.color} delay={500} offsetX={8} />
            <FloatingParticle color={cfg.color} delay={900} offsetX={0} />
          </>
        )}
      </View>

      {/* Count */}
      <Text style={[styles.count, { color: cfg.color, fontSize: cfg.countSize }]}>
        {streak}
      </Text>

      {/* Label */}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.sublabel}>{pluralize(streak, 'día seguido', 'días seguidos')}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 4,
  },
  flameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
  },
  count: {
    fontWeight: FontWeight.extrabold,
    lineHeight: undefined,
    marginTop: 4,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  sublabel: {
    fontSize: FontSize.xs,
    color: '#8B8B9E',
    letterSpacing: 0.3,
  },
});

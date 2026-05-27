import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../styles/theme';
import { QuestionDimension } from '../../types';

// ─── Etiqueta de dimensión ────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<QuestionDimension, string> = {
  emotion: 'Emoción',
  figure: 'Figuras',
  symbol: 'Símbolo',
  waking_connection: 'Vida consciente',
  somatic: 'Cuerpo',
};

const DIMENSION_COLOR: Record<QuestionDimension, string> = {
  emotion: '#FF6B9D',
  figure: '#C39BD3',
  symbol: '#6C63FF',
  waking_connection: '#4ECDC4',
  somatic: '#FFD166',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatBubbleProps {
  type: 'ai' | 'user';
  text: string;
  dimension?: QuestionDimension;
  animated?: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ChatBubble({ type, text, dimension, animated = true }: ChatBubbleProps) {
  const opacity = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animated ? 12 : 0)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isAI = type === 'ai';

  return (
    <Animated.View
      style={[
        styles.row,
        isAI ? styles.rowAI : styles.rowUser,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      {isAI && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>R</Text>
        </View>
      )}

      <View style={[styles.bubble, isAI ? styles.bubbleAI : styles.bubbleUser]}>
        {/* Etiqueta de dimensión solo en burbujas de IA */}
        {isAI && dimension && (
          <View
            style={[
              styles.dimensionTag,
              { backgroundColor: `${DIMENSION_COLOR[dimension]}22` },
            ]}
          >
            <View
              style={[
                styles.dimensionDot,
                { backgroundColor: DIMENSION_COLOR[dimension] },
              ]}
            />
            <Text
              style={[
                styles.dimensionLabel,
                { color: DIMENSION_COLOR[dimension] },
              ]}
            >
              {DIMENSION_LABELS[dimension]}
            </Text>
          </View>
        )}

        <Text style={[styles.text, isAI ? styles.textAI : styles.textUser]}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 6,
    paddingHorizontal: Spacing.screen,
    gap: 10,
  },
  rowAI: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  rowUser: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },

  // Avatar de la IA
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: `${Colors.primary}44`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 4,
  },
  avatarText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },

  // Burbuja
  bubble: {
    maxWidth: '78%',
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  bubbleAI: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderTopRightRadius: 4,
  },

  // Etiqueta de dimensión
  dimensionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  dimensionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dimensionLabel: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Texto
  text: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  textAI: {
    color: Colors.textPrimary,
  },
  textUser: {
    color: Colors.textOnPrimary,
  },
});

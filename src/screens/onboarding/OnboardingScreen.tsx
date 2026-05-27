import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  MIN_TOUCH,
} from '../../styles/theme';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Contenido de cada slide ──────────────────────────────────────────────────

const SLIDES = [
  {
    icon: 'mic' as const,
    iconBg: '#6C63FF',
    accent: '#6C63FF',
    emoji: '🌙',
    title: 'Graba al despertar',
    subtitle:
      'Apenas abres los ojos, pulsa grabar y cuéntale a Remia tu sueño. La IA transcribirá cada detalle mientras sigues despertando.',
    hint: 'Los sueños se desvanecen en minutos. Actúa rápido.',
  },
  {
    icon: 'sparkles' as const,
    iconBg: '#4ECDC4',
    accent: '#4ECDC4',
    emoji: '✦',
    title: 'Remia los analiza',
    subtitle:
      'Cada sueño pasa por un análisis profundo: símbolos, emociones, arquetipos junguianos y narrativas recurrentes que conectan tu mundo interior.',
    hint: 'A partir del 7° sueño empiezan a emerger patrones.',
  },
  {
    icon: 'eye' as const,
    iconBg: '#FFD166',
    accent: '#FFD166',
    emoji: '◈',
    title: 'Conoce tu mente',
    subtitle:
      'Construye tu Retrato del Inconsciente: un mapa único que revela quién eres más allá de la vigilia. Cada sueño es una pieza del rompecabezas.',
    hint: 'Tu privacidad es sagrada. Tus datos nunca se comparten.',
  },
];

// ─── Sub-componente de un slide ───────────────────────────────────────────────

function Slide({
  slide,
  index,
  scrollX,
}: {
  slide: (typeof SLIDES)[0];
  index: number;
  scrollX: Animated.Value;
}) {
  const inputRange = [(index - 1) * SW, index * SW, (index + 1) * SW];

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [32, 0, 32],
    extrapolate: 'clamp',
  });

  const iconScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.7, 1, 0.7],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[styles.slide, { width: SW, opacity, transform: [{ translateY }] }]}
    >
      {/* Ícono central */}
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}>
        {/* Aura exterior */}
        <View
          style={[
            styles.iconAuraOuter,
            { borderColor: `${slide.iconBg}30` },
          ]}
        />
        <View
          style={[
            styles.iconAuraInner,
            { borderColor: `${slide.iconBg}50` },
          ]}
        />
        {/* Círculo principal */}
        <View style={[styles.iconCircle, { backgroundColor: `${slide.iconBg}20` }]}>
          {Platform.OS === 'web' ? (
            <View
              style={[
                styles.iconInner,
                { backgroundColor: slide.iconBg },
              ]}
            >
              <Ionicons name={slide.icon} size={40} color="#fff" />
            </View>
          ) : (
            <LinearGradient
              colors={[slide.iconBg, `${slide.iconBg}CC`]}
              style={styles.iconInner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={slide.icon} size={40} color="#fff" />
            </LinearGradient>
          )}
        </View>
        {/* Emoji flotante */}
        <Text style={[styles.floatingEmoji, { color: slide.iconBg }]}>
          {slide.emoji}
        </Text>
      </Animated.View>

      {/* Texto */}
      <View style={styles.textBlock}>
        <Text style={[styles.slideTitle, { color: Colors.textPrimary }]}>
          {slide.title}
        </Text>
        <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
        <View style={[styles.hintRow, { borderColor: `${slide.accent}40` }]}>
          <Ionicons name="information-circle-outline" size={13} color={slide.accent} />
          <Text style={[styles.hintText, { color: slide.accent }]}>{slide.hint}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Componente principal OnboardingScreen ────────────────────────────────────

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isLast = currentIndex === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    const next = currentIndex + 1;
    scrollRef.current?.scrollTo({ x: next * SW, animated: true });
    setCurrentIndex(next);
  };

  const goBack = () => {
    if (currentIndex === 0) return;
    const prev = currentIndex - 1;
    scrollRef.current?.scrollTo({ x: prev * SW, animated: true });
    setCurrentIndex(prev);
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (e: any) => {
        const x = e.nativeEvent.contentOffset.x;
        const idx = Math.round(x / SW);
        if (idx !== currentIndex && idx >= 0 && idx < SLIDES.length) {
          setCurrentIndex(idx);
        }
      },
    },
  );

  return (
    <View style={styles.container}>
      {/* Fondo con gradiente radial simulado */}
      <View style={styles.bgGlow} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Ionicons name="moon" size={FontSize.xl} color={Colors.primary} />
          <Text style={styles.logo}>remia</Text>
        </View>
        <TouchableOpacity
          onPress={onComplete}
          style={styles.skipBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>Omitir</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        style={styles.pager}
        contentContainerStyle={{ width: SW * SLIDES.length }}
      >
        {SLIDES.map((slide, i) => (
          <Slide key={i} slide={slide} index={i} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * SW, i * SW, (i + 1) * SW],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange: [(i - 1) * SW, i * SW, (i + 1) * SW],
              outputRange: [0.35, 1, 0.35],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                    backgroundColor:
                      i === currentIndex ? SLIDES[currentIndex].accent : Colors.textTertiary,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Botones de navegación */}
        <View style={styles.navRow}>
          {/* Atrás */}
          <TouchableOpacity
            onPress={goBack}
            style={[styles.backBtn, currentIndex === 0 && styles.hidden]}
            disabled={currentIndex === 0}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Siguiente / Comenzar */}
          <TouchableOpacity
            onPress={goNext}
            style={[
              styles.nextBtn,
              { backgroundColor: SLIDES[currentIndex].accent },
            ]}
            activeOpacity={0.85}
          >
            {isLast ? (
              <>
                <Text style={styles.nextBtnLabel}>Comenzar</Text>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </>
            ) : (
              <>
                <Text style={styles.nextBtnLabel}>Siguiente</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const ICON_SIZE = Math.min(SW * 0.42, 200);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.background,
    zIndex: 999,
  },

  // Glow de fondo
  bgGlow: {
    position: 'absolute',
    top: -SH * 0.15,
    left: SW * 0.5 - 200,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: Spacing.md,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 4,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },

  // Pager
  pager: {
    flex: 1,
  },

  // Slide
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screen,
    gap: Spacing.xxl,
  },

  // Ícono
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: ICON_SIZE + 80,
    height: ICON_SIZE + 80,
  },
  iconAuraOuter: {
    position: 'absolute',
    width: ICON_SIZE + 80,
    height: ICON_SIZE + 80,
    borderRadius: (ICON_SIZE + 80) / 2,
    borderWidth: 1,
  },
  iconAuraInner: {
    position: 'absolute',
    width: ICON_SIZE + 40,
    height: ICON_SIZE + 40,
    borderRadius: (ICON_SIZE + 40) / 2,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: ICON_SIZE * 0.65,
    height: ICON_SIZE * 0.65,
    borderRadius: (ICON_SIZE * 0.65) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingEmoji: {
    position: 'absolute',
    top: 8,
    right: 16,
    fontSize: 22,
    opacity: 0.7,
  },

  // Texto
  textBlock: {
    alignItems: 'center',
    gap: Spacing.base,
    maxWidth: 340,
  },
  slideTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  slideSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  hintText: {
    fontSize: FontSize.xs,
    lineHeight: 17,
    flex: 1,
    fontWeight: FontWeight.medium,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    paddingTop: Spacing.lg,
    gap: Spacing.xl,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: Radius.full,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    opacity: 0,
    pointerEvents: 'none',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    minHeight: MIN_TOUCH,
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'center',
  },
  nextBtnLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
    letterSpacing: 0.3,
  },
});

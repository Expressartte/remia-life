import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  MIN_TOUCH,
} from '../../styles/theme';
import { useMeditationPicker } from '../../hooks/useMeditationPicker';
import {
  YoutubeMeditation,
  MeditationContext,
} from '../../types/meditations';
import YouTubePlayerModal from './YouTubePlayerModal';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Context for the picker (default: 'pre_sleep' — invoked from NightScreen). */
  context?: MeditationContext;
}

type TabKey = 'youtube' | 'insight_timer';

// ─── Insight Timer deep links ────────────────────────────────────────────────
//
// Insight Timer no expone una API pública estable, pero su app tiene URL schemes
// y la web acepta /meditation-topics/{slug}. Usamos canOpenURL para preferir la
// app cuando está instalada y caer al web cuando no.

interface InsightTimerTopic {
  id: string;
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  slug: string;
}

const INSIGHT_TIMER_TOPICS: InsightTimerTopic[] = [
  {
    id: 'sleep',
    label: 'Para dormir',
    subtitle: 'Sueño profundo y reparador',
    icon: 'moon-outline',
    color: '#6C63FF',
    slug: 'sleep',
  },
  {
    id: 'anxiety',
    label: 'Ansiedad',
    subtitle: 'Calma para una mente acelerada',
    icon: 'leaf-outline',
    color: '#84A98C',
    slug: 'anxiety',
  },
  {
    id: 'gratitude',
    label: 'Gratitud',
    subtitle: 'Cierre amable del día',
    icon: 'heart-outline',
    color: '#F4A261',
    slug: 'gratitude',
  },
  {
    id: 'focus',
    label: 'Enfoque',
    subtitle: 'Concentración y claridad mental',
    icon: 'body-outline',
    color: '#8D99AE',
    slug: 'focus',
  },
  {
    id: 'self-love',
    label: 'Auto-compasión',
    subtitle: 'Trabajo emocional profundo',
    icon: 'heart-circle-outline',
    color: '#F4A261',
    slug: 'self-love',
  },
  {
    id: 'stress',
    label: 'Estrés',
    subtitle: 'Soltar tensión acumulada',
    icon: 'water-outline',
    color: '#4ECDC4',
    slug: 'stress',
  },
];

async function openInsightTimer(slug: string) {
  // Insight Timer no documenta un scheme deep-link estable; abrimos directo en
  // web (que dispara la app si está instalada en mobile via universal links).
  const webUrl = `https://insighttimer.com/meditation-topics/${slug}`;
  try {
    await Linking.openURL(webUrl);
  } catch (err) {
    console.warn('[MeditationsModal] could not open Insight Timer URL', err);
  }
}

// ─── YouTube meditation card ──────────────────────────────────────────────────

function YouTubeMeditationCard({
  meditation,
  onPress,
}: {
  meditation: YoutubeMeditation;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.cardThumb}>
        <Ionicons name="logo-youtube" size={28} color="#FF0000" />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardCategory}>{meditation.categoryLabel}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {meditation.title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {meditation.creator}
        </Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardDuration}>{meditation.duration_min}′</Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={Colors.textTertiary}
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Insight Timer topic card ─────────────────────────────────────────────────

function InsightTimerCard({
  topic,
  onPress,
}: {
  topic: InsightTimerTopic;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View
        style={[styles.cardIcon, { backgroundColor: topic.color + '22' }]}
      >
        <Ionicons name={topic.icon} size={24} color={topic.color} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardCategory}>Insight Timer</Text>
        <Text style={styles.cardTitle}>{topic.label}</Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {topic.subtitle}
        </Text>
      </View>
      <Ionicons name="open-outline" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function MeditationsModal({
  visible,
  onClose,
  context = 'pre_sleep',
}: Props) {
  const [tab, setTab] = useState<TabKey>('youtube');
  const [selected, setSelected] = useState<YoutubeMeditation | null>(null);

  const { meditations, loading, error, refresh } = useMeditationPicker({
    context,
    pageSize: 12,
  });

  // Reset selección y tab al cerrar el modal externo
  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setTab('youtube');
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>Biblioteca</Text>
            <Text style={styles.headerTitle}>Meditaciones</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'youtube' && styles.tabActive]}
            onPress={() => setTab('youtube')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="logo-youtube"
              size={14}
              color={tab === 'youtube' ? Colors.primary : Colors.textTertiary}
            />
            <Text
              style={[
                styles.tabLabel,
                tab === 'youtube' && styles.tabLabelActive,
              ]}
            >
              YouTube
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, tab === 'insight_timer' && styles.tabActive]}
            onPress={() => setTab('insight_timer')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="leaf-outline"
              size={14}
              color={
                tab === 'insight_timer'
                  ? Colors.primary
                  : Colors.textTertiary
              }
            />
            <Text
              style={[
                styles.tabLabel,
                tab === 'insight_timer' && styles.tabLabelActive,
              ]}
            >
              Insight Timer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hint sutil por tab */}
        <Text style={styles.tabHint}>
          {tab === 'youtube'
            ? 'Catálogo curado en español. Tocá para reproducir dentro de la app.'
            : 'Te llevamos a Insight Timer (app o web) — tienen miles de meditaciones gratuitas.'}
        </Text>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'youtube' ? (
            loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={36}
                  color={Colors.textTertiary}
                />
                <Text style={styles.emptyTitle}>No se pudo cargar</Text>
                <Text style={styles.emptyBody}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => refresh()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.retryBtnText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : meditations.length === 0 ? (
              <View style={styles.center}>
                <Ionicons
                  name="library-outline"
                  size={36}
                  color={Colors.textTertiary}
                />
                <Text style={styles.emptyTitle}>Catálogo vacío</Text>
                <Text style={styles.emptyBody}>
                  Aún no hay meditaciones curadas para esta categoría. Volvé a
                  intentar más tarde o probá Insight Timer.
                </Text>
              </View>
            ) : (
              meditations.map((m) => (
                <YouTubeMeditationCard
                  key={m.id}
                  meditation={m}
                  onPress={() => setSelected(m)}
                />
              ))
            )
          ) : (
            INSIGHT_TIMER_TOPICS.map((t) => (
              <InsightTimerCard
                key={t.id}
                topic={t}
                onPress={() => openInsightTimer(t.slug)}
              />
            ))
          )}
        </ScrollView>

        {/* YouTube player modal (nested) */}
        <YouTubePlayerModal
          visible={!!selected}
          youtubeId={selected?.youtube_id ?? null}
          title={selected?.title}
          creator={selected?.creator}
          onClose={() => setSelected(null)}
        />
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  headerLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screen,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabActive: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primary,
  },
  tabLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  tabLabelActive: {
    color: Colors.primary,
  },
  tabHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.screen,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },

  // List
  list: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: 32,
    gap: Spacing.sm,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  emptyBody: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: Radius.full,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: Colors.textOnPrimary,
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
  },

  // Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  cardThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardCategory: {
    fontSize: 10,
    color: Colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  cardSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDuration: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: FontWeight.semibold,
  },
});

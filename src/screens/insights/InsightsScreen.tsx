import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';

import SafeScreen from '../../components/common/SafeScreen';
import ClarityRing from '../../components/streaks/ClarityRing';
import StreakFlame from '../../components/streaks/StreakFlame';
import LockedSection from '../../components/insights/LockedSection';
import DreamMap from '../../components/insights/DreamMap';
import NarrativeThreadCard from '../../components/insights/NarrativeThreadCard';
import ArchetypeRadar from '../../components/insights/ArchetypeRadar';
import PortraitSection from '../../components/insights/PortraitSection';

import { useEngagement, ClarityBreakdown } from '../../hooks/useEngagement';
import { useInsights } from '../../hooks/useInsights';
import { useDreamPatterns } from '../../hooks/useDreamPatterns';
import { LEVEL_CONFIGS, LevelConfig } from '../../types';
import {
  DREAM_MAP_THRESHOLD,
  THREADS_THRESHOLD,
  ARCHETYPE_THRESHOLD,
  PORTRAIT_THRESHOLD,
  nextMilestone,
} from '../../config/milestones';
import { pluralize } from '../../utils/strings';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  Shadow,
} from '../../styles/theme';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - Spacing.screen * 2 - Spacing.md) / 2;

// ─── Shared sub-components ────────────────────────────────────────────────────

interface BreakdownBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
  delay: number;
}

function BreakdownBar({ label, value, max, color, delay }: BreakdownBarProps) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value / max,
      duration: 900,
      delay,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const pct = Math.round((value / max) * 100);

  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <View style={styles.barValueRow}>
          <Text style={[styles.barValue, { color }]}>{value}/{max}</Text>
          <Text style={styles.barPct}> · {pct}%</Text>
        </View>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

// ─── MetricCard — tarjeta compacta para el grid 2×2 ─────────────────────────

interface MetricCardProps {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  delay: number;
}

function MetricCard({ label, value, max, color, icon, delay }: MetricCardProps) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value / max,
      duration: 900,
      delay,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const pct = Math.round((value / max) * 100);

  return (
    <View style={[styles.metricCard, { borderColor: `${color}25` }]}>
      {/* Icon + label */}
      <View style={styles.metricCardHeader}>
        <View style={[styles.metricIconWrap, { backgroundColor: `${color}18` }]}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
      </View>

      {/* Value */}
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        <Text style={styles.metricMax}>/{max}</Text>
      </View>

      {/* Mini bar */}
      <View style={styles.metricBarTrack}>
        <Animated.View
          style={[
            styles.metricBarFill,
            {
              backgroundColor: color,
              width: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Pct */}
      <Text style={[styles.metricPct, { color }]}>{pct}%</Text>
    </View>
  );
}

interface StreakCardProps {
  streak: number;
  longest: number;
  label: string;
  icon: 'sunny' | 'moon';
  freezeAvailable: boolean;
}

function StreakCard({ streak, longest, label, icon, freezeAvailable }: StreakCardProps) {
  return (
    <View style={[styles.streakCard, { width: CARD_W }]}>
      <View style={styles.streakCardHeader}>
        <Ionicons
          name={icon}
          size={14}
          color={icon === 'sunny' ? Colors.warning : Colors.primary}
        />
        <Text style={styles.streakCardLabel}>{label}</Text>
      </View>
      <StreakFlame streak={streak} label="" />
      <View style={styles.streakRecord}>
        <Text style={styles.streakRecordLabel}>Récord</Text>
        <Text style={styles.streakRecordValue}>{longest} {pluralize(longest, 'día', 'días')}</Text>
      </View>
      {freezeAvailable && (
        <View style={styles.freezeBadge}>
          <Text style={styles.freezeText}>❄️ Freeze disponible</Text>
        </View>
      )}
    </View>
  );
}

interface LevelSectionProps {
  current: LevelConfig;
  next: LevelConfig | null;
  progress: number;
  dreamsToNext: number;
  totalDreams: number;
}

function LevelSection({ current, next, progress, dreamsToNext, totalDreams }: LevelSectionProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1000,
      delay: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={styles.levelCard}>
      <View style={styles.levelBadge}>
        <View style={[styles.levelIconWrap, { backgroundColor: `${current.color}22` }]}>
          <Ionicons
            name={current.icon as React.ComponentProps<typeof Ionicons>['name']}
            size={22}
            color={current.color}
          />
        </View>
        <View style={styles.levelTitleCol}>
          <Text style={[styles.levelName, { color: current.color }]}>{current.label}</Text>
          <Text style={styles.levelSubtitle}>{current.subtitle}</Text>
        </View>
      </View>

      {next && (
        <>
          <View style={styles.levelProgressHeader}>
            <Text style={styles.levelProgressLabel}>
              {totalDreams} / {next.minDreams} sueños
            </Text>
            <Text style={styles.levelProgressHint}>
              {dreamsToNext} para {next.label}
            </Text>
          </View>
          <View style={styles.levelProgressTrack}>
            <Animated.View
              style={[
                styles.levelProgressFill,
                {
                  backgroundColor: current.color,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </>
      )}

      <Text style={styles.unlockedTitle}>Desbloqueado</Text>
      {current.unlocks.map(u => (
        <View key={u} style={styles.featureRow}>
          <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
          <Text style={styles.featureText}>{u}</Text>
        </View>
      ))}

      {next && (
        <>
          <View style={styles.divider} />
          {next.unlocks.map(u => (
            <View key={u} style={styles.featureRow}>
              <Ionicons name="lock-closed-outline" size={14} color={Colors.textTertiary} />
              <Text style={[styles.featureText, { color: Colors.textTertiary }]}>{u}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function MilestoneTimeline({ totalDreams }: { totalDreams: number }) {
  return (
    <View style={styles.milestoneRow}>
      {LEVEL_CONFIGS.map((lvl, idx) => {
        const unlocked = totalDreams >= lvl.minDreams;
        const isLast = idx === LEVEL_CONFIGS.length - 1;
        return (
          <React.Fragment key={lvl.key}>
            <View style={styles.milestoneNode}>
              <View
                style={[
                  styles.milestoneCircle,
                  {
                    backgroundColor: unlocked ? lvl.color : Colors.surfaceElevated,
                    borderColor: unlocked ? lvl.color : Colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={unlocked ? 'checkmark' : 'lock-closed-outline'}
                  size={12}
                  color={unlocked ? '#fff' : Colors.textTertiary}
                />
              </View>
              <Text
                style={[
                  styles.milestoneCount,
                  { color: unlocked ? lvl.color : Colors.textTertiary },
                ]}
              >
                {lvl.minDreams === 0 ? '0' : lvl.minDreams}
              </Text>
              <Text
                style={[
                  styles.milestoneName,
                  { color: unlocked ? Colors.textSecondary : Colors.textTertiary },
                ]}
                numberOfLines={2}
              >
                {lvl.label.split(' ').slice(-1)[0]}
              </Text>
            </View>
            {!isLast && (
              <View
                style={[
                  styles.milestoneConnector,
                  {
                    backgroundColor:
                      totalDreams >= LEVEL_CONFIGS[idx + 1].minDreams
                        ? lvl.color
                        : Colors.border,
                  },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  icon,
  color = Colors.textSecondary,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  color?: string;
}) {
  return (
    <View style={styles.sectionHeaderRow}>
      {icon && <Ionicons name={icon} size={16} color={color} />}
      <View style={styles.sectionHeaderText}>
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const NUM_SECTIONS = 9;

export default function InsightsScreen() {
  const navigation = useNavigation();

  // ── Logout ─────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    const doSignOut = async () => {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('[InsightsScreen] signOut error:', err);
      }
    };

    if (Platform.OS === 'web') {
      // Alert no está disponible de forma nativa en web
      if (window.confirm('¿Cerrar sesión?')) doSignOut();
    } else {
      Alert.alert(
        'Cerrar sesión',
        '¿Estás seguro de que quieres cerrar sesión?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar sesión', style: 'destructive', onPress: doSignOut },
        ],
      );
    }
  }, []);

  const {
    loading,
    clarityIndex,
    clarityBreakdown,
    currentLevelConfig,
    nextLevelConfig,
    levelProgress,
    dreamsToNextLevel,
    morningStreak,
    morningLongest,
    nightStreak,
    nightLongest,
    morningFreezeAvailable,
    nightFreezeAvailable,
    totalDreams,
  } = useEngagement();

  const {
    narrativeThreads,
    portrait,
    loadingThreads,
    loadingPortrait,
    generatingPortrait,
    portraitError,
    generatePortrait,
  } = useInsights();

  const { mapData, archetypeData } = useDreamPatterns();

  const fadeAnims = useRef(
    Array.from({ length: NUM_SECTIONS }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (loading) return;
    Animated.stagger(
      100,
      fadeAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 500, useNativeDriver: true }),
      ),
    ).start();
  }, [loading]);

  const section = (i: number, children: React.ReactNode) => (
    <Animated.View
      style={{
        opacity: fadeAnims[i],
        transform: [
          {
            translateY: fadeAnims[i].interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );

  return (
    <SafeScreen noPadding>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 0: Header ────────────────────────────────────────────────── */}
        {section(
          0,
          (() => {
            const next = nextMilestone(totalDreams);
            const dreamsLeft = next ? next.threshold - totalDreams : 0;
            const ctaText =
              totalDreams === 0
                ? 'Graba tu primer sueño para comenzar a ver tu progreso.'
                : next
                  ? `${dreamsLeft} ${pluralize(dreamsLeft, 'sueño', 'sueños')} para desbloquear ${next.name}.`
                  : null;
            return (
              <View style={styles.header}>
                {/* Título + botón de perfil */}
                <View style={styles.headerRow}>
                  <View style={styles.headerTitleCol}>
                    <Text style={styles.headerLabel}>Tu progreso</Text>
                    <Text style={styles.headerTitle}>Insights</Text>
                  </View>
                  <TouchableOpacity
                    id="logout-btn"
                    style={styles.profileBtn}
                    onPress={handleLogout}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="person-circle-outline" size={28} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {ctaText && (
                  <View style={styles.headerCta}>
                    <Ionicons name="moon-outline" size={16} color={Colors.primary} />
                    <Text style={styles.headerCtaText}>{ctaText}</Text>
                    <TouchableOpacity
                      style={styles.headerCtaBtn}
                      onPress={() => (navigation as any).navigate('Morning')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.headerCtaBtnLabel}>Ir a grabar »</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })(),
        )}

        {/* ── 1: Clarity Ring ──────────────────────────────────────────── */}
        {section(
          1,
          <View style={styles.ringSection}>
            <ClarityRing score={clarityIndex} />

            {/* Métricas en grid 2×2 */}
            <View style={styles.metricsGrid}>
              {([
                { label: 'Racha Mañana',       value: clarityBreakdown.morningScore, max: 40, color: '#FFD166', icon: 'sunny-outline',        delay: 200 },
                { label: 'Racha Noche',         value: clarityBreakdown.nightScore,   max: 30, color: '#6C63FF', icon: 'moon-outline',         delay: 350 },
                { label: 'Sueños',              value: clarityBreakdown.dreamsScore,  max: 20, color: '#4ECDC4', icon: 'moon',                  delay: 500 },
                { label: 'Reflexión',           value: clarityBreakdown.qualityScore, max: 10, color: '#FF6B6B', icon: 'chatbubble-outline',    delay: 650 },
              ] as MetricCardProps[]).map((m) => (
                <MetricCard key={m.label} {...m} />
              ))}
            </View>
          </View>,
        )}

        {/* ── 2: Streaks ───────────────────────────────────────────────── */}
        {section(
          2,
          <View>
            <SectionHeader title="Rachas" />
            <View style={styles.streakRow}>
              <StreakCard streak={morningStreak} longest={morningLongest} label="Mañana" icon="sunny" freezeAvailable={morningFreezeAvailable} />
              <StreakCard streak={nightStreak}   longest={nightLongest}   label="Noche"  icon="moon"  freezeAvailable={nightFreezeAvailable} />
            </View>
            <View style={styles.freezeInfo}>
              <Ionicons name="snow-outline" size={13} color={Colors.textTertiary} />
              <Text style={styles.freezeInfoText}>
                Cada racha tiene 1 freeze automático por semana.
              </Text>
            </View>
          </View>,
        )}

        {/* ── 3: Level ─────────────────────────────────────────────────── */}
        {section(
          3,
          <View>
            <SectionHeader title="Tu Nivel" />
            <LevelSection
              current={currentLevelConfig}
              next={nextLevelConfig}
              progress={levelProgress}
              dreamsToNext={dreamsToNextLevel}
              totalDreams={totalDreams}
            />
          </View>,
        )}

        {/* ── 4: Milestone timeline ────────────────────────────────────── */}
        {section(
          4,
          <View>
            <SectionHeader title="Camino del Soñador" />
            <View style={styles.milestoneCard}>
              <MilestoneTimeline totalDreams={totalDreams} />
            </View>
          </View>,
        )}

        {/* ── 5: Dream Map (unlock: 7 dreams) ──────────────────────────── */}
        {section(
          5,
          <View>
            <SectionHeader
              title="Dream Map"
              subtitle="Conexiones entre símbolos, emociones y arquetipos"
              icon="git-network-outline"
              color="#4ECDC4"
            />
            <LockedSection
              sectionName="Dream Map"
              dreamThreshold={DREAM_MAP_THRESHOLD}
              totalDreams={totalDreams}
            >
              <View style={styles.sectionCard}>
                <DreamMap nodes={mapData.nodes} edges={mapData.edges} />
              </View>
            </LockedSection>
          </View>,
        )}

        {/* ── 6: Narrative Threads (unlock: 14 dreams) ─────────────────── */}
        {section(
          6,
          <View>
            <SectionHeader
              title="Hilos Narrativos"
              subtitle="Temas que tu subconsciente está procesando"
              icon="git-branch-outline"
              color={Colors.warning}
            />
            <LockedSection
              sectionName="Hilos Narrativos"
              dreamThreshold={THREADS_THRESHOLD}
              totalDreams={totalDreams}
            >
              {loadingThreads ? (
                <View style={[styles.sectionCard, styles.centerContent]}>
                  <Text style={styles.loadingText}>Cargando hilos...</Text>
                </View>
              ) : narrativeThreads && narrativeThreads.threads.length > 0 ? (
                <View style={styles.threadsContainer}>
                  {narrativeThreads.threads.map((thread, i) => (
                    <NarrativeThreadCard key={thread.title + i} thread={thread} index={i} />
                  ))}
                  <Text style={styles.threadsFooter}>
                    Basado en {narrativeThreads.dreamsAnalyzed} sueños
                  </Text>
                </View>
              ) : (
                <View style={[styles.sectionCard, styles.centerContent]}>
                  <Ionicons name="hourglass-outline" size={28} color={Colors.textTertiary} />
                  <Text style={styles.emptyText}>
                    Los hilos narrativos se generan automáticamente cuando completas
                    un nuevo análisis. Regresa pronto.
                  </Text>
                </View>
              )}
            </LockedSection>
          </View>,
        )}

        {/* ── 7: Archetype Radar (unlock: 21 dreams) ───────────────────── */}
        {section(
          7,
          <View>
            <SectionHeader
              title="Perfil Arquetípico"
              subtitle="Frecuencia acumulada de arquetipos junguianos"
              icon="person-outline"
              color={Colors.primary}
            />
            <LockedSection
              sectionName="Perfil Arquetípico"
              dreamThreshold={ARCHETYPE_THRESHOLD}
              totalDreams={totalDreams}
            >
              <View style={styles.sectionCard}>
                <ArchetypeRadar
                  frequencies={archetypeData.frequencies}
                  evolution={archetypeData.evolution}
                />
              </View>
            </LockedSection>
          </View>,
        )}

        {/* ── 8: Portrait (unlock: 50 dreams) ──────────────────────────── */}
        {section(
          8,
          <View>
            <SectionHeader
              title="Retrato del Inconsciente"
              subtitle="Síntesis comprehensiva de tu psique onírica"
              icon="eye-outline"
              color={Colors.warning}
            />
            <LockedSection
              sectionName="Retrato del Inconsciente"
              dreamThreshold={PORTRAIT_THRESHOLD}
              totalDreams={totalDreams}
            >
              <PortraitSection
                portrait={portrait}
                loading={loadingPortrait}
                generating={generatingPortrait}
                error={portraitError}
                totalDreams={totalDreams}
                onGenerate={generatePortrait}
              />
            </LockedSection>
          </View>,
        )}
      </ScrollView>
    </SafeScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xxl,
  },

  // Header
  header: { gap: Spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleCol: { gap: 2, flex: 1 },
  headerLabel: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Ring section
  ringSection: { alignItems: 'center', gap: Spacing.lg },
  // Metrics grid 2×2
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    alignSelf: 'stretch',
  },
  metricCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    minWidth: '45%',
    flex: 1,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  metricValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    lineHeight: 32,
  },
  metricMax: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: FontWeight.medium,
  },
  metricBarTrack: {
    height: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  metricBarFill: { height: '100%', borderRadius: Radius.full },
  metricPct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.5,
  },

  // Bar
  barRow: { gap: 8 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  barValueRow: { flexDirection: 'row', alignItems: 'center' },
  barValue: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  barPct: { fontSize: FontSize.xs, color: Colors.textTertiary },
  barTrack: {
    height: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: Radius.full },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionHeaderText: { gap: 2, flex: 1 },
  sectionTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
  },

  // Streak cards
  streakRow: { flexDirection: 'row', gap: Spacing.md },
  streakCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  streakCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
  },
  streakCardLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  streakRecord: { alignItems: 'center', gap: 1 },
  streakRecordLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  streakRecordValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  freezeBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  freezeText: { fontSize: FontSize.xs, color: Colors.success },
  freezeInfo: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
    paddingHorizontal: 2,
  },
  freezeInfoText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    lineHeight: 17,
    flex: 1,
  },

  // Level card
  levelCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  levelIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTitleCol: { gap: 2 },
  levelName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  levelSubtitle: { fontSize: FontSize.xs, color: Colors.textTertiary },
  levelProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelProgressLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  levelProgressHint: { fontSize: FontSize.xs, color: Colors.textTertiary },
  levelProgressTrack: {
    height: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  levelProgressFill: { height: '100%', borderRadius: Radius.full },
  unlockedTitle: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border },

  // Milestone
  milestoneCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  milestoneNode: { alignItems: 'center', gap: 5, flex: 1 },
  milestoneCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneCount: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  milestoneName: { fontSize: 10, textAlign: 'center', lineHeight: 13 },
  milestoneConnector: { flex: 1, height: 2, marginTop: 13, marginHorizontal: -4 },

  // Insight sections
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  centerContent: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    minHeight: 200,
    justifyContent: 'center',
  },
  loadingText: { fontSize: FontSize.sm, color: Colors.textTertiary },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },

  // Narrative threads
  threadsContainer: { gap: Spacing.md },
  threadsFooter: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Header CTA (empty state)
  headerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: `${Colors.primary}33`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: 'wrap',
  },
  headerCtaText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    minWidth: 160,
  },
  headerCtaBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  headerCtaBtnLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
});

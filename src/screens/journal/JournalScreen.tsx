import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import SafeScreen from '../../components/common/SafeScreen';
import DreamCard from '../../components/journal/DreamCard';
import { useDreamList, DreamListItem, DateRange } from '../../hooks/useDreamList';
import { useEngagement } from '../../hooks/useEngagement';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  MIN_TOUCH,
} from '../../styles/theme';
import { JournalStackParamList } from '../../types';
import { MILESTONES } from '../../config/milestones';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<JournalStackParamList, 'JournalHome'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: 'week', label: '7 días' },
  { key: 'month', label: '1 mes' },
  { key: 'quarter', label: '3 meses' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsHeader({
  totalDreams,
  morningStreak,
  dominantEmotion,
}: {
  totalDreams: number;
  morningStreak: number;
  dominantEmotion: string;
}) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalDreams}</Text>
        <Text style={styles.statLabel}>sueños</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>🔥 {morningStreak}</Text>
        <Text style={styles.statLabel}>racha</Text>
      </View>
      {dominantEmotion ? (
        <>
          <View style={styles.statDivider} />
          <View style={[styles.statItem, { flex: 1.5 }]}>
            <Text style={styles.statValue} numberOfLines={1}>
              {dominantEmotion}
            </Text>
            <Text style={styles.statLabel}>emoción frecuente</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

function EmptyState({
  hasFilters,
  totalDreams,
}: {
  hasFilters: boolean;
  totalDreams: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Si ya hay sueños capturados pero ninguno está 'complete' todavía, mostrar
  // un estado de procesamiento en lugar del onboarding vacío.
  const isProcessingFirst = !hasFilters && totalDreams > 0;

  return (
    <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
      {hasFilters ? (
        <>
          <Ionicons name="search-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyBody}>
            No encontramos sueños con esos filtros.
          </Text>
        </>
      ) : isProcessingFirst ? (
        <>
          <Ionicons name="hourglass-outline" size={56} color={Colors.primary} />
          <Text style={styles.emptyTitle}>
            {totalDreams === 1
              ? 'Tu primer sueño se está procesando'
              : 'Tus sueños se están procesando'}
          </Text>
          <Text style={styles.emptyBody}>
            Estamos transcribiendo y analizando lo que grabaste. Aparecerá aquí
            cuando el análisis termine.
          </Text>
        </>
      ) : (
        <>
          <Ionicons name="moon-outline" size={56} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>
            Tu diario de sueños está esperando
          </Text>
          <Text style={styles.emptyBody}>
            Graba tu primer sueño mañana al despertar. Aparecerá aquí con su
            análisis completo.
          </Text>

          <View style={styles.milestoneRow}>
            {MILESTONES.slice(0, 3).map(({ threshold, shortName }) => (
              <View key={threshold} style={styles.milestonePill}>
                <Text style={styles.milestoneNum}>{threshold}</Text>
                <Text style={styles.milestoneLabel}>{shortName}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function JournalScreen({ navigation }: Props) {
  const {
    dreams,
    loading,
    loadingMore,
    hasMore,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    uniqueEmotions,
    uniqueArchetypes,
    loadMore,
    refresh,
  } = useDreamList();

  const { morningStreak, totalDreams, userDoc } = useEngagement();
  const dominantEmotion = userDoc?.profile?.dominantEmotionLast30 ?? '';

  const [refreshing, setRefreshing] = useState(false);
  const [showArchetypeFilters, setShowArchetypeFilters] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  const navigateToDream = useCallback(
    (dreamId: string) => {
      navigation.navigate('DreamAnalysis', { dreamId });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: DreamListItem }) => (
      <DreamCard item={item} onPress={() => navigateToDream(item.id)} />
    ),
    [navigateToDream],
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }, [loadingMore]);

  const keyExtractor = useCallback((item: DreamListItem) => item.id, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeScreen noPadding>
      {/* ── Sticky Header ───────────────────────────────────────────────── */}
      <View style={styles.stickyHeader}>
        {/* Title */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.label}>Tu historial</Text>
            <Text style={styles.title}>Diario de Sueños</Text>
          </View>
          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={clearFilters}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.clearBtnText}>Limpiar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <StatsHeader
          totalDreams={totalDreams}
          morningStreak={morningStreak}
          dominantEmotion={dominantEmotion}
        />

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar en tus sueños..."
            placeholderTextColor={Colors.textTertiary}
            value={filters.searchQuery}
            onChangeText={text =>
              setFilters(prev => ({ ...prev, searchQuery: text }))
            }
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {filters.searchQuery.length > 0 && Platform.OS === 'android' && (
            <TouchableOpacity
              onPress={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Emotion filter chips */}
        {uniqueEmotions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            <FilterChip
              label="Todas"
              active={!filters.emotion && !filters.archetype && !filters.dateRange}
              onPress={clearFilters}
            />
            {uniqueEmotions.map(emotion => (
              <FilterChip
                key={emotion}
                label={emotion}
                active={filters.emotion === emotion}
                onPress={() =>
                  setFilters(prev => ({
                    ...prev,
                    emotion: prev.emotion === emotion ? null : emotion,
                  }))
                }
              />
            ))}
          </ScrollView>
        )}

        {/* Archetype + date range filters */}
        <View style={styles.secondaryFilters}>
          {/* Date range */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateChipsRow}
          >
            {DATE_RANGES.map(({ key, label }) => (
              <FilterChip
                key={key as string}
                label={label}
                active={filters.dateRange === key}
                small
                onPress={() =>
                  setFilters(prev => ({
                    ...prev,
                    dateRange: prev.dateRange === key ? null : key,
                  }))
                }
              />
            ))}

            {/* Archetype toggle */}
            {uniqueArchetypes.length > 0 && (
              <FilterChip
                label="Arquetipo"
                active={showArchetypeFilters}
                small
                icon={showArchetypeFilters ? 'chevron-up' : 'chevron-down'}
                onPress={() => setShowArchetypeFilters(v => !v)}
              />
            )}
          </ScrollView>
        </View>

        {/* Archetype chips (expandable) */}
        {showArchetypeFilters && uniqueArchetypes.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {uniqueArchetypes.map(arch => (
              <FilterChip
                key={arch}
                label={arch}
                active={filters.archetype === arch}
                small
                onPress={() =>
                  setFilters(prev => ({
                    ...prev,
                    archetype: prev.archetype === arch ? null : arch,
                  }))
                }
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={dreams}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            dreams.length === 0 && styles.listContentEmpty,
          ]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <EmptyState hasFilters={hasActiveFilters} totalDreams={totalDreams} />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeScreen>
  );
}

// ─── FilterChip ───────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  small = false,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  small?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        small && styles.chipSmall,
        active && styles.chipActive,
      ]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.chipText,
          small && styles.chipTextSmall,
          active && styles.chipTextActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {icon && (
        <Ionicons
          name={icon}
          size={12}
          color={active ? Colors.primary : Colors.textTertiary}
          style={{ marginLeft: 3 }}
        />
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  stickyHeader: {
    backgroundColor: Colors.background,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.screen,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    marginBottom: 4,
  },
  clearBtnText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.sm,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: MIN_TOUCH,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    paddingVertical: 0,
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  secondaryFilters: {
    marginTop: -Spacing.xs,
  },
  dateChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    textTransform: 'capitalize',
  },
  chipTextSmall: {
    fontSize: FontSize.xs,
  },
  chipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // List
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.base,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flex: 1,
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
    gap: Spacing.base,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyBody: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 290,
  },
  milestoneRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.sm,
  },
  milestonePill: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  milestoneNum: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  milestoneLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },
});

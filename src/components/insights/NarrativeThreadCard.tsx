import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NarrativeThread } from '../../types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../styles/theme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── Evidence timeline dots ───────────────────────────────────────────────────

function EvidenceTimeline({ evidence }: { evidence: NarrativeThread['evidence'] }) {
  return (
    <View style={styles.timeline}>
      {evidence.map((ev, i) => (
        <View key={`${ev.dreamId}-${i}`} style={styles.timelineItem}>
          <View style={styles.timelineDotWrap}>
            <View style={styles.timelineDot} />
            {i < evidence.length - 1 && <View style={styles.timelineLine} />}
          </View>
          <View style={styles.timelineContent}>
            <Text style={styles.timelineElement}>{ev.element}</Text>
            <Text style={styles.timelineDreamId} numberOfLines={1}>
              sueño #{ev.dreamId.slice(-4)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

interface NarrativeThreadCardProps {
  thread: NarrativeThread;
  index: number;
}

export default function NarrativeThreadCard({
  thread,
  index,
}: NarrativeThreadCardProps) {
  const [expanded, setExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded(v => !v);
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Color cycling for thread cards
  const THREAD_COLORS = [Colors.primary, Colors.warning, Colors.success, Colors.error];
  const accentColor = THREAD_COLORS[index % THREAD_COLORS.length];

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      {/* Header — always visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.75}
      >
        <View style={styles.headerLeft}>
          <View
            style={[styles.threadIcon, { backgroundColor: `${accentColor}22` }]}
          >
            <Ionicons name="git-commit-outline" size={14} color={accentColor} />
          </View>
          <Text style={[styles.threadTitle, { color: accentColor }]}>
            {thread.title}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
        </Animated.View>
      </TouchableOpacity>

      {/* Summary — always visible */}
      <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
        {thread.description}
      </Text>

      {/* Expanded content */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Evidence timeline */}
          <Text style={styles.sectionLabel}>Evidencia</Text>
          <EvidenceTimeline evidence={thread.evidence} />

          {/* Jungian compensation */}
          <View style={styles.insightBlock}>
            <View style={styles.insightLabelRow}>
              <Ionicons name="infinite-outline" size={13} color={Colors.primary} />
              <Text style={styles.insightLabel}>Compensación junguiana</Text>
            </View>
            <Text style={styles.insightText}>{thread.jungian_compensation}</Text>
          </View>

          {/* Recommendation */}
          <View style={[styles.insightBlock, { backgroundColor: `${Colors.success}11` }]}>
            <View style={styles.insightLabelRow}>
              <Ionicons name="leaf-outline" size={13} color={Colors.success} />
              <Text style={[styles.insightLabel, { color: Colors.success }]}>
                Recomendación
              </Text>
            </View>
            <Text style={styles.insightText}>{thread.recommendation}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  threadIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    flex: 1,
    textTransform: 'capitalize',
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  expandedContent: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: FontWeight.semibold,
  },

  // Timeline
  timeline: {
    gap: 0,
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  timelineDotWrap: {
    alignItems: 'center',
    width: 12,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 5,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.sm,
  },
  timelineElement: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
    textTransform: 'capitalize',
  },
  timelineDreamId: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },

  // Insight blocks
  insightBlock: {
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
  },
  insightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  insightLabel: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});

import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ArchetypeFrequency, ArchetypeWeekPoint } from '../../hooks/useDreamPatterns';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../styles/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS = 260;
const CX = CANVAS / 2;
const CY = CANVAS / 2;
const CENTER_R = 18;   // center circle radius
const BAR_MAX = 82;    // max bar length in points
const BAR_H = 9;       // bar height

// ─── Animated bar (single spoke) ─────────────────────────────────────────────

interface SpokeProps {
  index: number;
  total: number;
  barLength: number;
  color: string;
  label: string;
  isDominant: boolean;
}

function Spoke({ index, total, barLength, color, label, isDominant }: SpokeProps) {
  const lengthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(lengthAnim, {
      toValue: barLength,
      duration: 1000,
      delay: 200 + index * 80,
      useNativeDriver: false,
    }).start();
  }, [barLength]);

  // Angle: distribute evenly starting from top (-π/2), clockwise
  const angleDeg = (index / total) * 360;
  const angleRad = (angleDeg * Math.PI) / 180;

  // Bar center position along the spoke direction (origin = canvas center)
  // sin for X (screen), -cos for Y (screen coordinates: +Y is down)
  // We offset by CENTER_R so bar starts at edge of center circle
  const distance = CENTER_R + barLength / 2;
  const bx = CX + distance * Math.sin(angleRad) - barLength / 2;
  const by = CY - distance * Math.cos(angleRad) - BAR_H / 2;

  // Label position: beyond bar end
  const LABEL_GAP = 10;
  const labelDist = CENTER_R + barLength + LABEL_GAP;
  const lx = CX + labelDist * Math.sin(angleRad);
  const ly = CY - labelDist * Math.cos(angleRad);

  // Text alignment based on angle quadrant
  const textAlign =
    Math.abs(angleDeg % 360 - 180) < 20
      ? 'center'
      : Math.sin(angleRad) > 0.2
      ? 'left'
      : Math.sin(angleRad) < -0.2
      ? 'right'
      : 'center';

  return (
    <>
      {/* Bar */}
      <Animated.View
        style={[
          styles.bar,
          {
            left: bx,
            top: by,
            width: lengthAnim,
            height: BAR_H,
            backgroundColor: color,
            opacity: isDominant ? 1 : 0.6,
            borderRadius: BAR_H / 2,
            transform: [{ rotate: `${angleDeg - 90}deg` }],
          },
        ]}
      />

      {/* Label */}
      <Text
        style={[
          styles.spokeLabel,
          {
            position: 'absolute',
            left: lx - 36,
            top: ly - 10,
            width: 72,
            textAlign,
            color: isDominant ? color : Colors.textTertiary,
            fontWeight: isDominant ? FontWeight.semibold : FontWeight.regular,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );
}

// ─── Evolution bar chart (week timeline) ─────────────────────────────────────

function EvolutionChart({
  evolution,
}: {
  evolution: ArchetypeWeekPoint[];
  colors: Record<string, string>;
}) {
  if (evolution.length === 0) return null;

  return (
    <View style={styles.evolutionContainer}>
      <Text style={styles.evolutionLabel}>Evolución por semana</Text>
      <ScrollableEvolution data={evolution} />
    </View>
  );
}

function ScrollableEvolution({ data }: { data: ArchetypeWeekPoint[] }) {
  return (
    <View style={styles.evolutionTrack}>
      {data.map((point, i) => (
        <View key={point.week} style={styles.evolutionPoint}>
          <View style={[styles.evolutionDot, { opacity: 0.4 + (i / data.length) * 0.6 }]} />
          <Text style={styles.evolutionArchetype} numberOfLines={1}>
            {point.dominant}
          </Text>
          <Text style={styles.evolutionWeek}>{point.week.split('-')[1]}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ArchetypeRadarProps {
  frequencies: ArchetypeFrequency[];
  evolution: ArchetypeWeekPoint[];
}

export default function ArchetypeRadar({
  frequencies,
  evolution,
}: ArchetypeRadarProps) {
  if (frequencies.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Los arquetipos aparecerán aquí conforme completes más análisis.
        </Text>
      </View>
    );
  }

  const maxFreq = Math.max(...frequencies.map(f => f.frequency), 1);
  const dominant = frequencies[0];
  const colorMap: Record<string, string> = {};
  for (const f of frequencies) colorMap[f.name] = f.color;

  return (
    <View style={styles.container}>
      {/* Radar */}
      <View style={[styles.canvas, { width: CANVAS, height: CANVAS }]}>
        {/* Center circle */}
        <View
          style={[
            styles.centerCircle,
            {
              left: CX - CENTER_R,
              top: CY - CENTER_R,
              width: CENTER_R * 2,
              height: CENTER_R * 2,
              borderRadius: CENTER_R,
            },
          ]}
        />

        {/* Spokes */}
        {frequencies.map((arch, i) => {
          const barLength = (arch.frequency / maxFreq) * BAR_MAX;
          return (
            <Spoke
              key={arch.name}
              index={i}
              total={frequencies.length}
              barLength={barLength}
              color={arch.color}
              label={arch.name}
              isDominant={i === 0}
            />
          );
        })}
      </View>

      {/* Dominant archetype callout */}
      <View style={[styles.dominantCard, { borderColor: dominant.color }]}>
        <View style={[styles.dominantDot, { backgroundColor: dominant.color }]} />
        <View style={styles.dominantInfo}>
          <Text style={[styles.dominantName, { color: dominant.color }]}>
            {dominant.name}
          </Text>
          <Text style={styles.dominantSub}>Arquetipo dominante</Text>
        </View>
        <Text style={[styles.dominantCount, { color: dominant.color }]}>
          {dominant.frequency} sueños
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.legendGrid}>
        {frequencies.map((arch, i) => (
          <View key={arch.name} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: arch.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {arch.name}
            </Text>
            <Text style={[styles.legendFreq, { color: arch.color }]}>
              {arch.frequency}
            </Text>
          </View>
        ))}
      </View>

      {/* Evolution */}
      {evolution.length > 1 && (
        <EvolutionChart evolution={evolution} colors={colorMap} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.base,
  },
  canvas: {
    position: 'relative',
  },
  bar: {
    position: 'absolute',
  },
  centerCircle: {
    position: 'absolute',
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  spokeLabel: {
    fontSize: 9,
    textTransform: 'capitalize',
  },

  // Dominant
  dominantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Spacing.md,
    alignSelf: 'stretch',
  },
  dominantDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.85,
  },
  dominantInfo: { flex: 1 },
  dominantName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    textTransform: 'capitalize',
  },
  dominantSub: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  dominantCount: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // Legend
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignSelf: 'stretch',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    width: '46%',
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendName: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
    textTransform: 'capitalize',
  },
  legendFreq: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },

  // Evolution
  evolutionContainer: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
  },
  evolutionLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: FontWeight.semibold,
  },
  evolutionTrack: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  evolutionPoint: {
    alignItems: 'center',
    gap: 3,
    minWidth: 44,
  },
  evolutionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  evolutionArchetype: {
    fontSize: 8,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
    textAlign: 'center',
    maxWidth: 44,
  },
  evolutionWeek: {
    fontSize: 7,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Empty
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
});

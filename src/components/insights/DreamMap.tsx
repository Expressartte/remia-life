import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MapNode, MapEdge } from '../../hooks/useDreamPatterns';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../styles/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS = 300;
const CX = CANVAS / 2;
const CY = CANVAS / 2;

const RING_RADII = {
  archetype: 52,
  emotion: 108,
  symbol: 138,
};

const NODE_COLORS = {
  archetype: Colors.primary,
  emotion: '#FF6B6B',
  symbol: Colors.success,
};

const NODE_MIN = 22;
const NODE_MAX = 44;

// ─── Layout computation ───────────────────────────────────────────────────────

interface PositionedNode extends MapNode {
  x: number;
  y: number;
  size: number;
  color: string;
}

function computePositions(nodes: MapNode[]): PositionedNode[] {
  const byType: Record<string, MapNode[]> = {
    archetype: [],
    emotion: [],
    symbol: [],
  };

  for (const n of nodes) byType[n.type]?.push(n);

  const allPositioned: PositionedNode[] = [];

  for (const type of ['archetype', 'emotion', 'symbol'] as const) {
    const group = byType[type];
    if (!group.length) continue;

    const r = RING_RADII[type];
    const maxFreq = Math.max(...group.map(n => n.frequency), 1);

    group.forEach((node, i) => {
      // Start from top (-π/2) and go clockwise
      const angle = (i / group.length) * 2 * Math.PI - Math.PI / 2;
      const size =
        NODE_MIN + ((node.frequency / maxFreq) * (NODE_MAX - NODE_MIN));

      allPositioned.push({
        ...node,
        x: CX + r * Math.cos(angle),
        y: CY + r * Math.sin(angle),
        size,
        color: NODE_COLORS[type],
      });
    });
  }

  return allPositioned;
}

// ─── Edge component ───────────────────────────────────────────────────────────

function Edge({
  x1,
  y1,
  x2,
  y2,
  weight,
  maxWeight,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  weight: number;
  maxWeight: number;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 1) return null;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const cx = (x1 + x2) / 2;
  const cy2 = (y1 + y2) / 2;
  const opacity = 0.15 + (weight / maxWeight) * 0.45;

  return (
    <View
      style={[
        styles.edge,
        {
          left: cx - length / 2,
          top: cy2 - 0.75,
          width: length,
          opacity,
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    />
  );
}

// ─── Node component ───────────────────────────────────────────────────────────

function MapNodeView({
  node,
  onPress,
}: {
  node: PositionedNode;
  onPress: () => void;
}) {
  const { size, color, x, y, label } = node;
  return (
    <TouchableOpacity
      style={[
        styles.node,
        {
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${color}22`,
          borderColor: color,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.nodeLabel, { color, fontSize: size < 30 ? 7 : 8 }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <View style={styles.legend}>
      {(
        [
          { label: 'Arquetipos', color: NODE_COLORS.archetype },
          { label: 'Emociones', color: NODE_COLORS.emotion },
          { label: 'Símbolos', color: NODE_COLORS.symbol },
        ] as { label: string; color: string }[]
      ).map(({ label, color }) => (
        <View key={label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: color }]} />
          <Text style={styles.legendLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  node: MapNode | null;
  onClose: () => void;
}

function DetailModal({ node, onClose }: DetailModalProps) {
  if (!node) return null;
  const typeLabels = {
    symbol: 'Símbolo',
    emotion: 'Emoción',
    archetype: 'Arquetipo',
  };
  const color = NODE_COLORS[node.type];

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.modalTypeBadge, { backgroundColor: `${color}22` }]}>
              <Text style={[styles.modalTypeText, { color }]}>
                {typeLabels[node.type]}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.modalTitle, { color }]}>{node.label}</Text>
          <Text style={styles.modalSubtitle}>
            Aparece en {node.frequency}{' '}
            {node.frequency === 1 ? 'sueño' : 'sueños'}
          </Text>

          <View style={styles.modalDivider} />

          <Text style={styles.modalDreamsLabel}>Sueños donde aparece:</Text>
          <ScrollView style={styles.modalDreamsList}>
            {node.dreamIds.map((id, i) => (
              <View key={id} style={styles.modalDreamRow}>
                <Ionicons name="moon-outline" size={13} color={Colors.textTertiary} />
                <Text style={styles.modalDreamId}>Sueño {i + 1}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DreamMapProps {
  nodes: MapNode[];
  edges: MapEdge[];
}

export default function DreamMap({ nodes, edges }: DreamMapProps) {
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);

  const positioned = useMemo(() => computePositions(nodes), [nodes]);

  const posMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of positioned) m.set(n.id, { x: n.x, y: n.y });
    return m;
  }, [positioned]);

  const maxWeight = useMemo(
    () => Math.max(...edges.map(e => e.weight), 1),
    [edges],
  );

  if (nodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="git-network-outline" size={36} color={Colors.textTertiary} />
        <Text style={styles.emptyText}>
          Analizando patrones... Regresa después de que la IA complete más sueños.
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.canvas}>
        {/* Edges */}
        {edges.map(edge => {
          const src = posMap.get(edge.sourceId);
          const tgt = posMap.get(edge.targetId);
          if (!src || !tgt) return null;
          return (
            <Edge
              key={`${edge.sourceId}||${edge.targetId}`}
              x1={src.x}
              y1={src.y}
              x2={tgt.x}
              y2={tgt.y}
              weight={edge.weight}
              maxWeight={maxWeight}
            />
          );
        })}

        {/* Nodes */}
        {positioned.map(node => (
          <MapNodeView
            key={node.id}
            node={node}
            onPress={() => setSelectedNode(node)}
          />
        ))}
      </View>

      <Legend />

      <DetailModal
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  canvas: {
    width: CANVAS,
    height: CANVAS,
    alignSelf: 'center',
    position: 'relative',
  },
  edge: {
    position: 'absolute',
    height: 1.5,
    backgroundColor: Colors.primary,
  },
  node: {
    position: 'absolute',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  nodeLabel: {
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
    lineHeight: 10,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.base,
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  emptyContainer: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    paddingBottom: 40,
    gap: Spacing.sm,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  modalTypeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    textTransform: 'capitalize',
    marginTop: 4,
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  modalDreamsLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  modalDreamsList: {
    maxHeight: 120,
  },
  modalDreamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  modalDreamId: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
});

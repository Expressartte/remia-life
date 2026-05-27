import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PortraitDoc } from '../../types';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../styles/theme';

// ─── Section configs ──────────────────────────────────────────────────────────

interface SectionConfig {
  key: keyof PortraitDoc['sections'];
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}

const SECTION_CONFIGS: SectionConfig[] = [
  { key: 'emotional_pattern',        title: 'Patrón Emocional',           icon: 'heart-outline',      color: '#FF6B6B' },
  { key: 'dominant_archetypes',      title: 'Arquetipos Dominantes',      icon: 'person-outline',     color: Colors.primary },
  { key: 'active_conflicts',         title: 'Conflictos Activos',         icon: 'git-pull-request-outline', color: Colors.warning },
  { key: 'defense_mechanisms',       title: 'Mecanismos de Defensa',      icon: 'shield-outline',     color: '#4ECDC4' },
  { key: 'psychic_progress',         title: 'Progreso Psíquico',          icon: 'trending-up-outline', color: '#A8E6CF' },
  { key: 'long_term_recommendations', title: 'Recomendaciones',           icon: 'compass-outline',    color: '#FFD166' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PortraitSectionBlock({
  config,
  content,
}: {
  config: SectionConfig;
  content: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const MAX_CHARS = 220;
  const isLong = content.length > MAX_CHARS;

  return (
    <View style={[styles.sectionBlock, { borderLeftColor: config.color }]}>
      <View style={styles.sectionHeader}>
        <View
          style={[styles.sectionIconWrap, { backgroundColor: `${config.color}22` }]}
        >
          <Ionicons name={config.icon} size={14} color={config.color} />
        </View>
        <Text style={[styles.sectionTitle, { color: config.color }]}>
          {config.title}
        </Text>
      </View>
      <Text style={styles.sectionContent} numberOfLines={expanded || !isLong ? undefined : 4}>
        {content}
      </Text>
      {isLong && (
        <TouchableOpacity
          onPress={() => setExpanded(v => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.readMore, { color: config.color }]}>
            {expanded ? 'Leer menos ↑' : 'Leer más ↓'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PortraitSectionProps {
  portrait: PortraitDoc | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  totalDreams: number;
  onGenerate: () => void;
}

export default function PortraitSection({
  portrait,
  loading,
  generating,
  error,
  totalDreams,
  onGenerate,
}: PortraitSectionProps) {
  const handleShare = async () => {
    if (!portrait) return;
    const text = SECTION_CONFIGS.map(cfg => {
      const content = portrait.sections[cfg.key] ?? '';
      return `## ${cfg.title}\n${content}`;
    }).join('\n\n');

    await Share.share({
      title: 'Retrato del Inconsciente — Remia',
      message: `RETRATO DEL INCONSCIENTE\nAnalizado a partir de ${portrait.dreamsAnalyzed} sueños\n\n${text}`,
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!portrait) {
    return (
      <View style={styles.generateContainer}>
        <View style={styles.generateIcon}>
          <Ionicons name="eye-outline" size={32} color={Colors.warning} />
        </View>
        <Text style={styles.generateTitle}>Retrato del Inconsciente</Text>
        <Text style={styles.generateBody}>
          La IA sintetizará todos tus {totalDreams} sueños en un informe psicológico
          comprehensivo: patrones emocionales, arquetipos dominantes, conflictos
          subconscientes y recomendaciones de largo plazo.
        </Text>
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
        <TouchableOpacity
          style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
          onPress={onGenerate}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="sparkles-outline" size={16} color="#fff" />
          )}
          <Text style={styles.generateBtnText}>
            {generating ? 'Generando tu retrato...' : 'Generar Retrato'}
          </Text>
        </TouchableOpacity>
        {generating && (
          <Text style={styles.generatingHint}>
            Esto puede tomar hasta 30 segundos
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.portraitContainer}>
      {/* Meta header */}
      <View style={styles.portraitMeta}>
        <View style={styles.portraitMetaLeft}>
          <Text style={styles.portraitMetaTitle}>Retrato completado</Text>
          <Text style={styles.portraitMetaSub}>
            {portrait.dreamsAnalyzed} sueños analizados
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleShare}
          style={styles.shareBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="share-outline" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* All sections */}
      {SECTION_CONFIGS.map(cfg => (
        <PortraitSectionBlock
          key={cfg.key}
          config={cfg}
          content={portrait.sections[cfg.key] ?? ''}
        />
      ))}

      {/* Regenerate */}
      <TouchableOpacity
        style={styles.regenBtn}
        onPress={onGenerate}
        disabled={generating}
        activeOpacity={0.7}
      >
        {generating ? (
          <ActivityIndicator size="small" color={Colors.textTertiary} />
        ) : (
          <Ionicons name="refresh-outline" size={14} color={Colors.textTertiary} />
        )}
        <Text style={styles.regenText}>
          {generating ? 'Actualizando...' : 'Actualizar retrato'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centerContainer: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },

  // Generate state
  generateContainer: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  generateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 209, 102, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  generateTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  generateBody: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    textAlign: 'center',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 13,
    marginTop: Spacing.sm,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: '#fff',
  },
  generatingHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },

  // Portrait display
  portraitContainer: {
    gap: Spacing.md,
  },
  portraitMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  portraitMetaLeft: { gap: 2 },
  portraitMetaTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  portraitMetaSub: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBlock: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  readMore: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  regenText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
});

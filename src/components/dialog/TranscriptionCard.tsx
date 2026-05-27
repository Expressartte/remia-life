import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../styles/theme';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TranscriptionCardProps {
  text: string;
  onEdit: (text: string) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function TranscriptionCard({ text, onEdit }: TranscriptionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const chevronAnim = useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const expanding = !isExpanded;
    setIsExpanded(expanding);
    if (!expanding) setIsEditing(false);
    Animated.timing(chevronAnim, {
      toValue: expanding ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const handleSaveEdit = () => {
    onEdit(editText.trim() || text);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(text);
    setIsEditing(false);
  };

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Mostrar preview del texto (primeras 80 chars)
  const previewText = text.length > 80 ? `${text.slice(0, 80)}...` : text;

  return (
    <View style={styles.card}>
      {/* Header colapsable */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpand}
        activeOpacity={0.75}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="document-text-outline" size={15} color={Colors.secondary} />
          <Text style={styles.headerLabel}>Tu sueño</Text>
        </View>
        <View style={styles.headerRight}>
          {!isExpanded && (
            <Text style={styles.previewText} numberOfLines={1}>
              {previewText}
            </Text>
          )}
          <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
            <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Contenido expandido */}
      {isExpanded && (
        <View style={styles.body}>
          <View style={styles.divider} />

          {isEditing ? (
            <>
              <TextInput
                style={styles.textInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
                textAlignVertical="top"
                selectionColor={Colors.primary}
                placeholderTextColor={Colors.textTertiary}
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelEdit}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelLabel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveEdit}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark" size={14} color={Colors.textOnPrimary} />
                  <Text style={styles.saveLabel}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.transcriptionText}>{text}</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditing(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="pencil-outline" size={13} color={Colors.textTertiary} />
                <Text style={styles.editLabel}>Corregir errores de transcripción</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.screen,
    marginBottom: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.secondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  previewText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    flex: 1,
    textAlign: 'right',
  },

  // Body
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  transcriptionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  editLabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },

  // Edición
  textInput: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: 10,
    minHeight: 100,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  saveLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
});

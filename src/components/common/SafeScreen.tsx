import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../styles/theme';

interface SafeScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Deshabilita el padding horizontal estándar */
  noPadding?: boolean;
}

/**
 * Wrapper estándar para todas las pantallas.
 * Garantiza safe areas y fondo consistente.
 */
export default function SafeScreen({
  children,
  style,
  noPadding = false,
}: SafeScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={[styles.content, !noPadding && styles.padding, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  padding: {
    paddingHorizontal: 24,
  },
});

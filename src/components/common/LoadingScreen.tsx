import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight } from '../../styles/theme';

/**
 * Pantalla de carga inicial mientras Firebase Auth resuelve el estado de sesión.
 */
export default function LoadingScreen() {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.logo, { opacity: pulse }]}>
        remia
      </Animated.Text>
      <Text style={styles.tagline}>descifrando tus sueños</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    letterSpacing: 2,
  },
});

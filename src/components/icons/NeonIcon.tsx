import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors, Radius, Shadow } from '../../styles/theme';

interface NeonIconProps {
  children: React.ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
  containerColor?: string;
  glowColor?: string;
  noBackground?: boolean;
}

/**
 * Contenedor para iconos neón.
 * Simula el fondo oscuro con esquinas redondeadas y un brillo sutil,
 * idéntico a la referencia visual.
 */
export default function NeonIcon({
  children,
  size = 120,
  style,
  containerColor = '#0b0c16', // Muy oscuro, casi negro, con toque frío
  glowColor, // Si se provee, el contenedor en sí emitirá un pequeño brillo
  noBackground = false,
}: NeonIconProps) {
  const containerStyle = [
    styles.container,
    {
      width: size,
      height: size,
      borderRadius: size * 0.25, // Esquinas suavemente redondeadas
    },
    !noBackground && {
      backgroundColor: containerColor,
      borderColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
    },
    glowColor && !noBackground && {
      shadowColor: glowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 8,
    },
    style,
  ];

  return (
    <View style={containerStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible', // Permite que los destellos/sombras salgan
  },
});

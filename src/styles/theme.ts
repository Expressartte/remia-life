import { StyleSheet } from 'react-native';

// ─── Color Palette ────────────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds
  background: '#0D0D1A',
  surface: '#1A1A2E',
  surfaceElevated: '#252540',
  surfaceHighlight: '#2E2E50',

  // Brand
  primary: '#6C63FF',
  primaryLight: '#8B84FF',
  primaryDim: 'rgba(108, 99, 255, 0.15)',
  secondary: '#E8D5B7',
  secondaryDim: 'rgba(232, 213, 183, 0.12)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8B8B9E',
  textTertiary: '#4A4A6A',
  textOnPrimary: '#FFFFFF',

  // States
  error: '#FF6B6B',
  errorDim: 'rgba(255, 107, 107, 0.15)',
  success: '#4ECDC4',
  successDim: 'rgba(78, 205, 196, 0.15)',
  warning: '#FFD166',

  // Structure
  border: '#2A2A4A',
  borderLight: '#3A3A5C',
  overlay: 'rgba(13, 13, 26, 0.85)',
  transparent: 'transparent',
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
  display: 48,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  screen: 24, // horizontal padding estándar de pantalla
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const;

// ─── Constraints de accesibilidad ────────────────────────────────────────────

export const MIN_TOUCH = 44;

// ─── Shadows (para elevación en Android y iOS) ───────────────────────────────

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

// ─── Estilos globales reutilizables ───────────────────────────────────────────

export const GlobalStyles = StyleSheet.create({
  flex1: { flex: 1 },
  screenBackground: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textPrimary: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    fontWeight: FontWeight.regular,
  },
  textSecondary: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.base,
  },
});

// ─── Tema de React Navigation ─────────────────────────────────────────────────

export const NavigationTheme = {
  dark: true,
  colors: {
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
    notification: Colors.primary,
  },
};

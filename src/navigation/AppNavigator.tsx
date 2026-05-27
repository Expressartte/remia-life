import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { NavigationTheme } from '../styles/theme';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import LoadingScreen from '../components/common/LoadingScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';

/**
 * Raíz del sistema de navegación.
 * Alterna entre AuthNavigator y MainNavigator según el estado de autenticación.
 * Muestra LoadingScreen mientras Firebase Auth resuelve la sesión persistida.
 * Muestra OnboardingScreen la primera vez que el usuario inicia sesión.
 */
export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { showOnboarding, completeOnboarding, checked } = useOnboarding();

  if (loading || !checked) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer theme={NavigationTheme}>
      {user ? (
        <View style={{ flex: 1 }}>
          <MainNavigator />
          {showOnboarding && (
            <OnboardingScreen onComplete={completeOnboarding} />
          )}
        </View>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

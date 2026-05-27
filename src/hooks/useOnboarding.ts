import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './useAuth';

const ONBOARDING_KEY = 'remia_onboarding_done';

/**
 * Gestiona si el usuario ya completó el onboarding.
 * Persiste el flag en AsyncStorage por usuarioId para que
 * funcione correctamente si varias cuentas usan el mismo dispositivo.
 */
export function useOnboarding() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setShowOnboarding(false);
      setChecked(true);
      return;
    }

    const key = `${ONBOARDING_KEY}_${user.uid}`;

    AsyncStorage.getItem(key)
      .then((value) => {
        // Mostrar onboarding solo si no ha sido completado antes
        setShowOnboarding(value !== 'done');
      })
      .catch(() => {
        // Si no se puede leer, no bloquear la app
        setShowOnboarding(false);
      })
      .finally(() => setChecked(true));
  }, [user]);

  const completeOnboarding = async () => {
    if (!user) return;
    const key = `${ONBOARDING_KEY}_${user.uid}`;
    try {
      await AsyncStorage.setItem(key, 'done');
    } catch {
      // ignorar errores de escritura — no es crítico
    }
    setShowOnboarding(false);
  };

  return { showOnboarding, completeOnboarding, checked };
}

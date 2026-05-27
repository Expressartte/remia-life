import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { syncUserDocument } from '../services/userService';

interface AuthState {
  user: User | null;
  loading: boolean;
}

/**
 * Hook central de autenticación.
 * Escucha cambios en el estado de Firebase Auth y garantiza
 * que el documento de usuario exista en Firestore en cada sesión.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Crea o actualiza el documento de usuario de forma transparente
        try {
          await syncUserDocument(firebaseUser);
        } catch (error) {
          // No bloqueamos el login si falla la sincronización de Firestore
          console.warn('[useAuth] syncUserDocument failed:', error);
        }
      }
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
}

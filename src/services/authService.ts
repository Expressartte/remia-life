import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';

// ─── Email / Password ─────────────────────────────────────────────────────────

export const signInWithEmail = (
  email: string,
  password: string
): Promise<UserCredential> => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const registerWithEmail = async (
  email: string,
  password: string,
  displayName: string
): Promise<UserCredential> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  return result;
};

// ─── Google ───────────────────────────────────────────────────────────────────

/** Para móvil nativo: usa idToken de expo-auth-session */
export const signInWithGoogle = (idToken: string): Promise<UserCredential> => {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
};

/** Para web: usa popup nativo de Firebase (no requiere Client ID en .env) */
export const signInWithGooglePopup = async (): Promise<UserCredential> => {
  const { signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
};

// ─── Apple ────────────────────────────────────────────────────────────────────

export const signInWithApple = (
  idToken: string,
  rawNonce: string
): Promise<UserCredential> => {
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken, rawNonce });
  return signInWithCredential(auth, credential);
};

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export const signOut = (): Promise<void> => {
  return firebaseSignOut(auth);
};

// ─── Reset Password ───────────────────────────────────────────────────────────

export const resetPassword = (email: string): Promise<void> => {
  return sendPasswordResetEmail(auth, email);
};

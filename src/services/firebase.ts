import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  Auth,
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { Functions, getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Garantiza inicialización única (hot reload en desarrollo puede re-ejecutar este módulo)
const isFirstInit = getApps().length === 0;
const app: FirebaseApp = isFirstInit ? initializeApp(firebaseConfig) : getApp();

// En web usamos browserLocalPersistence; en native usamos AsyncStorage
const persistence =
  Platform.OS === 'web'
    ? browserLocalPersistence
    : getReactNativePersistence(AsyncStorage);

// initializeAuth solo puede llamarse una vez; en reinicios usa getAuth
export const auth: Auth = isFirstInit
  ? initializeAuth(app, { persistence })
  : getAuth(app);

export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app, 'us-central1');

export default app;

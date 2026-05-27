import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Animated,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';

import NeonIcon from '../../components/icons/NeonIcon';
import { CrescentMoonIcon } from '../../components/icons/MysticalIcons';

import {
  signInWithEmail,
  registerWithEmail,
  signInWithGoogle,
  signInWithGooglePopup,
  signInWithApple,
  resetPassword,
} from '../../services/authService';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  Radius,
  MIN_TOUCH,
} from '../../styles/theme';
import { AuthMode } from '../../types';

// Requerido por expo-auth-session para cerrar el browser en iOS
WebBrowser.maybeCompleteAuthSession();

// ─── Mapeo de errores de Firebase → mensajes en español ──────────────────────

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/user-not-found': 'No existe una cuenta con este email.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/email-already-in-use': 'Este email ya tiene una cuenta registrada.',
  'auth/invalid-email': 'El formato del email no es válido.',
  'auth/weak-password': 'La contraseña es muy débil (mínimo 8 caracteres).',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos.',
  'auth/network-request-failed': 'Sin conexión a internet. Revisa tu red.',
  'auth/operation-not-allowed': 'Este método de inicio de sesión no está habilitado.',
};

const getErrorMessage = (code: string): string =>
  FIREBASE_ERRORS[code] ?? 'Ocurrió un error inesperado. Intenta de nuevo.';

// ─── Subcomponente Google Button ──────────────────────────────────────────────
import * as Google from 'expo-auth-session/providers/google';

interface GoogleButtonProps {
  loading: boolean;
  onCredential: (idToken: string) => void;
  onError: (msg: string) => void;
  onWebSignIn: () => void;
}

function GoogleSignInButton({ loading, onCredential, onError, onWebSignIn }: GoogleButtonProps) {
  // En web usamos popup directo — no necesitamos expo-auth-session
  if (Platform.OS === 'web') {
    return (
      <TouchableOpacity
        style={styles.socialButton}
        onPress={onWebSignIn}
        disabled={loading}
        activeOpacity={0.75}
      >
        <Text style={styles.socialIcon}>G</Text>
        <Text style={styles.socialLabel}>Google</Text>
      </TouchableOpacity>
    );
  }

  // Móvil: flujo OAuth con expo-auth-session
  const [, response, promptAsync] = Google.useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) onCredential(idToken);
    } else if (response?.type === 'error') {
      onError('Error al conectar con Google. Intenta de nuevo.');
    }
  }, [response]);

  return (
    <TouchableOpacity
      style={styles.socialButton}
      onPress={() => promptAsync()}
      disabled={loading}
      activeOpacity={0.75}
    >
      <Text style={styles.socialIcon}>G</Text>
      <Text style={styles.socialLabel}>Google</Text>
    </TouchableOpacity>
  );
}

// ─── Constantes Google ────────────────────────────────────────────────────────
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
// En web siempre habilitamos Google (usa popup directo sin Client ID en .env)
const GOOGLE_ENABLED = Platform.OS === 'web' || !!(GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID);

// ─── Modal de recuperación de contraseña ─────────────────────────────────────

interface ForgotPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  prefillEmail?: string;
}

function ForgotPasswordModal({ visible, onClose, prefillEmail = '' }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState(prefillEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Sincronizar email si viene prellenado
  useEffect(() => {
    if (visible) {
      setEmail(prefillEmail);
      setSent(false);
      setError('');
    }
  }, [visible, prefillEmail]);

  const handleSend = async () => {
    setError('');
    if (!email.trim()) {
      setError('Por favor ingresa tu email.');
      return;
    }
    // Validación básica de formato
    if (!email.includes('@') || !email.includes('.')) {
      setError('El formato del email no es válido.');
      return;
    }
    try {
      setLoading(true);
      await resetPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      console.log('[ForgotPassword] Firebase error code:', e.code, e.message);
      if (
        e.code === 'auth/user-not-found' ||
        e.code === 'auth/invalid-email' ||
        e.code === 'auth/missing-email'
      ) {
        setError('No existe ninguna cuenta con ese email. ¿Usaste otro para registrarte?');
      } else if (e.code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espera unos minutos e intenta de nuevo.');
      } else {
        setError(`Error: ${e.message ?? e.code ?? 'Intenta de nuevo.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          {/* Header */}
          <View style={modalStyles.header}>
            <View style={modalStyles.iconCircle}>
              <Ionicons name="lock-open-outline" size={24} color={Colors.primary} />
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {sent ? (
            // ── Estado: email enviado ──────────────────────────────────────
            <>
              <Text style={modalStyles.title}>¡Revisa tu correo!</Text>
              <Text style={modalStyles.subtitle}>
                Enviamos un enlace de recuperación a:{'\n'}
                <Text style={modalStyles.emailHighlight}>{email}</Text>
              </Text>
              <View style={modalStyles.spamBox}>
                <Ionicons name="warning-outline" size={14} color={Colors.warning} />
                <Text style={modalStyles.spamText}>
                  Si no lo ves en bandeja de entrada, revisa{' '}
                  <Text style={{ fontWeight: FontWeight.semibold }}>Spam</Text> o{' '}
                  <Text style={{ fontWeight: FontWeight.semibold }}>Correo no deseado</Text>.{'\n'}
                  Remitente: <Text style={{ color: Colors.textSecondary }}>noreply@ubuntu-coliving.firebaseapp.com</Text>
                </Text>
              </View>
              <TouchableOpacity style={modalStyles.primaryBtn} onPress={onClose}>
                <Text style={modalStyles.primaryBtnLabel}>Entendido</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setSent(false); setEmail(''); }}
                style={modalStyles.cancelBtn}
              >
                <Text style={modalStyles.cancelLabel}>Intentar con otro email</Text>
              </TouchableOpacity>
            </>
          ) : (
            // ── Estado: formulario ────────────────────────────────────────
            <>
              <Text style={modalStyles.title}>Recuperar contraseña</Text>
              <Text style={modalStyles.subtitle}>
                Ingresa tu email y te enviaremos un enlace para crear una nueva contraseña.
              </Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={Colors.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Tu email"
                  placeholderTextColor={Colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  autoFocus
                />
              </View>

              {error !== '' && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={14} color={Colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[modalStyles.primaryBtn, loading && styles.buttonDisabled]}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                ) : (
                  <Text style={modalStyles.primaryBtnLabel}>Enviar enlace</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
                <Text style={modalStyles.cancelLabel}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Componente principal AuthScreen ─────────────────────────────────────────

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: isHovered ? 1.02 : 1, useNativeDriver: true }).start();
  };
  const handleHoverIn = () => {
    setIsHovered(true);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1.02, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: false })
    ]).start();
  };
  const handleHoverOut = () => {
    setIsHovered(false);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 200, useNativeDriver: false })
    ]).start();
  };

  const animatedButtonColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.primary, '#BD00FF'],
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGoogleCredential = async (idToken: string) => {
    try {
      setLoading(true);
      setErrorMsg('');
      await signInWithGoogle(idToken);
    } catch (e: any) {
      setErrorMsg(getErrorMessage(e.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleWebSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      await signInWithGooglePopup();
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setErrorMsg(getErrorMessage(e.code) ?? 'No se pudo iniciar sesión con Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const rawNonce = Math.random().toString(36).substring(2, 18);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (appleCredential.identityToken) {
        await signInWithApple(appleCredential.identityToken, rawNonce);
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setErrorMsg('No se pudo iniciar sesión con Apple.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    setErrorMsg('');
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor ingresa tu email y contraseña.');
      return;
    }
    if (mode === 'register' && !displayName.trim()) {
      setErrorMsg('Por favor ingresa tu nombre.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    try {
      setLoading(true);
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(email.trim(), password, displayName.trim());
      }
    } catch (e: any) {
      setErrorMsg(getErrorMessage(e.code));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setErrorMsg('');
    setDisplayName('');
    setEmail('');
    setPassword('');
  };

  const showSocialRow = GOOGLE_ENABLED || Platform.OS === 'ios';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={styles.logoMark}>
              <NeonIcon size={80} glowColor={Colors.primary}>
                <CrescentMoonIcon size={48} gradientColors={['#6C63FF', '#00F0FF']} />
              </NeonIcon>
            </View>
            <Text style={styles.logoText}>remia</Text>
            <Text style={styles.tagline}>el lenguaje de tus sueños</Text>
          </View>

          {/* ── Formulario ── */}
          <View style={styles.form}>
            {/* Toggle Login / Registro */}
            <View style={styles.modeToggle}>
              {(['login', 'register'] as AuthMode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => { setMode(m); setErrorMsg(''); }}
                  style={[styles.modeTab, mode === m && styles.modeTabActive]}
                >
                  <Text style={[styles.modeTabLabel, mode === m && styles.modeTabLabelActive]}>
                    {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Nombre (solo en registro) */}
            {mode === 'register' && (
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Tu nombre"
                  placeholderTextColor={Colors.textTertiary}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            )}

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Contraseña */}
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputPassword]}
                placeholder="Contraseña"
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleEmailAuth}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.textTertiary}
                />
              </TouchableOpacity>
            </View>

            {/* Olvidé mi contraseña — solo en modo login */}
            {mode === 'login' && (
              <TouchableOpacity
                onPress={() => setShowForgot(true)}
                style={styles.forgotRow}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            )}

            {/* Error */}
            {errorMsg !== '' && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={14} color={Colors.error} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {/* Botón principal animado */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Pressable
                onPress={handleEmailAuth}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={loading}
                {...Platform.select({
                  web: {
                    onHoverIn: handleHoverIn,
                    onHoverOut: handleHoverOut,
                  },
                })}
              >
                <Animated.View style={[
                  styles.primaryButton,
                  loading && styles.buttonDisabled,
                  { backgroundColor: animatedButtonColor },
                  isHovered && {
                    shadowColor: '#BD00FF',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 10,
                    elevation: 10,
                  }
                ]}>
                  {loading ? (
                    <ActivityIndicator size="small" color={Colors.textOnPrimary} />
                  ) : (
                    <Text style={styles.primaryButtonLabel}>
                      {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                    </Text>
                  )}
                </Animated.View>
              </Pressable>
            </Animated.View>

            {/* Separador y Social */}
            {showSocialRow && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>o continúa con</Text>
                  <View style={styles.dividerLine} />
                </View>
                <View style={styles.socialRow}>
                  {GOOGLE_ENABLED && (
                    <GoogleSignInButton
                      loading={loading}
                      onCredential={handleGoogleCredential}
                      onError={setErrorMsg}
                      onWebSignIn={handleGoogleWebSignIn}
                    />
                  )}
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      style={styles.socialButton}
                      onPress={handleAppleSignIn}
                      disabled={loading}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="logo-apple" size={18} color={Colors.textPrimary} />
                      <Text style={styles.socialLabel}>Apple</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {/* Toggle modo */}
            <TouchableOpacity onPress={toggleMode} style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
                <Text style={styles.toggleLink}>
                  {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de recuperación */}
      <ForgotPasswordModal
        visible={showForgot}
        onClose={() => setShowForgot(false)}
        prefillEmail={email}
      />
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screen,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 40,
  },
  logoMark: { marginBottom: 8 },
  logoText: {
    fontSize: 42,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 8,
    marginBottom: 10,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    letterSpacing: 2,
  },
  form: { gap: 14 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  modeTabActive: { backgroundColor: Colors.surfaceElevated },
  modeTabLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textTertiary,
  },
  modeTabLabelActive: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: MIN_TOUCH,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    paddingVertical: 12,
  },
  inputPassword: { paddingRight: 8 },
  eyeButton: { padding: 4 },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorDim,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.error,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: MIN_TOUCH,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: {
    flex: 1,
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  socialIcon: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  socialLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  toggleRow: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
  toggleText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  toggleLink: { color: Colors.primary, fontWeight: FontWeight.semibold },
});

// ─── Estilos del Modal ────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.screen,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    padding: 4,
    borderRadius: Radius.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  primaryBtn: {
    minHeight: MIN_TOUCH,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textOnPrimary,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelLabel: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  spamBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255, 209, 102, 0.1)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  spamText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});

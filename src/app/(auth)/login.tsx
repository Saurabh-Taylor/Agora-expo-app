import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { isValidEmail, normalizeEmailAddress, useResendCountdown } from '@/commonFunctions';
import { AuthEmailField } from '@/components/auth-email-field';
import { AgoraLogo } from '@/components/icons/agora-logo';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/stores/toast-store';

const OTP_LENGTH = 6;
const SUPPORT_LINE = 'Society office · +91 80 4123 5566';

type AuthMode = 'password' | 'otp';

function LockIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={4.5} y={10.5} width={15} height={9.5} rx={2.5} stroke={Colors.gold} strokeWidth={1.8} />
      <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke={Colors.gold} strokeWidth={1.8} />
    </Svg>
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  const stroke = 'rgba(247,244,236,0.72)';
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={2.75} stroke={stroke} strokeWidth={1.8} />
      {!visible && <Path d="M3.5 3.5l17 17" stroke={stroke} strokeWidth={2} strokeLinecap="round" />}
    </Svg>
  );
}

function ShieldIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2.5l7.5 3v5.2c0 4.6-3.1 8.1-7.5 9.6-4.4-1.5-7.5-5-7.5-9.6V5.5l7.5-3z" stroke={Colors.gold} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9 12l2 2 4-4" stroke={Colors.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function LoginScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const { remainingSeconds: resendIn, startCountdown: startResend, resetCountdown: resetResend } = useResendCountdown();

  const isPassword = authMode === 'password';
  const normalizedIdentifier = normalizeEmailAddress(identifier);
  const hasId = isValidEmail(normalizedIdentifier);
  const canLogin = hasId && password.length > 0 && !busy;
  const canSend = hasId && !busy;
  const canVerify = otp.length === OTP_LENGTH && !busy;

  function switchMode() {
    resetResend();
    setAuthMode(isPassword ? 'otp' : 'password');
    setOtpSent(false);
    setOtp('');
    setPassword('');
    setBusy(false);
  }

  async function doLogin() {
    if (!hasId) {
      showToast('Enter a valid email address');
      return;
    }
    if (!password) {
      showToast('Enter your password');
      return;
    }
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedIdentifier, password });
    if (error) {
      setBusy(false);
      showToast(error.message);
    }
    // on success, the auth store + root navigator pick up the new session automatically
  }

  async function sendOtp() {
    if (!hasId) {
      showToast('Enter a valid email address');
      return;
    }
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedIdentifier,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      showToast(error.message);
      return;
    }
    setOtpSent(true);
    setOtp('');
    startResend();
    showToast('Code sent — check your email');
  }

  async function resend() {
    if (resendIn > 0 || busy) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedIdentifier,
      options: { shouldCreateUser: false },
    });
    if (error) {
      showToast(error.message);
      return;
    }
    startResend();
    showToast('New code sent');
  }

  async function verifyOtp() {
    if (otp.length !== OTP_LENGTH) {
      showToast('Enter the 6-digit code');
      return;
    }
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: normalizedIdentifier, token: otp, type: 'email' });
    if (error) {
      setBusy(false);
      showToast(error.message);
    }
  }

  function forgot() {
    router.push({ pathname: '/(auth)/forgot-password', params: { email: normalizedIdentifier } });
  }

  function contact() {
    showToast(SUPPORT_LINE);
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.heroWrap}>
        <Image source={require('@/assets/images/login-hero.png')} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['rgba(9,24,16,0.45)', 'rgba(9,24,16,0.05)', 'rgba(9,24,16,0.55)', Colors.green700]}
          locations={[0, 0.24, 0.7, 0.96]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <AgoraLogo size={34} />
          </View>
          <Text style={styles.logoWordmark}>Agora</Text>
        </View>

        <View style={styles.spacer150} />

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>{isPassword ? 'Log in to your Agora account.' : 'Log in with a one-time code.'}</Text>

        <AuthEmailField value={identifier} onChangeText={setIdentifier} />

        {isPassword ? (
          <>
            <View style={styles.field}>
              <View style={styles.fieldIconWrap}>
                <LockIcon />
              </View>
              <View style={styles.fieldBody}>
                <Text style={styles.fieldLabel}>PASSWORD</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={Colors.textFaint}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="done"
                    onSubmitEditing={() => void doLogin()}
                    style={[styles.input, styles.flex]}
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setShowPw(!showPw)}
                    accessibilityRole="button"
                    accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
                    <EyeIcon visible={showPw} />
                  </Pressable>
                </View>
              </View>
            </View>
            <Pressable style={styles.forgotButton} onPress={forgot} accessibilityRole="button">
              <Text style={styles.forgotLabel}>Forgot password?</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, styles.passwordLoginButton, { backgroundColor: canLogin ? Colors.gold : '#B79A5E' }]}
              onPress={doLogin}>
              {busy && <ActivityIndicator size="small" color={Colors.green500} />}
              <Text style={styles.primaryButtonLabel}>{busy ? 'Logging in…' : 'Log in'}</Text>
            </Pressable>
          </>
        ) : !otpSent ? (
          <>
            <Text style={styles.otpHint}>We&apos;ll email a 6-digit code to verify it&apos;s you — no password needed.</Text>
            <Pressable style={[styles.primaryButton, styles.otpButtonSpacing, { backgroundColor: canSend ? Colors.gold : '#B79A5E' }]} onPress={sendOtp}>
              {busy && <ActivityIndicator size="small" color={Colors.green500} />}
              <Text style={styles.primaryButtonLabel}>{busy ? 'Sending…' : 'Send OTP'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.otpLabel}>ENTER CODE</Text>
            <Text style={styles.otpSentTo}>Sent to {identifier}</Text>
            <View style={styles.otpCellsRow}>
              {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.otpCell,
                    { borderColor: i === otp.length ? Colors.gold : otp[i] ? Colors.success700 : '#E3DDCD' },
                  ]}>
                  <Text style={styles.otpCellText}>{otp[i] ?? ''}</Text>
                </View>
              ))}
              <TextInput
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                style={styles.otpHiddenInput}
                autoFocus
              />
            </View>
            <View style={styles.resendRow}>
              <Text style={styles.resendText}>Didn&apos;t get it? </Text>
              <Pressable onPress={resend} disabled={resendIn > 0} hitSlop={8}>
                <Text style={[styles.resendAction, { color: resendIn > 0 ? 'rgba(247,244,236,0.4)' : Colors.gold }]}>
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.primaryButton, styles.otpButtonSpacing, { backgroundColor: canVerify ? Colors.gold : '#B79A5E' }]}
              onPress={verifyOtp}>
              {busy && <ActivityIndicator size="small" color={Colors.green500} />}
              <Text style={styles.primaryButtonLabel}>{busy ? 'Verifying…' : 'Verify & log in'}</Text>
            </Pressable>
          </>
        )}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable style={styles.switchButton} onPress={switchMode}>
          <ShieldIcon />
          <Text style={styles.switchLabel}>{isPassword ? 'Log in with OTP' : 'Use password instead'}</Text>
        </Pressable>

        <View style={styles.trustIconRow}>
          <ShieldIcon />
        </View>
        <Text style={styles.contactRow}>
          Trouble signing in?{' '}
          <Text style={styles.contactLink} onPress={contact}>
            Contact society office
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.green700 },
  heroWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: 400, overflow: 'hidden' },
  scrollContent: { paddingTop: 66, paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1 },
  flex: { flex: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(16,38,27,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(231,163,60,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWordmark: { fontFamily: FontFamily.headingExtraBold, fontSize: 28, color: '#FDFBF5' },
  spacer150: { height: 150 },
  heading: { fontFamily: FontFamily.headingExtraBold, fontSize: 38, lineHeight: 42, color: Colors.textOnDark },
  subheading: { fontFamily: FontFamily.bodyRegular, fontSize: 15.5, color: 'rgba(247,244,236,0.6)', marginTop: 10, lineHeight: 22 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(247,244,236,0.12)',
    borderRadius: Radius.card - 2,
    padding: 14,
  },
  fieldIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(31,157,92,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldBody: { flex: 1, minWidth: 0 },
  fieldLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(247,244,236,0.5)' },
  forgotButton: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 2 },
  forgotLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.gold },
  input: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 16,
    color: Colors.textOnDark,
    marginTop: 4,
    padding: 0,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  eyeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  primaryButton: {
    marginTop: 24,
    height: 58,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  passwordLoginButton: { marginTop: 8 },
  primaryButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 17, color: Colors.green500 },
  otpButtonSpacing: { marginTop: 22 },
  otpHint: { fontFamily: FontFamily.bodyRegular, fontSize: 13.5, color: 'rgba(247,244,236,0.55)', marginTop: 18, lineHeight: 20 },
  otpLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(247,244,236,0.5)', marginTop: 24 },
  otpSentTo: { fontFamily: FontFamily.bodyRegular, fontSize: 13.5, color: 'rgba(247,244,236,0.55)', marginTop: 6 },
  otpCellsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  otpCell: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpCellText: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textOnDark },
  otpHiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%' },
  resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  resendText: { fontFamily: FontFamily.bodyRegular, fontSize: 13.5, color: 'rgba(247,244,236,0.55)' },
  resendAction: { fontFamily: FontFamily.bodyBold, fontSize: 13.5 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(247,244,236,0.14)' },
  dividerLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 12.5, color: 'rgba(247,244,236,0.45)' },
  switchButton: {
    marginTop: 22,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(247,244,236,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  switchLabel: { fontFamily: FontFamily.bodyBold, fontSize: 15.5, color: Colors.textOnDark },
  trustIconRow: { alignItems: 'center', marginTop: 26, marginBottom: 16 },
  contactRow: { textAlign: 'center', fontFamily: FontFamily.bodyRegular, fontSize: 13, color: 'rgba(247,244,236,0.45)' },
  contactLink: { fontFamily: FontFamily.bodyBold, color: Colors.gold },
});

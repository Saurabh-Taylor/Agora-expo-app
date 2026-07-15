import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { AgoraLogo } from '@/components/icons/agora-logo';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/stores/toast-store';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
const SUPPORT_LINE = 'Society office · +91 80 4123 5566';

type AuthMode = 'password' | 'otp';

function isEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

function EmailIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5.5} width={18} height={13} rx={2.5} stroke={Colors.gold} strokeWidth={1.8} />
      <Path d="M4 7l8 6 8-6" stroke={Colors.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={4.5} y={10.5} width={15} height={9.5} rx={2.5} stroke={Colors.gold} strokeWidth={1.8} />
      <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke={Colors.gold} strokeWidth={1.8} />
    </Svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  const stroke = 'rgba(247,244,236,0.55)';
  if (hidden) {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M4 4l16 16" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
        <Path
          d="M9.5 5.4A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.7M6.5 6.9C3.7 8.6 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 3.5-.6"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" stroke={stroke} strokeWidth={1.8} />
      <Path d="M12 12" stroke={stroke} strokeWidth={1.8} />
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
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const resendTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(resendTimer.current), []);

  function startResend() {
    clearInterval(resendTimer.current);
    setResendIn(RESEND_SECONDS);
    resendTimer.current = setInterval(() => {
      setResendIn((current) => {
        if (current <= 1) {
          clearInterval(resendTimer.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  const isPassword = authMode === 'password';
  const hasId = isEmail(identifier);
  const canLogin = hasId && password.length > 0 && !busy;
  const canSend = hasId && !busy;
  const canVerify = otp.length === OTP_LENGTH && !busy;

  function switchMode() {
    clearInterval(resendTimer.current);
    setAuthMode(isPassword ? 'otp' : 'password');
    setOtpSent(false);
    setOtp('');
    setPassword('');
    setBusy(false);
    setResendIn(0);
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
    const { error } = await supabase.auth.signInWithPassword({ email: identifier.trim(), password });
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
      email: identifier.trim(),
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
      email: identifier.trim(),
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
    const { error } = await supabase.auth.verifyOtp({ email: identifier.trim(), token: otp, type: 'email' });
    if (error) {
      setBusy(false);
      showToast(error.message);
    }
  }

  async function forgot() {
    if (!hasId) {
      showToast('Enter your email to reset your password');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim(), {
      redirectTo: Linking.createURL('reset-password'),
    });
    showToast(error ? error.message : 'Reset link sent to your email');
  }

  function contact() {
    showToast(SUPPORT_LINE);
  }

  return (
    <View style={styles.root}>
      <View style={styles.heroWrap}>
        <Image source={require('@/assets/images/login-hero.png')} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['rgba(9,24,16,0.45)', 'rgba(9,24,16,0.05)', 'rgba(9,24,16,0.55)', Colors.green700]}
          locations={[0, 0.24, 0.7, 0.96]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <View style={styles.logoBadge}>
            <AgoraLogo size={34} />
          </View>
          <Text style={styles.logoWordmark}>Agora</Text>
        </View>

        <View style={styles.spacer150} />

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>{isPassword ? 'Log in to your Agora account.' : 'Log in with a one-time code.'}</Text>

        <View style={styles.field}>
          <View style={styles.fieldIconWrap}>
            <EmailIcon />
          </View>
          <View style={styles.fieldBody}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@email.com"
              placeholderTextColor={Colors.textFaint}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>
        </View>

        {isPassword ? (
          <>
            <View style={styles.field}>
              <View style={styles.fieldIconWrap}>
                <LockIcon />
              </View>
              <View style={styles.fieldBody}>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabel}>PASSWORD</Text>
                  <Pressable onPress={forgot} hitSlop={8}>
                    <Text style={styles.forgotLabel}>Forgot password?</Text>
                  </Pressable>
                </View>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={Colors.textFaint}
                    secureTextEntry={!showPw}
                    style={[styles.input, styles.flex]}
                  />
                  <Pressable onPress={() => setShowPw(!showPw)} hitSlop={8}>
                    <EyeIcon hidden={!showPw} />
                  </Pressable>
                </View>
              </View>
            </View>
            <Pressable style={[styles.primaryButton, { backgroundColor: canLogin ? Colors.gold : '#B79A5E' }]} onPress={doLogin}>
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
    </View>
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
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(247,244,236,0.5)' },
  forgotLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: Colors.gold },
  input: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 16,
    color: Colors.textOnDark,
    marginTop: 4,
    padding: 0,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  primaryButton: {
    marginTop: 24,
    height: 58,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
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

import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isValidEmail, useResendCountdown } from '@/commonFunctions';
import { AuthEmailField } from '@/components/auth-email-field';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/stores/toast-store';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { remainingSeconds, startCountdown } = useResendCountdown();

  async function sendResetLink() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      showToast('Enter a valid email address');
      return;
    }
    if (busy || remainingSeconds > 0) return;

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: Linking.createURL('reset-password'),
    });
    setBusy(false);

    if (error) {
      showToast(error.message);
      return;
    }

    setSentTo(normalizedEmail);
    startCountdown();
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled">
      <BackArrowButton onPress={() => router.back()} />

      {sentTo ? (
        <View style={styles.successContent}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconLabel}>✓</Text>
          </View>
          <Text style={styles.heading}>Check your email</Text>
          <Text style={styles.description}>
            If an Agora account exists for <Text style={styles.emailEmphasis}>{sentTo}</Text>, a password reset link is on
            its way.
          </Text>
          <Text style={styles.secondaryText}>Open the link on this phone to choose a new password.</Text>

          <Pressable
            style={[styles.primaryButton, remainingSeconds > 0 && styles.buttonDisabled]}
            onPress={sendResetLink}
            disabled={busy || remainingSeconds > 0}>
            {busy && <ActivityIndicator size="small" color={Colors.green500} />}
            <Text style={styles.primaryButtonLabel}>
              {remainingSeconds > 0 ? `Send again in ${remainingSeconds}s` : 'Send again'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setSentTo(null)}>
            <Text style={styles.secondaryButtonLabel}>Use another email</Text>
          </Pressable>
          <Pressable style={styles.loginButton} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginButtonLabel}>Back to login</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.formContent}>
          <Text style={styles.eyebrow}>ACCOUNT RECOVERY</Text>
          <Text style={styles.heading}>Forgot your password?</Text>
          <Text style={styles.description}>Enter your account email and we&apos;ll send you a secure reset link.</Text>

          <AuthEmailField value={email} onChangeText={setEmail} autoFocus={!email} />

          <Pressable
            style={[styles.primaryButton, (!isValidEmail(email) || remainingSeconds > 0) && styles.buttonDisabled]}
            onPress={sendResetLink}
            disabled={busy || remainingSeconds > 0}>
            {busy && <ActivityIndicator size="small" color={Colors.green500} />}
            <Text style={styles.primaryButtonLabel}>
              {busy ? 'Sending…' : remainingSeconds > 0 ? `Send again in ${remainingSeconds}s` : 'Send reset link'}
            </Text>
          </Pressable>
          <Pressable style={styles.loginButton} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginButtonLabel}>Back to login</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.green700 },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  formContent: { marginTop: 52 },
  successContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 36 },
  eyebrow: { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 1.8, color: Colors.gold },
  heading: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 32,
    lineHeight: 38,
    color: Colors.textOnDark,
    marginTop: 12,
    textAlign: 'center',
  },
  description: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(247,244,236,0.68)',
    marginTop: 12,
    textAlign: 'center',
  },
  secondaryText: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(247,244,236,0.48)',
    marginTop: 12,
    textAlign: 'center',
  },
  emailEmphasis: { fontFamily: FontFamily.bodyBold, color: Colors.textOnDark },
  successIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: 'rgba(31,157,92,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconLabel: { fontFamily: FontFamily.headingBold, fontSize: 30, color: Colors.success400 },
  primaryButton: {
    alignSelf: 'stretch',
    marginTop: 28,
    height: 58,
    borderRadius: 16,
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonDisabled: { opacity: 0.58 },
  primaryButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 16, color: Colors.green500 },
  secondaryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  secondaryButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.gold },
  loginButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  loginButtonLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: 'rgba(247,244,236,0.72)' },
});

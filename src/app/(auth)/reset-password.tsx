import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SetPasswordForm } from '@/components/set-password-form';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/stores/toast-store';

function extractRecoveryTokens(url: string | null) {
  if (!url) return null;
  const paramString = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
  if (!paramString) return null;
  const params = new URLSearchParams(paramString);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export default function ResetPasswordScreen() {
  const url = Linking.useURL();
  const tokens = useMemo(() => extractRecoveryTokens(url), [url]);
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const [busy, setBusy] = useState(false);
  const status = tokens ? sessionStatus : 'invalid';

  useEffect(() => {
    if (!tokens) return;
    supabase.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken }).then(({ error }) => {
      setSessionStatus(error ? 'invalid' : 'ready');
    });
  }, [tokens]);

  async function handleSubmit(password: string) {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      showToast(error.message);
      return;
    }
    showToast('Password updated');
    // root navigator picks up the now-authenticated session automatically
  }

  if (status === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  if (status === 'invalid') {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>This link has expired</Text>
        <Text style={styles.subheading}>Request a new reset link from the login screen.</Text>
        <Pressable style={styles.backButton} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.backButtonLabel}>Back to login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Set a new password</Text>
      <Text style={styles.subheading}>Choose a password you haven&apos;t used before.</Text>
      <SetPasswordForm busy={busy} submitLabel="Save password" busyLabel="Saving…" onSubmit={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.green700, padding: 24, paddingTop: 100 },
  center: { flex: 1, backgroundColor: Colors.green700, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  heading: { fontFamily: FontFamily.headingExtraBold, fontSize: 28, color: Colors.textOnDark, textAlign: 'center' },
  subheading: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    color: 'rgba(247,244,236,0.6)',
    marginTop: 10,
    textAlign: 'center',
  },
  backButton: { marginTop: 12, padding: 12 },
  backButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.gold },
});

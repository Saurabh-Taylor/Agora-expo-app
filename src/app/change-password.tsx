import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SetPasswordForm } from '@/components/set-password-form';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function ChangePasswordScreen() {
  const [busy, setBusy] = useState(false);
  const session = useAuthStore((state) => state.session);
  const queryClient = useQueryClient();

  async function handleSubmit(password: string) {
    if (!session) return;
    setBusy(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setBusy(false);
      showToast(authError.message);
      return;
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', session.user.id);
    setBusy(false);
    if (profileError) {
      showToast(profileError.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['profile', session.user.id] });
  }

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Set your password</Text>
      <Text style={styles.subheading}>
        You&apos;re signed in with a temporary password. Choose a new one to continue.
      </Text>
      <SetPasswordForm busy={busy} submitLabel="Continue" busyLabel="Saving…" onSubmit={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.green700, padding: 24, paddingTop: 100 },
  heading: { fontFamily: FontFamily.headingExtraBold, fontSize: 28, color: Colors.textOnDark, textAlign: 'center' },
  subheading: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    color: 'rgba(247,244,236,0.6)',
    marginTop: 10,
    textAlign: 'center',
  },
});

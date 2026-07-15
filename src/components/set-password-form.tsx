import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { showToast } from '@/stores/toast-store';

export const MIN_PASSWORD_LENGTH = 8;

type SetPasswordFormProps = {
  busy: boolean;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (password: string) => void;
};

export function SetPasswordForm({ busy, submitLabel, busyLabel, onSubmit }: SetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  function handleSubmit() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      showToast(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      showToast("Passwords don't match");
      return;
    }
    onSubmit(password);
  }

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Enter new password"
          placeholderTextColor={Colors.textFaint}
          style={styles.input}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Re-enter new password"
          placeholderTextColor={Colors.textFaint}
          style={styles.input}
        />
      </View>

      <Pressable style={styles.primaryButton} onPress={handleSubmit}>
        {busy && <ActivityIndicator size="small" color={Colors.green500} />}
        <Text style={styles.primaryButtonLabel}>{busy ? busyLabel : submitLabel}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(247,244,236,0.12)',
    borderRadius: Radius.card - 2,
    padding: 14,
  },
  fieldLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(247,244,236,0.5)' },
  input: { fontFamily: FontFamily.bodyRegular, fontSize: 16, color: Colors.textOnDark, marginTop: 4, padding: 0 },
  primaryButton: {
    marginTop: 24,
    height: 58,
    borderRadius: 16,
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 17, color: Colors.green500 },
});

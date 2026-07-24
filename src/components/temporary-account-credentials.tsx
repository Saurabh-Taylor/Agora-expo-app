import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { showToast } from '@/stores/toast-store';

type TemporaryAccountCredentialsProps = {
  accountLabel: string;
  email: string;
  tempPassword: string;
  onDone: () => void;
};

export function TemporaryAccountCredentials({
  accountLabel,
  email,
  tempPassword,
  onDone,
}: TemporaryAccountCredentialsProps) {
  async function copyPassword() {
    await Clipboard.setStringAsync(tempPassword);
    showToast('Temporary password copied');
  }

  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={styles.title}>Account created</Text>
      <Text style={styles.subtitle}>
        Share these credentials with the {accountLabel}. The temporary password is shown only once and must be changed
        on first login.
      </Text>
      <View style={styles.credentialCard}>
        <Text style={styles.credentialLabel}>EMAIL</Text>
        <Text selectable style={styles.credentialValue}>{email}</Text>
        <Text style={[styles.credentialLabel, styles.credentialLabelSpaced]}>TEMPORARY PASSWORD</Text>
        <Text selectable style={styles.credentialValue}>{tempPassword}</Text>
      </View>
      <Pressable accessibilityRole="button" style={styles.copyButton} onPress={copyPassword}>
        <Text style={styles.copyButtonLabel}>Copy password</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.doneButton} onPress={onDone}>
        <Text style={styles.doneButtonLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.adminCanvas,
    padding: 24,
    paddingTop: 100,
    alignItems: 'center',
  },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 24, textAlign: 'center', color: Colors.textPrimary },
  subtitle: {
    fontSize: 13.5,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  credentialCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    padding: 18,
    marginTop: 22,
  },
  credentialLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt },
  credentialLabelSpaced: { marginTop: 16 },
  credentialValue: { fontFamily: FontFamily.headingBold, fontSize: 18, marginTop: 5, color: Colors.textPrimary },
  copyButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  copyButtonLabel: { fontSize: 15, fontWeight: '700', color: Colors.green500 },
  doneButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: Radius.button,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  doneButtonLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.green500 },
});

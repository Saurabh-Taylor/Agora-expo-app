import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage, isValidEmail } from '@/commonFunctions';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { TemporaryAccountCredentials } from '@/components/temporary-account-credentials';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useCreateGuard } from '@/features/guards/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function AddGuardScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createGuard = useCreateGuard();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const canSave =
    fullName.trim().length > 1 &&
    isValidEmail(email) &&
    !!profileQuery.data &&
    !createGuard.isPending;

  async function handleSave() {
    if (!canSave || !profileQuery.data) return;
    try {
      const created = await createGuard.mutateAsync({
        fullName,
        email,
        phone: phone.trim() || undefined,
        societyId: profileQuery.data.society_id,
      });
      setResult({ email: created.email, tempPassword: created.tempPassword });
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create the guard account'));
    }
  }

  if (result) {
    return (
      <TemporaryAccountCredentials
        accountLabel="security guard"
        email={result.email}
        tempPassword={result.tempPassword}
        onDone={() => router.replace('/(admin)/guard-accounts' as Href)}
      />
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text accessibilityRole="header" style={styles.title}>Add security guard</Text>
      </View>
      <Text style={styles.subtitle}>
        This account can register visitors, verify approvals, and record entry or exit. It cannot access resident or
        admin workflows.
      </Text>

      <Text style={styles.label}>FULL NAME</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="e.g. Ramesh Kumar"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
        autoCapitalize="words"
        accessibilityLabel="Guard full name"
      />

      <Text style={styles.label}>EMAIL</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="guard@example.com"
        placeholderTextColor={Colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={styles.input}
        accessibilityLabel="Guard email"
      />

      <Text style={styles.label}>PHONE  -  OPTIONAL</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="98765 43210"
        placeholderTextColor={Colors.textFaint}
        keyboardType="phone-pad"
        style={styles.input}
        accessibilityLabel="Guard phone number"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave, busy: createGuard.isPending }}
        style={[styles.saveButton, !canSave && styles.disabledButton]}
        onPress={handleSave}
        disabled={!canSave}>
        {createGuard.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
        <Text style={styles.saveLabel}>{createGuard.isPending ? 'Creating guard...' : 'Create guard account'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { marginTop: 14, fontSize: 13, lineHeight: 19, color: Colors.textMuted },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 18 },
  input: {
    minHeight: 50,
    marginTop: 8,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  saveButton: {
    minHeight: 54,
    marginTop: 28,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 16,
    backgroundColor: Colors.green500,
  },
  disabledButton: { opacity: 0.45 },
  saveLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.textOnDark, textAlign: 'center' },
});

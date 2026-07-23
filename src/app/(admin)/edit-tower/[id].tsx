import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useTowers, useUpdateTower, type Tower } from '@/features/towers/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function EditTowerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const towersQuery = useTowers(societyId);
  const tower = towersQuery.data?.find((item) => item.id === id);
  const isLoading = profileQuery.isLoading || towersQuery.isLoading;
  const isError = profileQuery.isError || towersQuery.isError;

  if (isLoading || isError || !tower || !societyId) {
    return (
      <View style={styles.root}>
        <AsyncState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => {
            profileQuery.refetch();
            towersQuery.refetch();
          }}
          isEmpty={!isLoading && !isError && !tower}
          emptyMessage="Tower not found."
        />
      </View>
    );
  }

  return <EditTowerForm key={tower.id} tower={tower} societyId={societyId} />;
}

function EditTowerForm({ tower, societyId }: { tower: Tower; societyId: string }) {
  const updateTower = useUpdateTower();
  const [name, setName] = useState(tower.name);
  const [code, setCode] = useState(tower.code);
  const normalizedCode = code.trim().toUpperCase();
  const canSave =
    name.trim().length > 1 &&
    normalizedCode.length > 0 &&
    (name.trim() !== tower.name || normalizedCode !== tower.code);

  async function handleSave() {
    if (!canSave) return;
    try {
      await updateTower.mutateAsync({ id: tower.id, societyId, name: name.trim(), code: normalizedCode });
      showToast('Tower details updated');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update the tower'));
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <BackArrowButton onPress={() => router.back()} />
          <View style={styles.flex}>
            <Text style={styles.title}>Edit tower</Text>
            <Text style={styles.subtitle}>{tower.floors} floors - {tower.units_per_floor} flats per floor</Text>
          </View>
        </View>

        <Text style={styles.label}>TOWER NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Tower name"
          placeholderTextColor={Colors.textFaint}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Text style={styles.label}>TOWER CODE</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Tower code"
          placeholderTextColor={Colors.textFaint}
          style={styles.input}
          autoCapitalize="characters"
          maxLength={8}
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Floor and flat counts stay fixed so resident assignments and activity history remain intact.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave || updateTower.isPending}>
          {updateTower.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
          <Text style={styles.saveLabel}>{updateTower.isPending ? 'Saving...' : 'Save changes'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 20 },
  input: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  infoBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: Radius.input,
    backgroundColor: '#F6ECD8',
    borderWidth: 1,
    borderColor: '#EBD9B4',
  },
  infoText: { color: '#5C4408', fontSize: 13, lineHeight: 19 },
  saveButton: {
    marginTop: 26,
    minHeight: 54,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveLabel: { fontFamily: FontFamily.bodyBold, fontSize: 15.5, color: Colors.textOnDark },
});

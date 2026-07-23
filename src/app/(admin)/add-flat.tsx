import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useCreateFlat } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useTowers } from '@/features/towers/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function AddFlatScreen() {
  const { towerId } = useLocalSearchParams<{ towerId?: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const towersQuery = useTowers(societyId);
  const createFlat = useCreateFlat();
  const [selectedTowerId, setSelectedTowerId] = useState(towerId ?? '');
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState('');
  const activeTowerId = selectedTowerId || towersQuery.data?.[0]?.id || '';
  const selectedTower = towersQuery.data?.find((tower) => tower.id === activeTowerId);
  const floorNumber = Number.parseInt(floor, 10);
  const canSave =
    !!societyId &&
    !!selectedTower &&
    number.trim().length > 0 &&
    Number.isInteger(floorNumber) &&
    floorNumber >= 0 &&
    floorNumber <= selectedTower.floors;

  async function handleSave() {
    if (!canSave || !societyId || !selectedTower) return;
    try {
      const flat = await createFlat.mutateAsync({
        societyId,
        towerId: selectedTower.id,
        number: number.trim(),
        floor: floorNumber,
      });
      showToast('Flat created');
      router.replace({ pathname: '/(admin)/flat/[id]', params: { id: flat.id } } as unknown as Href);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create the flat'));
    }
  }

  if (profileQuery.isLoading || towersQuery.isLoading || profileQuery.isError || towersQuery.isError) {
    return (
      <View style={styles.root}>
        <AsyncState
          isLoading={profileQuery.isLoading || towersQuery.isLoading}
          isError={profileQuery.isError || towersQuery.isError}
          onRetry={() => {
            profileQuery.refetch();
            towersQuery.refetch();
          }}
          isEmpty={false}
        />
      </View>
    );
  }

  if (!towersQuery.data?.length) {
    return (
      <View style={[styles.root, styles.emptyRoot]}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState isLoading={false} isError={false} isEmpty emptyMessage="Create a tower before adding individual flats." />
        <Pressable style={styles.saveButton} onPress={() => router.replace('/(admin)/add-tower')}>
          <Text style={styles.saveLabel}>Create tower</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <BackArrowButton onPress={() => router.back()} />
          <View>
            <Text style={styles.title}>Add flat</Text>
            <Text style={styles.subtitle}>Add an individual unit to a tower</Text>
          </View>
        </View>

        <Text style={styles.label}>TOWER</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {towersQuery.data.map((tower) => (
            <Pressable
              key={tower.id}
              style={[styles.chip, activeTowerId === tower.id && styles.chipActive]}
              onPress={() => {
                setSelectedTowerId(tower.id);
                setFloor('');
              }}>
              <Text style={[styles.chipLabel, activeTowerId === tower.id && styles.chipLabelActive]}>
                {tower.code} - {tower.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>FLAT NUMBER</Text>
        <TextInput
          value={number}
          onChangeText={setNumber}
          placeholder="e.g. 1205"
          placeholderTextColor={Colors.textFaint}
          style={styles.input}
          autoCapitalize="characters"
          returnKeyType="next"
        />

        <Text style={styles.label}>FLOOR</Text>
        <TextInput
          value={floor}
          onChangeText={setFloor}
          placeholder={selectedTower ? `0 to ${selectedTower.floors}` : 'Floor'}
          placeholderTextColor={Colors.textFaint}
          style={styles.input}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        <Pressable
          accessibilityRole="button"
          style={[styles.saveButton, !canSave && styles.disabledButton]}
          onPress={handleSave}
          disabled={!canSave || createFlat.isPending}>
          {createFlat.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
          <Text style={styles.saveLabel}>{createFlat.isPending ? 'Creating...' : 'Create flat'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  emptyRoot: { paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 20 },
  chipRow: { gap: 9, paddingTop: 9, paddingRight: 20 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Colors.textPrimary },
  chipLabelActive: { color: Colors.textOnDark },
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
  disabledButton: { opacity: 0.45 },
  saveLabel: { fontFamily: FontFamily.bodyBold, fontSize: 15.5, color: Colors.textOnDark },
});

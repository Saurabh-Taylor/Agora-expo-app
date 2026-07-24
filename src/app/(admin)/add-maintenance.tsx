import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useFlats } from '@/features/flats/api';
import { useCreateMaintenanceInvoices } from '@/features/maintenance/api';
import { useProfile } from '@/features/profile/api';
import { useTowers } from '@/features/towers/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00'));
}

export default function AddMaintenanceScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const flatsQuery = useFlats(societyId);
  const towersQuery = useTowers(societyId);
  const createInvoices = useCreateMaintenanceInvoices();
  const [periodLabel, setPeriodLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedFlatIds, setSelectedFlatIds] = useState<string[]>([]);

  const towerById = useMemo(
    () => new Map((towersQuery.data ?? []).map((tower) => [tower.id, tower])),
    [towersQuery.data],
  );
  const flats = flatsQuery.data ?? [];
  const allSelected = flats.length > 0 && selectedFlatIds.length === flats.length;
  const numericAmount = Number(amount);
  const canSave =
    !!societyId &&
    periodLabel.trim().length >= 2 &&
    numericAmount > 0 &&
    isValidDateInput(dueDate) &&
    selectedFlatIds.length > 0 &&
    !createInvoices.isPending;

  function toggleFlat(flatId: string) {
    setSelectedFlatIds((current) =>
      current.includes(flatId) ? current.filter((id) => id !== flatId) : [...current, flatId],
    );
  }

  async function handleSave() {
    if (!canSave || !societyId) return;
    try {
      const created = await createInvoices.mutateAsync({
        societyId,
        flatIds: selectedFlatIds,
        periodLabel,
        amount: numericAmount,
        dueDate,
      });
      showToast(`${created.length} maintenance invoice${created.length === 1 ? '' : 's'} created`);
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not create maintenance invoices'));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text accessibilityRole="header" style={styles.title}>Create invoices</Text>
      </View>
      <Text style={styles.subtitle}>One invoice will be created for every selected flat.</Text>

      <Text style={styles.label}>BILLING PERIOD</Text>
      <TextInput
        value={periodLabel}
        onChangeText={setPeriodLabel}
        placeholder="e.g. August 2026"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
        accessibilityLabel="Billing period"
      />

      <View style={styles.inputRow}>
        <View style={styles.flex}>
          <Text style={styles.label}>AMOUNT</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="2750"
            placeholderTextColor={Colors.textFaint}
            keyboardType="decimal-pad"
            style={styles.input}
            accessibilityLabel="Invoice amount"
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>DUE DATE</Text>
          <TextInput
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textFaint}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            style={styles.input}
            accessibilityLabel="Due date in year month day format"
          />
        </View>
      </View>

      <View style={styles.selectionHeader}>
        <View>
          <Text style={styles.labelNoMargin}>FLATS</Text>
          <Text style={styles.selectionCount}>{selectedFlatIds.length} of {flats.length} selected</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={styles.selectAllButton}
          onPress={() => setSelectedFlatIds(allSelected ? [] : flats.map((flat) => flat.id))}>
          <Text style={styles.selectAllLabel}>{allSelected ? 'Clear all' : 'Select all'}</Text>
        </Pressable>
      </View>

      <AsyncState
        isLoading={profileQuery.isLoading || flatsQuery.isLoading || towersQuery.isLoading}
        isError={profileQuery.isError || flatsQuery.isError || towersQuery.isError}
        onRetry={() => {
          profileQuery.refetch();
          flatsQuery.refetch();
          towersQuery.refetch();
        }}
        isEmpty={!flatsQuery.isLoading && !flatsQuery.isError && flats.length === 0}
        emptyTitle="No flats available"
        emptyMessage="Create flats before issuing maintenance invoices."
      />

      <View style={styles.flatGrid}>
        {flats.map((flat) => {
          const tower = towerById.get(flat.tower_id);
          const selected = selectedFlatIds.includes(flat.id);
          return (
            <Pressable
              key={flat.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggleFlat(flat.id)}
              style={[styles.flatChoice, selected && styles.flatChoiceSelected]}>
              <Text style={[styles.flatChoiceLabel, selected && styles.flatChoiceLabelSelected]}>
                {tower?.code ?? '?'}-{flat.number}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave, busy: createInvoices.isPending }}
        style={[styles.saveButton, !canSave && styles.disabledButton]}
        onPress={handleSave}
        disabled={!canSave}>
        {createInvoices.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
        <Text style={styles.saveLabel}>
          {createInvoices.isPending ? 'Creating invoices...' : `Create ${selectedFlatIds.length || ''} invoice${selectedFlatIds.length === 1 ? '' : 's'}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { marginTop: 10, fontSize: 13, lineHeight: 19, color: Colors.textMuted },
  label: { marginTop: 18, fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt },
  labelNoMargin: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt },
  input: {
    minHeight: 50,
    marginTop: 8,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputRow: { flexDirection: 'row', gap: 10 },
  selectionHeader: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectionCount: { marginTop: 3, fontSize: 12, color: Colors.textMuted },
  selectAllButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  selectAllLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.success700 },
  flatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  flatChoice: {
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatChoiceSelected: { borderColor: Colors.green500, backgroundColor: Colors.green500 },
  flatChoiceLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary },
  flatChoiceLabelSelected: { color: Colors.textOnDark },
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

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { avatarColorForName, getInitials } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import type { ResidentProfile } from '@/features/residents/api';
import { useResidents } from '@/features/residents/api';
import { useTowers } from '@/features/towers/api';
import { useCreateVisitorRequest, type VisitorCategory } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const CATEGORIES: { value: VisitorCategory; label: string }[] = [
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'GUEST', label: 'Guest' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'CAB', label: 'Cab' },
];

type Step = 'details' | 'search' | 'sent';

function CheckIcon() {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 12.5l5 5L20 6.5" stroke={Colors.success700} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function RegisterVisitorScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const towersQuery = useTowers();
  const residentsQuery = useResidents();
  const createRequest = useCreateVisitorRequest();

  const [step, setStep] = useState<Step>('details');
  const [category, setCategory] = useState<VisitorCategory | undefined>(undefined);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<ResidentProfile | undefined>(undefined);

  const canContinue = !!category && name.trim().length > 1;

  const query = search.trim().toLowerCase();
  const filteredResidents = useMemo(
    () =>
      (residentsQuery.data ?? []).filter((resident) => {
        if (!query) return true;
        const flatLabel = `${resident.flat?.number ?? ''}`.toLowerCase();
        return resident.full_name.toLowerCase().includes(query) || flatLabel.includes(query);
      }),
    [residentsQuery.data, query],
  );

  function towerCodeFor(towerId: string | undefined) {
    return towersQuery.data?.find((t) => t.id === towerId)?.code;
  }

  function resetToDetails() {
    setStep('details');
    setCategory(undefined);
    setName('');
    setPhone('');
    setSearch('');
    setSelectedResident(undefined);
  }

  async function handleSendRequest() {
    if (!selectedResident?.flat_id || !category || !profileQuery.data || !session) return;
    try {
      await createRequest.mutateAsync({
        societyId: profileQuery.data.society_id,
        raisedBy: session.user.id,
        flatId: selectedResident.flat_id,
        visitorName: name.trim(),
        visitorPhone: phone.trim() || undefined,
        category,
      });
      setStep('sent');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not send the request');
    }
  }

  if (step === 'sent') {
    const flatCode = towerCodeFor(selectedResident?.flat?.tower_id);
    return (
      <View style={styles.successRoot}>
        <View style={styles.successIconWrap}>
          <CheckIcon />
        </View>
        <Text style={styles.successTitle}>Request Sent</Text>
        <Text style={styles.successSubtitle}>
          {selectedResident?.full_name} at{' '}
          {flatCode ? `${flatCode}-${selectedResident?.flat?.number}` : (selectedResident?.flat?.number ?? 'the flat')} has
          been notified and will approve or deny shortly.
        </Text>
        <Pressable style={styles.secondaryButton} onPress={resetToDetails}>
          <Text style={styles.secondaryButtonLabel}>Register Another Visitor</Text>
        </Pressable>
        <Pressable style={styles.doneButton} onPress={() => router.replace('/(guard)/(tabs)')}>
          <Text style={styles.doneButtonLabel}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'search') {
    return (
      <View style={styles.root}>
        <View style={styles.searchHeaderRow}>
          <BackArrowButton onPress={() => setStep('details')} />
          <Text style={styles.title}>Send to Resident</Text>
        </View>
        <View style={styles.searchBody}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or flat number"
            placeholderTextColor={Colors.textFaint}
            style={styles.searchInput}
          />
          <ScrollView contentContainerStyle={styles.residentList}>
            <AsyncState
              isLoading={residentsQuery.isLoading}
              isError={residentsQuery.isError}
              onRetry={() => residentsQuery.refetch()}
              isEmpty={filteredResidents.length === 0}
              emptyMessage="No residents match your search."
            />
            {filteredResidents.map((resident) => {
              const isSelected = selectedResident?.id === resident.id;
              const towerCode = towerCodeFor(resident.flat?.tower_id);
              return (
                <Pressable
                  key={resident.id}
                  style={[styles.residentRow, isSelected && styles.residentRowSelected]}
                  onPress={() => setSelectedResident(resident)}>
                  <View style={[styles.residentAvatar, { backgroundColor: avatarColorForName(resident.full_name) }]}>
                    <Text style={styles.residentInitial}>{getInitials(resident.full_name)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.residentName}>{resident.full_name}</Text>
                    <Text style={styles.residentSub}>
                      {towerCode ? `${towerCode}-${resident.flat?.number}` : (resident.flat?.number ?? '—')}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.selectedDot}>
                      <Text style={styles.selectedDotLabel}>✓</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <Pressable
          style={[styles.saveButton, { backgroundColor: selectedResident ? Colors.green500 : '#C9C3B2' }]}
          onPress={handleSendRequest}
          disabled={!selectedResident || createRequest.isPending}>
          {createRequest.isPending && <ActivityIndicator size="small" color="#fff" />}
          <Text style={styles.saveLabel}>Send Request</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Register Visitor</Text>
      </View>

      <Text style={styles.label}>CATEGORY</Text>
      <View style={styles.chipsRow}>
        {CATEGORIES.map((item) => {
          const active = category === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setCategory(item.value)}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>VISITOR NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Ravi Kumar"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <Text style={styles.label}>PHONE (OPTIONAL)</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="numeric"
        placeholder="98765 43210"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <Pressable
        style={[styles.saveButton, { backgroundColor: canContinue ? Colors.green500 : '#C9C3B2' }]}
        onPress={() => setStep('search')}
        disabled={!canContinue}>
        <Text style={styles.saveLabel}>Next: Find Resident</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 18 },
  input: {
    marginTop: 8,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 13, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 13, fontWeight: '600', color: '#3E4A40' },
  saveButton: {
    marginTop: 26,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  saveLabel: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
  searchHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 66, paddingHorizontal: 20 },
  searchBody: { flex: 1, paddingHorizontal: 20 },
  searchInput: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontSize: 14.5,
    color: Colors.textPrimary,
  },
  residentList: { paddingTop: 14, paddingBottom: 20, gap: 10 },
  residentRow: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.cardLarge - 4,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  residentRowSelected: { borderColor: Colors.green500 },
  residentAvatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  residentInitial: { fontFamily: FontFamily.headingBold, fontSize: 16, color: Colors.green500 },
  residentName: { fontSize: 15, fontWeight: '600' },
  residentSub: { fontSize: 12.5, color: Colors.textMuted, marginTop: 2 },
  selectedDot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDotLabel: { color: Colors.textOnDark, fontSize: 12, fontWeight: '700' },
  successRoot: { flex: 1, backgroundColor: Colors.adminCanvas, padding: 24, paddingTop: 110, alignItems: 'center' },
  successIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: '#E3F2E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { fontFamily: FontFamily.headingExtraBold, fontSize: 24, textAlign: 'center' },
  successSubtitle: { fontSize: 13.5, color: Colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  secondaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  secondaryButtonLabel: { fontSize: 15, fontWeight: '700', color: Colors.green500 },
  doneButton: {
    width: '100%',
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  doneButtonLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.green500 },
});

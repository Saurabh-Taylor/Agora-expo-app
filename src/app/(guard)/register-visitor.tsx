import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  avatarColorForName,
  getInitials,
  isVehicleDetailsValid,
  normalizeSingleLineInput,
  normalizeVehicleNumber,
} from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { VehicleFields } from '@/components/vehicle-fields';
import { Colors, FontFamily, Radius, VisitorCategoryOptions, type VisitorVehicleType } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import {
  useCreateVisitorRequest,
  useGuardResidentSearch,
  type GuardResidentSearchResult,
  type VisitorCategory,
} from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

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
  const createRequest = useCreateVisitorRequest();

  const [step, setStep] = useState<Step>('details');
  const [category, setCategory] = useState<VisitorCategory | undefined>(undefined);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<VisitorVehicleType | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [search, setSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<GuardResidentSearchResult | undefined>(undefined);
  const residentsQuery = useGuardResidentSearch(search, step === "search" ? profileQuery.data?.society_id : undefined);

  const canContinue = !!category && name.trim().length > 1 && isVehicleDetailsValid(vehicleNumber, vehicleType);
  const filteredResidents = residentsQuery.data ?? [];

  function resetToDetails() {
    setStep('details');
    setCategory(undefined);
    setName('');
    setPhone('');
    setVehicleType(null);
    setVehicleNumber('');
    setSearch('');
    setSelectedResident(undefined);
  }

  async function handleSendRequest() {
    if (!selectedResident?.flat_id || !category || !profileQuery.data || !session) return;
    try {
      await createRequest.mutateAsync({
        societyId: profileQuery.data.society_id,
        flatId: selectedResident.flat_id,
        visitorName: normalizeSingleLineInput(name),
        visitorPhone: normalizeSingleLineInput(phone) || undefined,
        category,
        vehicleType: vehicleType ?? undefined,
        vehicleNumber: vehicleType ? normalizeVehicleNumber(vehicleNumber) : undefined,
      });
      setStep('sent');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not send the request');
    }
  }

  if (step === 'sent') {
    return (
      <View style={styles.successRoot}>
        <View style={styles.successIconWrap}>
          <CheckIcon />
        </View>
        <Text style={styles.successTitle}>Request Sent</Text>
        <Text style={styles.successSubtitle}>
          {selectedResident?.full_name} at{' '}
          {selectedResident ? `${selectedResident.tower_code}-${selectedResident.flat_number}` : 'the flat'} has been
          notified and will approve or deny shortly.
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
            onChangeText={(value) => {
              setSearch(value);
              setSelectedResident(undefined);
            }}
            onBlur={() => setSearch(normalizeSingleLineInput(search))}
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
                      {`${resident.tower_code}-${resident.flat_number}`}
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Register Visitor</Text>
      </View>

      <Text style={styles.label}>CATEGORY</Text>
      <View style={styles.chipsRow}>
        {VisitorCategoryOptions.map((item) => {
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
        onBlur={() => setName(normalizeSingleLineInput(name))}
        placeholder="e.g. Ravi Kumar"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <Text style={styles.label}>PHONE (OPTIONAL)</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        onBlur={() => setPhone(normalizeSingleLineInput(phone))}
        keyboardType="numeric"
        placeholder="98765 43210"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <VehicleFields
        vehicleType={vehicleType}
        vehicleNumber={vehicleNumber}
        onTypeChange={setVehicleType}
        onNumberChange={setVehicleNumber}
      />

      <Pressable
        style={[styles.saveButton, { backgroundColor: canContinue ? Colors.green500 : '#C9C3B2' }]}
        onPress={() => setStep('search')}
        disabled={!canContinue}>
        <Text style={styles.saveLabel}>Next: Find Resident</Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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

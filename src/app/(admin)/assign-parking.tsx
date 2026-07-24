import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import {
  useAssignParkingSlot,
  useParkingLayout,
  useParkingRealtime,
  useReleaseParkingSlot,
  useResidentVehicles,
  useSetParkingSlotActive,
} from '@/features/parking/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function AssignParkingScreen() {
  const { slotId } = useLocalSearchParams<{ slotId?: string }>();
  const [search, setSearch] = useState('');
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const layoutQuery = useParkingLayout(societyId);
  const vehiclesQuery = useResidentVehicles(societyId);
  const assignSlot = useAssignParkingSlot();
  const releaseSlot = useReleaseParkingSlot();
  const setSlotActive = useSetParkingSlotActive();
  useParkingRealtime(societyId);
  const slot = (layoutQuery.data ?? []).find((item) => item.id === slotId);
  const normalizedSearch = search.trim().toLowerCase();
  const vehicles = (vehiclesQuery.data ?? []).filter((vehicle) => {
    const flatLabel = `${vehicle.flat?.tower?.code ?? ''}-${vehicle.flat?.number ?? ''}`;
    return !normalizedSearch || `${vehicle.registration_number} ${vehicle.make_model ?? ''} ${flatLabel}`.toLowerCase().includes(normalizedSearch);
  });
  const isPending = assignSlot.isPending || releaseSlot.isPending || setSlotActive.isPending;

  async function assign(vehicleId: string) {
    if (!societyId || !slot) return;
    try {
      await assignSlot.mutateAsync({ societyId, slotId: slot.id, vehicleId });
      showToast(slot.assignment ? 'Parking reassigned' : 'Parking assigned');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not assign parking'));
    }
  }

  async function release() {
    if (!societyId || !slot?.assignment) return;
    try {
      await releaseSlot.mutateAsync({ societyId, slotId: slot.id });
      showToast('Parking slot released');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not release parking'));
    }
  }

  async function toggleActive() {
    if (!societyId || !slot) return;
    try {
      await setSlotActive.mutateAsync({ societyId, slotId: slot.id, active: !slot.is_active });
      showToast(slot.is_active ? 'Parking slot deactivated' : 'Parking slot activated');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update parking slot'));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}><BackArrowButton onPress={() => router.back()} /><Text accessibilityRole="header" style={styles.title}>Slot assignment</Text></View>
      <AsyncState
        isLoading={profileQuery.isLoading || layoutQuery.isLoading || vehiclesQuery.isLoading}
        isError={profileQuery.isError || layoutQuery.isError || vehiclesQuery.isError || (!layoutQuery.isLoading && !slot)}
        errorTitle="Parking slot unavailable"
        errorMessage="This slot does not exist in your society or could not be loaded."
        onRetry={() => { profileQuery.refetch(); layoutQuery.refetch(); vehiclesQuery.refetch(); }}
      />
      {slot && (
        <>
          <View style={[styles.slotCard, slot.assignment ? styles.occupiedCard : styles.vacantCard]}>
            <View style={styles.flex}><Text style={styles.slotCode}>{slot.code}</Text><Text style={styles.slotMeta}>{slot.zone} · {slot.level_label} · {slot.slot_type}</Text><Text style={styles.state}>{slot.is_active ? (slot.assignment ? 'Occupied' : 'Vacant') : 'Inactive'}</Text></View>
            <Pressable accessibilityRole="button" disabled={isPending || !!slot.assignment} onPress={toggleActive} style={[styles.outlineButton, (isPending || !!slot.assignment) && styles.disabled]}><Text style={styles.outlineLabel}>{slot.is_active ? 'Deactivate' : 'Activate'}</Text></Pressable>
          </View>

          {slot.assignment?.vehicle && (
            <View style={styles.currentCard}>
              <Text style={styles.eyebrow}>CURRENT ASSIGNMENT</Text>
              <Text style={styles.registration}>{slot.assignment.vehicle.registration_number}</Text>
              <Text style={styles.vehicleMeta}>{slot.assignment.vehicle.make_model ?? slot.assignment.vehicle.vehicle_type} · Flat {slot.assignment.flat?.tower?.code ?? '?'}-{slot.assignment.flat?.number ?? '?'}</Text>
              <Pressable accessibilityRole="button" disabled={isPending} onPress={release} style={[styles.releaseButton, isPending && styles.disabled]}>{releaseSlot.isPending && <ActivityIndicator size="small" color={Colors.danger700} />}<Text style={styles.releaseLabel}>Release slot</Text></Pressable>
            </View>
          )}

          {slot.is_active && (
            <>
              <Text style={styles.sectionTitle}>{slot.assignment ? 'Reassign to another vehicle' : 'Assign a resident vehicle'}</Text>
              <TextInput value={search} onChangeText={setSearch} placeholder="Search vehicle or flat" placeholderTextColor={Colors.textFaint} style={styles.search} returnKeyType="search" accessibilityLabel="Search resident vehicles" />
              <AsyncState isLoading={false} isError={false} isEmpty={vehicles.length === 0} emptyTitle={search ? 'No matching vehicles' : 'No resident vehicles'} emptyMessage={search ? 'Try another registration number or flat.' : 'A resident must add a vehicle before it can be assigned.'} actionLabel={search ? 'Clear search' : undefined} onAction={search ? () => setSearch('') : undefined} />
              <View style={styles.list}>{vehicles.map((vehicle) => {
                const isCurrent = slot.assignment?.vehicle_id === vehicle.id;
                return <Pressable key={vehicle.id} accessibilityRole="button" disabled={isPending || isCurrent} onPress={() => assign(vehicle.id)} style={[styles.vehicleRow, isCurrent && styles.currentRow, (isPending || isCurrent) && styles.disabled]}><View style={styles.flex}><Text style={styles.vehicleRegistration}>{vehicle.registration_number}</Text><Text style={styles.vehicleMeta}>{vehicle.make_model ?? vehicle.vehicle_type} · Flat {vehicle.flat?.tower?.code ?? '?'}-{vehicle.flat?.number ?? '?'}</Text></View><Text style={styles.assignLabel}>{isCurrent ? 'Assigned' : slot.assignment ? 'Reassign' : 'Assign'}</Text></Pressable>;
              })}</View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas }, content: { paddingHorizontal: 18, paddingBottom: 48 }, flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  slotCard: { marginTop: 20, minHeight: 100, padding: 16, borderRadius: Radius.card, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 12 }, occupiedCard: { backgroundColor: '#FCEBE8', borderColor: Colors.danger700 }, vacantCard: { backgroundColor: '#E9F7EE', borderColor: Colors.success700 },
  slotCode: { fontFamily: FontFamily.headingExtraBold, fontSize: 24, color: Colors.textPrimary }, slotMeta: { marginTop: 3, fontSize: 12, color: Colors.textMuted }, state: { marginTop: 7, fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  outlineButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.textMuted, alignItems: 'center', justifyContent: 'center' }, outlineLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
  currentCard: { marginTop: 14, padding: 16, borderRadius: Radius.card, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }, eyebrow: { fontSize: 10.5, letterSpacing: 1.4, fontWeight: '700', color: Colors.textMuted }, registration: { marginTop: 8, fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textPrimary }, vehicleMeta: { marginTop: 3, fontSize: 12.5, color: Colors.textMuted },
  releaseButton: { minHeight: 46, marginTop: 14, borderRadius: 13, backgroundColor: '#FCEBE8', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, releaseLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.danger700 },
  sectionTitle: { marginTop: 24, fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textPrimary }, search: { minHeight: 48, marginTop: 10, paddingHorizontal: 14, borderRadius: Radius.input, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, color: Colors.textPrimary }, list: { gap: 9, marginTop: 10 },
  vehicleRow: { minHeight: 72, padding: 14, borderRadius: Radius.input, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }, currentRow: { borderColor: Colors.success700, backgroundColor: '#E9F7EE' }, vehicleRegistration: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary }, assignLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.success700 }, disabled: { opacity: 0.5 },
});

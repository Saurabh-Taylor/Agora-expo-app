import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { ParkingLayoutGrid } from '@/components/parking-layout-grid';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import {
  ResidentVehicleTypes,
  type ResidentVehicle,
  type ResidentVehicleType,
  useCreateResidentVehicle,
  useDeactivateResidentVehicle,
  useParkingLayout,
  useParkingRealtime,
  useResidentVehicles,
  useUpdateResidentVehicle,
} from '@/features/parking/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function ResidentVehiclesScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const profile = profileQuery.data;
  const vehiclesQuery = useResidentVehicles(profile?.society_id, profile?.flat_id);
  const layoutQuery = useParkingLayout(profile?.society_id);
  const createVehicle = useCreateResidentVehicle();
  const updateVehicle = useUpdateResidentVehicle();
  const deactivateVehicle = useDeactivateResidentVehicle();
  useParkingRealtime(profile?.society_id);
  const [editingVehicle, setEditingVehicle] = useState<ResidentVehicle | null>(null);
  const [registration, setRegistration] = useState('');
  const [vehicleType, setVehicleType] = useState<ResidentVehicleType>('CAR');
  const [makeModel, setMakeModel] = useState('');
  const [color, setColor] = useState('');
  const isPending = createVehicle.isPending || updateVehicle.isPending || deactivateVehicle.isPending;
  const assignedSlots = (layoutQuery.data ?? []).filter((slot) => slot.assignment?.flat_id === profile?.flat_id);

  function beginEdit(vehicle: ResidentVehicle) {
    setEditingVehicle(vehicle);
    setRegistration(vehicle.registration_number);
    setVehicleType(vehicle.vehicle_type);
    setMakeModel(vehicle.make_model ?? '');
    setColor(vehicle.color ?? '');
  }

  function resetForm() {
    setEditingVehicle(null);
    setRegistration('');
    setVehicleType('CAR');
    setMakeModel('');
    setColor('');
  }

  async function saveVehicle() {
    if (!profile?.society_id || (!editingVehicle && !registration.trim())) return;
    try {
      if (editingVehicle) {
        await updateVehicle.mutateAsync({ societyId: profile.society_id, vehicleId: editingVehicle.id, vehicleType, makeModel, color });
        showToast('Vehicle updated');
      } else {
        await createVehicle.mutateAsync({ societyId: profile.society_id, registrationNumber: registration, vehicleType, makeModel, color });
        showToast('Vehicle added');
      }
      resetForm();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not save vehicle'));
    }
  }

  async function removeVehicle(vehicle: ResidentVehicle) {
    if (!profile?.society_id || isPending) return;
    try {
      await deactivateVehicle.mutateAsync({ societyId: profile.society_id, vehicleId: vehicle.id });
      if (editingVehicle?.id === vehicle.id) resetForm();
      showToast('Vehicle removed');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not remove vehicle'));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}><BackArrowButton onPress={() => router.back()} /><View style={styles.flex}><Text accessibilityRole="header" style={styles.title}>My vehicles</Text><Text style={styles.subtitle}>Vehicles and parking assigned to your flat</Text></View></View>
      <AsyncState
        isLoading={profileQuery.isLoading || vehiclesQuery.isLoading || layoutQuery.isLoading}
        isError={profileQuery.isError || vehiclesQuery.isError || layoutQuery.isError}
        isRetrying={profileQuery.isRefetching || vehiclesQuery.isRefetching || layoutQuery.isRefetching}
        onRetry={() => { profileQuery.refetch(); vehiclesQuery.refetch(); layoutQuery.refetch(); }}
      />

      <Text style={styles.sectionTitle}>Assigned parking</Text>
      {assignedSlots.length > 0 ? <ParkingLayoutGrid slots={assignedSlots} /> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No parking assigned</Text><Text style={styles.emptyText}>Your society admin can assign a slot after you add a vehicle.</Text></View>}

      <Text style={styles.sectionTitle}>Vehicle records</Text>
      <View style={styles.list}>{(vehiclesQuery.data ?? []).map((vehicle) => <View key={vehicle.id} style={styles.vehicleCard}><View style={styles.flex}><Text style={styles.registration}>{vehicle.registration_number}</Text><Text style={styles.vehicleMeta}>{vehicle.make_model ?? vehicle.vehicle_type}{vehicle.color ? ` · ${vehicle.color}` : ''}</Text></View><Pressable accessibilityRole="button" disabled={isPending} onPress={() => beginEdit(vehicle)} style={styles.smallButton}><Text style={styles.smallButtonLabel}>Edit</Text></Pressable><Pressable accessibilityRole="button" disabled={isPending} onPress={() => removeVehicle(vehicle)} style={[styles.smallButton, styles.removeButton]}><Text style={styles.removeLabel}>Remove</Text></Pressable></View>)}</View>
      {!vehiclesQuery.isLoading && (vehiclesQuery.data ?? []).length === 0 && <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No vehicles yet</Text><Text style={styles.emptyText}>Add your car, bike, EV, or other vehicle below.</Text></View>}

      <View style={styles.formCard}>
        <View style={styles.formHeader}><Text style={styles.formTitle}>{editingVehicle ? 'Edit vehicle' : 'Add vehicle'}</Text>{editingVehicle && <Pressable accessibilityRole="button" onPress={resetForm}><Text style={styles.cancelLabel}>Cancel</Text></Pressable>}</View>
        <Text style={styles.label}>REGISTRATION NUMBER</Text><TextInput editable={!editingVehicle} value={registration} onChangeText={setRegistration} autoCapitalize="characters" placeholder="MH12AB1234" placeholderTextColor={Colors.textFaint} style={[styles.input, !!editingVehicle && styles.readonly]} accessibilityLabel="Vehicle registration number" />
        <Text style={styles.label}>TYPE</Text><View style={styles.choices}>{ResidentVehicleTypes.map((type) => <Pressable key={type} accessibilityRole="radio" accessibilityState={{ checked: vehicleType === type }} onPress={() => setVehicleType(type)} style={[styles.choice, vehicleType === type && styles.choiceActive]}><Text style={[styles.choiceLabel, vehicleType === type && styles.choiceLabelActive]}>{type}</Text></Pressable>)}</View>
        <Text style={styles.label}>MAKE / MODEL</Text><TextInput value={makeModel} onChangeText={setMakeModel} placeholder="Tata Nexon" placeholderTextColor={Colors.textFaint} style={styles.input} />
        <Text style={styles.label}>COLOR</Text><TextInput value={color} onChangeText={setColor} placeholder="White" placeholderTextColor={Colors.textFaint} style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: isPending || (!editingVehicle && !registration.trim()), busy: isPending }} disabled={isPending || (!editingVehicle && !registration.trim())} onPress={saveVehicle} style={[styles.saveButton, (isPending || (!editingVehicle && !registration.trim())) && styles.disabled]}>{(createVehicle.isPending || updateVehicle.isPending) && <ActivityIndicator size="small" color={Colors.textOnDark} />}<Text style={styles.saveLabel}>{editingVehicle ? 'Save changes' : 'Add vehicle'}</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas }, content: { paddingHorizontal: 16, paddingBottom: 48 }, flex: { flex: 1, minWidth: 0 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary }, subtitle: { marginTop: 2, fontSize: 12.5, color: Colors.textMuted },
  sectionTitle: { marginTop: 24, marginBottom: 10, fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textPrimary }, emptyCard: { padding: 18, borderRadius: Radius.card, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }, emptyTitle: { fontWeight: '700', fontSize: 14.5, color: Colors.textPrimary }, emptyText: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: Colors.textMuted },
  list: { gap: 9 }, vehicleCard: { minHeight: 76, padding: 13, borderRadius: Radius.input, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 7 }, registration: { fontWeight: '800', fontSize: 15, color: Colors.textPrimary }, vehicleMeta: { marginTop: 3, fontSize: 12, color: Colors.textMuted }, smallButton: { minHeight: 44, paddingHorizontal: 10, borderRadius: 12, backgroundColor: Colors.categorySecurity.bg, alignItems: 'center', justifyContent: 'center' }, smallButtonLabel: { fontWeight: '700', fontSize: 12, color: Colors.success700 }, removeButton: { backgroundColor: '#FCEBE8' }, removeLabel: { fontWeight: '700', fontSize: 12, color: Colors.danger700 },
  formCard: { marginTop: 22, padding: 16, borderRadius: Radius.card, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }, formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, formTitle: { fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textPrimary }, cancelLabel: { minHeight: 44, paddingTop: 12, color: Colors.danger700, fontWeight: '700' }, label: { marginTop: 15, fontSize: 10.5, letterSpacing: 1.3, fontWeight: '700', color: Colors.textMutedAlt }, input: { minHeight: 48, marginTop: 7, borderRadius: Radius.input, borderWidth: 1.5, borderColor: Colors.borderAlt, paddingHorizontal: 13, color: Colors.textPrimary }, readonly: { backgroundColor: '#EEECE7', color: Colors.textMuted }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }, choice: { minHeight: 44, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center' }, choiceActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 }, choiceLabel: { fontWeight: '700', color: Colors.textPrimary }, choiceLabelActive: { color: Colors.textOnDark }, saveButton: { minHeight: 52, marginTop: 22, borderRadius: Radius.button, backgroundColor: Colors.green500, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, saveLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.textOnDark }, disabled: { opacity: 0.5 },
});

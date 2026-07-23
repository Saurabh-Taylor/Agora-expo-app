import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useDeleteEmptyFlat, useFlatWithTower, useUpdateFlat, type FlatWithTower } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useResidents, type ResidentProfile } from '@/features/residents/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function FlatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const flatQuery = useFlatWithTower(id, societyId);
  const residentsQuery = useResidents(societyId);
  const resident = residentsQuery.data?.find((item) => item.flat_id === id);
  const isLoading = profileQuery.isLoading || flatQuery.isLoading || residentsQuery.isLoading;
  const isError = profileQuery.isError || flatQuery.isError || residentsQuery.isError;

  if (isLoading || isError || !flatQuery.data || !societyId) {
    return (
      <View style={styles.root}>
        <AsyncState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => {
            profileQuery.refetch();
            flatQuery.refetch();
            residentsQuery.refetch();
          }}
          isEmpty={!isLoading && !isError && !flatQuery.data}
          emptyMessage="Flat not found."
        />
      </View>
    );
  }

  return <FlatDetails key={flatQuery.data.id} flat={flatQuery.data} resident={resident} societyId={societyId} />;
}

function FlatDetails({
  flat,
  resident,
  societyId,
}: {
  flat: FlatWithTower;
  resident: ResidentProfile | undefined;
  societyId: string;
}) {
  const updateFlat = useUpdateFlat();
  const deleteFlat = useDeleteEmptyFlat();
  const [isEditing, setIsEditing] = useState(false);
  const [number, setNumber] = useState(flat.number);
  const [floor, setFloor] = useState(String(flat.floor));
  const floorNumber = Number.parseInt(floor, 10);
  const canSave =
    number.trim().length > 0 &&
    Number.isInteger(floorNumber) &&
    floorNumber >= 0 &&
    floorNumber <= (flat.tower?.floors ?? 0) &&
    (number.trim().toUpperCase() !== flat.number || floorNumber !== flat.floor);

  async function handleSave() {
    if (!canSave) return;
    try {
      await updateFlat.mutateAsync({ id: flat.id, societyId, number: number.trim(), floor: floorNumber });
      showToast('Flat details updated');
      setIsEditing(false);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update the flat'));
    }
  }

  function confirmDelete() {
    if (resident || deleteFlat.isPending) return;
    Alert.alert(
      'Delete empty flat?',
      'This permanently removes the flat. Flats with residents or activity history cannot be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFlat.mutateAsync({ id: flat.id, societyId });
              showToast('Flat deleted');
              router.replace('/(admin)/(tabs)/community');
            } catch (error) {
              showToast(getErrorMessage(error, 'Could not delete the flat'));
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <View style={styles.flex}>
          <Text style={styles.title}>{flat.tower?.code}-{flat.number}</Text>
          <Text style={styles.subtitle}>{flat.tower?.name ?? 'Unknown tower'} - Floor {flat.floor}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={styles.editButton}
          onPress={() => setIsEditing((current) => !current)}>
          <Text style={styles.editButtonLabel}>{isEditing ? 'Cancel' : 'Edit'}</Text>
        </Pressable>
      </View>

      {isEditing && (
        <View style={styles.editCard}>
          <Text style={styles.label}>FLAT NUMBER</Text>
          <TextInput
            value={number}
            onChangeText={setNumber}
            style={styles.input}
            autoCapitalize="characters"
            placeholder="Flat number"
            placeholderTextColor={Colors.textFaint}
          />
          <Text style={styles.label}>FLOOR</Text>
          <TextInput
            value={floor}
            onChangeText={setFloor}
            style={styles.input}
            keyboardType="number-pad"
            placeholder="Floor"
            placeholderTextColor={Colors.textFaint}
          />
          <Pressable
            accessibilityRole="button"
            style={[styles.saveButton, !canSave && styles.disabledButton]}
            onPress={handleSave}
            disabled={!canSave || updateFlat.isPending}>
            {updateFlat.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
            <Text style={styles.saveLabel}>{updateFlat.isPending ? 'Saving...' : 'Save changes'}</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.sectionLabel}>OCCUPANCY</Text>
      {resident ? (
        <Pressable style={styles.residentCard} onPress={() => router.push(`/(admin)/resident/${resident.id}`)}>
          <View style={styles.statusDot} />
          <View style={styles.flex}>
            <Text style={styles.residentName}>{resident.full_name}</Text>
            <Text style={styles.subtitle}>{resident.occupancy_type ?? 'Resident'} - Verified {resident.is_verified ? 'yes' : 'no'}</Text>
          </View>
          <Text style={styles.linkLabel}>View</Text>
        </Pressable>
      ) : (
        <View style={styles.vacantCard}>
          <Text style={styles.vacantTitle}>Vacant flat</Text>
          <Text style={styles.subtitle}>No resident is currently assigned.</Text>
          <Pressable
            style={styles.assignButton}
            onPress={() => router.push(`/(admin)/add-resident?towerId=${flat.tower_id}&flatNumber=${flat.number}`)}>
            <Text style={styles.assignButtonLabel}>Assign resident</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Delete flat</Text>
        <Text style={styles.dangerDescription}>
          {resident
            ? 'Remove or reassign the resident before deleting this flat.'
            : 'Only an unused flat with no activity history can be permanently deleted.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={[styles.deleteButton, (resident || deleteFlat.isPending) && styles.disabledButton]}
          onPress={confirmDelete}
          disabled={!!resident || deleteFlat.isPending}>
          {deleteFlat.isPending && <ActivityIndicator size="small" color={Colors.danger700} />}
          <Text style={styles.deleteButtonLabel}>{deleteFlat.isPending ? 'Deleting...' : 'Delete empty flat'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  editButton: {
    minWidth: 58,
    minHeight: 44,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.green500 },
  editCard: { marginTop: 20, padding: 16, borderRadius: Radius.card, backgroundColor: Colors.surface },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 10 },
  input: {
    marginTop: 7,
    minHeight: 50,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    paddingHorizontal: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  saveButton: {
    marginTop: 18,
    minHeight: 50,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14.5, color: Colors.textOnDark },
  disabledButton: { opacity: 0.45 },
  sectionLabel: { marginTop: 24, fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt },
  residentCard: {
    marginTop: 10,
    minHeight: 74,
    padding: 14,
    borderRadius: Radius.card - 4,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success600 },
  residentName: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.textPrimary },
  linkLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.success700 },
  vacantCard: { marginTop: 10, padding: 16, borderRadius: Radius.card - 4, backgroundColor: '#F6ECD8' },
  vacantTitle: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: '#5C4408' },
  assignButton: {
    marginTop: 13,
    minHeight: 46,
    borderRadius: Radius.input,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.textOnDark },
  dangerZone: {
    marginTop: 24,
    padding: 16,
    borderRadius: Radius.card - 4,
    borderWidth: 1,
    borderColor: '#EFC8C3',
    backgroundColor: '#FFF8F7',
  },
  dangerTitle: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.danger700 },
  dangerDescription: { marginTop: 5, fontSize: 12.5, lineHeight: 18, color: Colors.textMuted },
  deleteButton: {
    marginTop: 13,
    minHeight: 46,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.danger700,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.danger700 },
});

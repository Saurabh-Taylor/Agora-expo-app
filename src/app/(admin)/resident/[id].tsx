import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { avatarColorForName, getErrorMessage, getInitials, getVerificationStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useFlats } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import {
  useResident,
  useSetResidentActive,
  useSetResidentVerified,
  useUpdateResident,
  type ResidentProfile,
} from '@/features/residents/api';
import { useTowers, type Tower } from '@/features/towers/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function ResidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const residentQuery = useResident(id, societyId);
  const towersQuery = useTowers(societyId);
  const flatsQuery = useFlats(societyId);
  const isLoading =
    profileQuery.isLoading || residentQuery.isLoading || towersQuery.isLoading || flatsQuery.isLoading;
  const isError =
    profileQuery.isError || residentQuery.isError || towersQuery.isError || flatsQuery.isError;

  if (isLoading || isError || !residentQuery.data || !societyId) {
    return (
      <View style={styles.root}>
        <AsyncState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => {
            profileQuery.refetch();
            residentQuery.refetch();
            towersQuery.refetch();
            flatsQuery.refetch();
          }}
          isEmpty={!isLoading && !isError && !residentQuery.data}
          emptyMessage="Resident not found."
        />
      </View>
    );
  }

  return (
    <ResidentManager
      key={residentQuery.data.id}
      resident={residentQuery.data}
      towers={towersQuery.data ?? []}
      flats={flatsQuery.data ?? []}
      societyId={societyId}
    />
  );
}

function ResidentManager({
  resident,
  towers,
  flats,
  societyId,
}: {
  resident: ResidentProfile;
  towers: Tower[];
  flats: { id: string; tower_id: string; number: string; floor: number }[];
  societyId: string;
}) {
  const updateResident = useUpdateResident();
  const setVerified = useSetResidentVerified();
  const setActive = useSetResidentActive();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(resident.full_name);
  const [phone, setPhone] = useState(resident.phone ?? '');
  const [flatId, setFlatId] = useState(resident.flat_id ?? '');
  const [occupancyType, setOccupancyType] = useState<'OWNER' | 'TENANT'>(resident.occupancy_type ?? 'OWNER');
  const tower = towers.find((item) => item.id === resident.flat?.tower_id);
  const availableFlats = flats;
  const selectedFlat = flats.find((flat) => flat.id === flatId);
  const selectedTower = towers.find((item) => item.id === selectedFlat?.tower_id);
  const status = getVerificationStatusStyle(resident.is_verified);
  const canSave =
    fullName.trim().length > 1 &&
    !!flatId &&
    (fullName.trim() !== resident.full_name ||
      phone.trim() !== (resident.phone ?? '') ||
      flatId !== resident.flat_id ||
      occupancyType !== resident.occupancy_type);
  const mutationPending = updateResident.isPending || setVerified.isPending || setActive.isPending;

  async function handleSave() {
    if (!canSave) return;
    try {
      await updateResident.mutateAsync({
        residentId: resident.id,
        societyId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        flatId,
        occupancyType,
        isVerified: resident.is_verified,
      });
      showToast('Resident details updated');
      setIsEditing(false);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update the resident'));
    }
  }

  async function handleVerification() {
    try {
      await setVerified.mutateAsync({
        residentId: resident.id,
        societyId,
        verified: !resident.is_verified,
      });
      showToast(resident.is_verified ? 'Resident marked unverified' : 'Resident verified');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update verification'));
    }
  }

  function handleAccessChange() {
    const nextActive = !resident.is_active;
    const run = async () => {
      try {
        await setActive.mutateAsync({ residentId: resident.id, societyId, active: nextActive });
        showToast(nextActive ? 'Resident access activated' : 'Resident access deactivated');
      } catch (error) {
        showToast(getErrorMessage(error, 'Could not update resident access'));
      }
    };

    if (nextActive) {
      void run();
      return;
    }
    Alert.alert(
      'Deactivate resident access?',
      'The resident will immediately lose access to society data and workflows. Their history and flat assignment will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => void run() },
      ],
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <View style={styles.flex} />
        <Pressable
          accessibilityRole="button"
          style={styles.editButton}
          onPress={() => setIsEditing((current) => !current)}
          disabled={mutationPending}>
          <Text style={styles.editButtonLabel}>{isEditing ? 'Cancel' : 'Edit'}</Text>
        </Pressable>
      </View>

      <View style={styles.profileRow}>
        <View style={[styles.avatar, { backgroundColor: avatarColorForName(resident.full_name) }]}>
          <Text style={styles.avatarLabel}>{getInitials(resident.full_name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{resident.full_name}</Text>
          <Text style={styles.unitLine}>
            {tower ? `${tower.code}-${resident.flat?.number}` : resident.flat?.number ?? '-'} -{' '}
            {resident.occupancy_type === 'OWNER' ? 'Owner' : 'Tenant'}
          </Text>
        </View>
      </View>

      <View style={styles.pillRow}>
        <StatusPill label={status.label} color={status.color} backgroundColor={status.bg} />
        <StatusPill
          label={resident.is_active ? 'Active' : 'Inactive'}
          color={resident.is_active ? Colors.success600 : Colors.danger700}
          backgroundColor={resident.is_active ? '#E3F2E9' : '#F9E4E1'}
        />
      </View>

      {isEditing ? (
        <View style={styles.card}>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholder="Resident name" />
          <Text style={styles.label}>PHONE</Text>
          <TextInput value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" placeholder="Phone number" />

          <Text style={styles.label}>OCCUPANCY</Text>
          <View style={styles.choiceRow}>
            {(['OWNER', 'TENANT'] as const).map((choice) => (
              <Pressable
                key={choice}
                style={[styles.choice, occupancyType === choice && styles.choiceActive]}
                onPress={() => setOccupancyType(choice)}>
                <Text style={[styles.choiceLabel, occupancyType === choice && styles.choiceLabelActive]}>
                  {choice === 'OWNER' ? 'Owner' : 'Tenant'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>FLAT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.flatChoices}>
            {availableFlats.map((flat) => {
              const flatTower = towers.find((item) => item.id === flat.tower_id);
              const active = flat.id === flatId;
              return (
                <Pressable
                  key={flat.id}
                  style={[styles.flatChoice, active && styles.choiceActive]}
                  onPress={() => setFlatId(flat.id)}>
                  <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>
                    {flatTower?.code ?? '?'}-{flat.number}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.selectionHint}>
            Selected: {selectedTower?.name ?? 'Tower'} - {selectedFlat?.number ?? 'No flat'}
          </Text>

          <Pressable
            accessibilityRole="button"
            style={[styles.saveButton, !canSave && styles.disabledButton]}
            onPress={handleSave}
            disabled={!canSave || mutationPending}>
            {updateResident.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
            <Text style={styles.saveLabel}>{updateResident.isPending ? 'Saving...' : 'Save resident'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          {[
            { label: 'Phone', value: resident.phone ?? '-' },
            { label: 'Flat', value: tower ? `${tower.code}-${resident.flat?.number}` : resident.flat?.number ?? '-' },
            { label: 'Floor', value: String(resident.flat?.floor ?? '-') },
            { label: 'Occupancy', value: resident.occupancy_type === 'OWNER' ? 'Owner' : 'Tenant' },
            { label: 'Joined', value: new Date(resident.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) },
          ].map((row, index, rows) => (
            <View key={row.label} style={[styles.detailRow, index === rows.length - 1 && styles.detailRowLast]}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <Text style={styles.detailValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={styles.secondaryButton}
        onPress={handleVerification}
        disabled={mutationPending}>
        {setVerified.isPending && <ActivityIndicator size="small" color={Colors.green500} />}
        <Text style={styles.secondaryButtonLabel}>{resident.is_verified ? 'Mark as unverified' : 'Verify resident'}</Text>
      </Pressable>

      <View style={styles.accessCard}>
        <Text style={styles.accessTitle}>{resident.is_active ? 'Deactivate access' : 'Reactivate access'}</Text>
        <Text style={styles.accessDescription}>
          {resident.is_active
            ? 'Blocks this resident from all dashboards and society data while preserving their records.'
            : 'Restores this resident account and its assigned-flat workflows.'}
        </Text>
        <Pressable
          style={[styles.accessButton, resident.is_active ? styles.deactivateButton : styles.activateButton]}
          onPress={handleAccessChange}
          disabled={mutationPending}>
          {setActive.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
          <Text style={styles.accessButtonLabel}>
            {setActive.isPending ? 'Updating...' : resident.is_active ? 'Deactivate resident' : 'Reactivate resident'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
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
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  avatar: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 24, color: Colors.green500 },
  name: { fontFamily: FontFamily.headingExtraBold, fontSize: 23, color: Colors.textPrimary },
  unitLine: { fontSize: 13.5, color: Colors.textMuted, marginTop: 3 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  card: {
    marginTop: 18,
    padding: 16,
    borderRadius: Radius.card - 2,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  label: { marginTop: 12, fontSize: 11, letterSpacing: 1.4, fontWeight: '700', color: Colors.textMutedAlt },
  input: {
    marginTop: 7,
    minHeight: 50,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  choiceRow: { flexDirection: 'row', gap: 9, marginTop: 8 },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  choiceLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Colors.textPrimary },
  choiceLabelActive: { color: Colors.textOnDark },
  flatChoices: { gap: 8, paddingTop: 8, paddingRight: 16 },
  flatChoice: {
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: 12,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionHint: { marginTop: 9, fontSize: 12, color: Colors.textMuted },
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
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0ECE0' },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 13, color: Colors.textMuted },
  detailValue: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  secondaryButton: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.green500 },
  accessCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: Radius.card - 4,
    borderWidth: 1,
    borderColor: '#EFC8C3',
    backgroundColor: '#FFF8F7',
  },
  accessTitle: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.textPrimary },
  accessDescription: { marginTop: 5, fontSize: 12.5, lineHeight: 18, color: Colors.textMuted },
  accessButton: {
    marginTop: 13,
    minHeight: 48,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deactivateButton: { backgroundColor: Colors.danger700 },
  activateButton: { backgroundColor: Colors.success600 },
  accessButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.textOnDark },
});

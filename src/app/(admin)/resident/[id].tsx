import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { avatarColorForName, getInitials, getVerificationStatusStyle } from '@/commonFunctions';
import { useResident, useVerifyResident } from '@/features/residents/api';
import { useTowers } from '@/features/towers/api';
import { showToast } from '@/stores/toast-store';

export default function ResidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const residentQuery = useResident(id);
  const towersQuery = useTowers();
  const verifyMutation = useVerifyResident();

  const resident = residentQuery.data;
  const tower = towersQuery.data?.find((t) => t.id === resident?.flat?.tower_id);
  const isLoading = residentQuery.isLoading || towersQuery.isLoading;
  const isError = residentQuery.isError || towersQuery.isError;

  if (isLoading || isError || !resident) {
    return (
      <View style={styles.root}>
        <AsyncState isLoading={isLoading} isError={isError} isEmpty={!resident} emptyMessage="Resident not found." />
      </View>
    );
  }

  const status = getVerificationStatusStyle(resident.is_verified);
  const rows = [
    { label: 'Phone', value: resident.phone ?? '—' },
    { label: 'Flat', value: tower ? `${tower.code}-${resident.flat?.number}` : (resident.flat?.number ?? '—') },
    { label: 'Occupancy', value: resident.occupancy_type === 'OWNER' ? 'Owner' : resident.occupancy_type === 'TENANT' ? 'Tenant' : '—' },
    { label: 'Joined', value: new Date(resident.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackArrowButton onPress={() => router.back()} />
      <View style={styles.profileRow}>
        <View style={[styles.avatar, { backgroundColor: avatarColorForName(resident.full_name) }]}>
          <Text style={styles.avatarLabel}>{getInitials(resident.full_name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{resident.full_name}</Text>
          <Text style={styles.unitLine}>
            {tower ? `${tower.code}-${resident.flat?.number}` : (resident.flat?.number ?? '—')} ·{' '}
            {resident.occupancy_type === 'OWNER' ? 'Owner' : 'Tenant'}
          </Text>
        </View>
      </View>

      <StatusPill label={status.label} color={status.color} backgroundColor={status.bg} />

      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      {!resident.is_verified && (
        <Pressable
          style={styles.verifyButton}
          onPress={() => verifyMutation.mutate(resident.id)}
          disabled={verifyMutation.isPending}>
          {verifyMutation.isPending && <ActivityIndicator size="small" color="#fff" />}
          <Text style={styles.verifyLabel}>Verify resident</Text>
        </Pressable>
      )}

      <View style={styles.actionsRow}>
        <Pressable style={styles.actionButton} onPress={() => showToast('Calling is not available in this build')}>
          <Text style={styles.actionLabel}>Call</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={() => showToast('Messaging is not available in this build')}>
          <Text style={styles.actionLabel}>Message</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  avatar: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 24, color: Colors.green500 },
  name: { fontFamily: FontFamily.headingExtraBold, fontSize: 23 },
  unitLine: { fontSize: 13.5, color: Colors.textMuted, marginTop: 3 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0ECE0' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: Colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '600' },
  verifyButton: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.success600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  verifyLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '700' },
});

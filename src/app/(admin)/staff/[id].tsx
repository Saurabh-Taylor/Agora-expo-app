import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getInitials, getStaffStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useStaffDetail, useToggleStaffStatus } from '@/features/staff/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const staffQuery = useStaffDetail(id);
  const toggleStatus = useToggleStaffStatus();

  const staff = staffQuery.data;

  async function handleToggle() {
    if (!staff || !profileQuery.data) return;
    try {
      await toggleStatus.mutateAsync({
        id: staff.id,
        societyId: profileQuery.data.society_id,
        name: staff.name,
        status: staff.status === 'ON_DUTY' ? 'OFF_DUTY' : 'ON_DUTY',
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update status');
    }
  }

  if (!staff) {
    return (
      <View style={styles.root}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={staffQuery.isLoading}
          isError={staffQuery.isError}
          onRetry={() => staffQuery.refetch()}
          isEmpty={!staffQuery.isLoading && !staffQuery.isError}
          emptyMessage="This staff member isn't available."
        />
      </View>
    );
  }

  const statusStyle = getStaffStatusStyle(staff.status);
  const rows = [
    { label: 'Role', value: staff.role },
    { label: 'Shift', value: staff.shift ?? '—' },
    { label: 'Phone', value: staff.phone ?? '—' },
    { label: 'Added', value: new Date(staff.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackArrowButton onPress={() => router.back()} />
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{getInitials(staff.name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{staff.name}</Text>
          <Text style={styles.unitLine}>{staff.role}</Text>
        </View>
      </View>

      <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />

      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.toggleButton, { backgroundColor: staff.status === 'ON_DUTY' ? '#F0E7E4' : Colors.success600 }]}
        onPress={handleToggle}
        disabled={toggleStatus.isPending}>
        {toggleStatus.isPending && <ActivityIndicator size="small" color={staff.status === 'ON_DUTY' ? Colors.danger700 : '#fff'} />}
        <Text style={[styles.toggleLabel, { color: staff.status === 'ON_DUTY' ? Colors.danger700 : '#fff' }]}>
          {staff.status === 'ON_DUTY' ? 'Mark off duty' : 'Mark on duty'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#F6ECD8', alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 24, color: '#9A6B14' },
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
  toggleButton: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700' },
});

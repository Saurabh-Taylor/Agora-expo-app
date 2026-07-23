import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  formatMonthYear,
  getErrorMessage,
  getInitials,
  getServiceProviderStatusStyle,
  getStaffStatusStyle,
} from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import {
  useDirectoryRealtimeSync,
  useServiceProviderDetail,
  useSetServiceProviderStatus,
  useSetStaffStatus,
  useStaffDetail,
} from '@/features/staff/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type DirectoryEntryDetailProps = {
  kind: 'staff' | 'provider';
  id: string | undefined;
};

export function DirectoryEntryDetail({ kind, id }: DirectoryEntryDetailProps) {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const staffQuery = useStaffDetail(kind === 'staff' ? id : undefined, societyId);
  const providerQuery = useServiceProviderDetail(kind === 'provider' ? id : undefined, societyId);
  const setStaffStatus = useSetStaffStatus();
  const setProviderStatus = useSetServiceProviderStatus();
  const detailQuery = kind === 'staff' ? staffQuery : providerQuery;
  const record = detailQuery.data;
  useDirectoryRealtimeSync(societyId);

  async function handleToggle() {
    if (!record || !societyId) return;
    const status = record.status === 'ON_DUTY' ? 'OFF_DUTY' : 'ON_DUTY';
    try {
      if (kind === 'staff') {
        await setStaffStatus.mutateAsync({ id: record.id, societyId, status });
      } else {
        await setProviderStatus.mutateAsync({ id: record.id, societyId, status });
      }
      showToast(kind === 'staff' ? 'Staff duty status updated' : 'Provider availability updated');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update this directory entry'));
    }
  }

  if (!record) {
    return (
      <View style={styles.stateScreen}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={profileQuery.isLoading || detailQuery.isLoading}
          isError={profileQuery.isError || detailQuery.isError}
          onRetry={() => {
            profileQuery.refetch();
            detailQuery.refetch();
          }}
          isEmpty={!profileQuery.isLoading && !detailQuery.isLoading && !profileQuery.isError && !detailQuery.isError}
          emptyMessage="This directory entry isn't available."
        />
      </View>
    );
  }

  const isStaff = kind === 'staff' && 'role' in record;
  const statusStyle = isStaff ? getStaffStatusStyle(record.status) : getServiceProviderStatusStyle(record.status);
  const rows = isStaff
    ? [
        { label: 'Role', value: record.role },
        { label: 'Shift', value: record.shift ?? '' },
        { label: 'Phone', value: record.phone ?? '' },
        { label: 'Added', value: formatMonthYear(record.created_at) },
      ]
    : [
        { label: 'Category', value: 'category' in record ? record.category : '' },
        { label: 'Phone', value: record.phone ?? '' },
        { label: 'Added', value: formatMonthYear(record.created_at) },
      ];
  const classification = isStaff ? record.role : 'category' in record ? record.category : '';
  const isPending = setStaffStatus.isPending || setProviderStatus.isPending;
  const isEnabled = record.status === 'ON_DUTY';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Pressable
          style={styles.editButton}
          onPress={() =>
            router.push(
              (kind === 'staff'
                ? `/(admin)/edit-staff/${record.id}`
                : `/(admin)/edit-service-provider/${record.id}`) as Href,
            )
          }
          accessibilityRole="button">
          <Text style={styles.editLabel}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{getInitials(record.name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{record.name}</Text>
          <Text style={styles.unitLine}>{classification}</Text>
        </View>
      </View>

      <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />

      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue} numberOfLines={2}>{row.value}</Text>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.toggleButton, isEnabled ? styles.disableButton : styles.enableButton]}
        onPress={() => void handleToggle()}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityState={{ disabled: isPending, busy: isPending }}>
        {isPending && <ActivityIndicator size="small" color={isEnabled ? Colors.danger700 : Colors.textOnDark} />}
        <Text style={[styles.toggleLabel, isEnabled ? styles.disableLabel : styles.enableLabel]}>
          {kind === 'staff'
            ? isEnabled ? 'Mark off duty' : 'Mark on duty'
            : isEnabled ? 'Mark inactive' : 'Mark active'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  stateScreen: { flex: 1, backgroundColor: Colors.adminCanvas, paddingHorizontal: 20 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editButton: {
    minWidth: 64,
    minHeight: 44,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLabel: { fontSize: 14, fontWeight: '700', color: Colors.success700 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18, marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#F6ECD8', alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 24, color: '#9A6B14' },
  name: { fontFamily: FontFamily.headingExtraBold, fontSize: 23, color: Colors.textPrimary },
  unitLine: { fontSize: 13.5, color: Colors.textMuted, marginTop: 3 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0ECE0' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: Colors.textMuted },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  toggleButton: {
    minHeight: 52,
    marginTop: 16,
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  disableButton: { backgroundColor: '#F0E7E4' },
  enableButton: { backgroundColor: Colors.success600 },
  toggleLabel: { fontSize: 15, fontWeight: '700' },
  disableLabel: { color: Colors.danger700 },
  enableLabel: { color: Colors.textOnDark },
});

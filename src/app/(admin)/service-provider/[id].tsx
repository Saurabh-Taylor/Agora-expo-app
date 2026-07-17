import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getInitials, getServiceProviderStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useServiceProviderDetail, useToggleServiceProviderStatus } from '@/features/staff/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function ServiceProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const providerQuery = useServiceProviderDetail(id);
  const toggleStatus = useToggleServiceProviderStatus();

  const provider = providerQuery.data;

  async function handleToggle() {
    if (!provider || !profileQuery.data) return;
    try {
      await toggleStatus.mutateAsync({
        id: provider.id,
        societyId: profileQuery.data.society_id,
        name: provider.name,
        status: provider.status === 'ON_DUTY' ? 'OFF_DUTY' : 'ON_DUTY',
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update status');
    }
  }

  if (!provider) {
    return (
      <View style={styles.root}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={providerQuery.isLoading}
          isError={providerQuery.isError}
          onRetry={() => providerQuery.refetch()}
          isEmpty={!providerQuery.isLoading && !providerQuery.isError}
          emptyMessage="This service provider isn't available."
        />
      </View>
    );
  }

  const statusStyle = getServiceProviderStatusStyle(provider.status);
  const rows = [
    { label: 'Category', value: provider.category },
    { label: 'Phone', value: provider.phone ?? '—' },
    { label: 'Added', value: new Date(provider.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackArrowButton onPress={() => router.back()} />
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{getInitials(provider.name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{provider.name}</Text>
          <Text style={styles.unitLine}>{provider.category}</Text>
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
        style={[styles.toggleButton, { backgroundColor: provider.status === 'ON_DUTY' ? '#F0E7E4' : Colors.success600 }]}
        onPress={handleToggle}
        disabled={toggleStatus.isPending}>
        {toggleStatus.isPending && <ActivityIndicator size="small" color={provider.status === 'ON_DUTY' ? Colors.danger700 : '#fff'} />}
        <Text style={[styles.toggleLabel, { color: provider.status === 'ON_DUTY' ? Colors.danger700 : '#fff' }]}>
          {provider.status === 'ON_DUTY' ? 'Mark inactive' : 'Mark active'}
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

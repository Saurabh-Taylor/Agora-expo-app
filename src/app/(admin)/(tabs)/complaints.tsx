import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, getComplaintPriorityStyle, getComplaintStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { StatusPill } from '@/components/status-pill';
import { Colors, ComplaintStatuses, FontFamily, Radius } from '@/constants/commonConstants';
import { useAdminComplaints, useComplaintRealtimeSync, type ComplaintStatus } from '@/features/complaints/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

const FILTERS: { value: ComplaintStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...ComplaintStatuses,
];

export default function AdminComplaintsScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const complaintsQuery = useAdminComplaints(profileQuery.data?.society_id);
  const complaints = useMemo(() => complaintsQuery.data ?? [], [complaintsQuery.data]);
  useComplaintRealtimeSync(profileQuery.data?.society_id);
  const [filter, setFilter] = useState<ComplaintStatus | 'ALL'>('ALL');

  const openCount = complaints.filter((c) => c.status !== 'RESOLVED').length;
  const resolvedToday = complaints.filter(
    (c) => c.status === 'RESOLVED' && c.resolved_at && new Date(c.resolved_at).toDateString() === new Date().toDateString(),
  ).length;

  const filtered = useMemo(
    () => (filter === 'ALL' ? complaints : complaints.filter((c) => c.status === filter)),
    [complaints, filter],
  );

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Complaints</Text>
        <Text style={styles.subtitle}>
          {openCount} open · {resolvedToday} resolved today
        </Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setFilter(item.value)}
              style={[styles.filterChip, active ? styles.filterChipActive : styles.filterChipInactive]}>
              <Text style={active ? styles.filterLabelActive : styles.filterLabelInactive}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <AsyncState
            isLoading={complaintsQuery.isLoading}
            isError={complaintsQuery.isError}
            onRetry={() => complaintsQuery.refetch()}
            isEmpty={filtered.length === 0}
            emptyMessage="No complaints match this filter."
          />
        }
        renderItem={({ item }) => {
          const priorityStyle = getComplaintPriorityStyle(item.priority);
          const statusStyle = getComplaintStatusStyle(item.status);
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/(admin)/complaint/${item.id}`)}>
              <View style={styles.cardTopRow}>
                <View style={styles.categoryRow}>
                  <View style={[styles.priorityDot, { backgroundColor: priorityStyle.color }]} />
                  <Text style={styles.categoryLabel}>{item.category.toUpperCase()}</Text>
                </View>
                <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.cardBottomRow}>
                <Text style={styles.cardMeta}>
                  {item.raised_by_profile?.full_name ?? 'Resident'}
                  {item.flat ? ` · ${item.flat.tower ? `${item.flat.tower.code}-` : ''}${item.flat.number}` : ''}
                </Text>
                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  headerBlock: { paddingTop: 66, paddingHorizontal: 16 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 26 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 16 },
  filterChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  filterChipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  filterChipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  filterLabelActive: { fontSize: 13, fontWeight: '600', color: Colors.textOnDark },
  filterLabelInactive: { fontSize: 13, fontWeight: '600', color: '#3E4A40' },
  list: { flex: 1, paddingHorizontal: 16, marginTop: 4 },
  listContent: { paddingTop: 12, paddingBottom: 100, gap: 10 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    padding: 15,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 999 },
  categoryLabel: { fontSize: 11, letterSpacing: 0.8, fontWeight: '700', color: Colors.textMuted },
  cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20, marginTop: 10 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  cardMeta: { fontSize: 12.5, color: Colors.textMuted },
  cardDate: { fontSize: 12, color: Colors.textFaint },
});

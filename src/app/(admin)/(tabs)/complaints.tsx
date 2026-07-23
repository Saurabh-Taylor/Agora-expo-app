import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, getComplaintPriorityStyle, getComplaintStatusStyle } from '@/commonFunctions';
import { AdminTabbedHeader } from '@/components/admin-tabbed-header';
import { AsyncState } from '@/components/async-state';
import { StatusPill } from '@/components/status-pill';
import { Colors, ComplaintStatuses, Radius } from '@/constants/commonConstants';
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

  const { openCount, resolvedToday } = useMemo(() => {
    const today = new Date().toDateString();
    let open = 0;
    let resolved = 0;
    for (const complaint of complaints) {
      if (complaint.status !== 'RESOLVED') {
        open += 1;
      } else if (complaint.resolved_at && new Date(complaint.resolved_at).toDateString() === today) {
        resolved += 1;
      }
    }
    return { openCount: open, resolvedToday: resolved };
  }, [complaints]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? complaints : complaints.filter((c) => c.status === filter)),
    [complaints, filter],
  );

  return (
    <View style={styles.root}>
      <AdminTabbedHeader
        title="Operations"
        subtitle={openCount + ' open complaints · ' + resolvedToday + ' resolved today'}
        options={FILTERS}
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Complaint status filters"
      />

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

import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, getComplaintStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useFlatComplaints } from '@/features/complaints/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export default function ResidentComplaintsScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const complaintsQuery = useFlatComplaints(profileQuery.data?.flat_id);
  const complaints = complaintsQuery.data ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>My complaints</Text>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={complaints}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <AsyncState
            isLoading={complaintsQuery.isLoading}
            isError={complaintsQuery.isError}
            onRetry={() => complaintsQuery.refetch()}
            isEmpty={complaints.length === 0}
            emptyMessage="No complaints raised yet. Tap + to raise one."
          />
        }
        renderItem={({ item }) => {
          const statusStyle = getComplaintStatusStyle(item.status);
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/(resident)/complaint/${item.id}`)}>
              <View style={styles.cardTopRow}>
                <Text style={styles.categoryLabel}>{item.category.toUpperCase()}</Text>
                <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/(resident)/raise-complaint')}>
        <Text style={styles.fabLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 66, paddingHorizontal: 20 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  list: { flex: 1, paddingHorizontal: 16 },
  listContent: { paddingTop: 16, paddingBottom: 100, gap: 10 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    padding: 15,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryLabel: { fontSize: 11, letterSpacing: 0.8, fontWeight: '700', color: Colors.textMuted },
  cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20, marginTop: 10 },
  cardDate: { fontSize: 12, color: Colors.textFaint, marginTop: 6 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10261B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  fabLabel: { fontSize: 26, fontWeight: '700', color: Colors.green500, lineHeight: 28 },
});

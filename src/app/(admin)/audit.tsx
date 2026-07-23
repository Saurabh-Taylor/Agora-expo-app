import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { useRecentAuditEvents } from '@/features/audit/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export default function AuditTrailScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const auditQuery = useRecentAuditEvents(profileQuery.data?.society_id, 100);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Audit trail</Text>
      </View>
      <Text style={styles.subtitle}>Every admin action, logged for compliance</Text>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={auditQuery.data}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <AsyncState
            isLoading={auditQuery.isLoading}
            isError={auditQuery.isError}
            onRetry={() => auditQuery.refetch()}
            isEmpty={auditQuery.data?.length === 0}
            emptyMessage="No admin actions logged yet."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.dot} />
            <View style={styles.flex}>
              <Text style={styles.action}>{item.action}</Text>
              <Text style={styles.meta}>
                {item.detail ? `${item.detail} · ` : ''}
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas, paddingHorizontal: 20 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  list: { marginTop: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 18 },
  listContent: { paddingHorizontal: 16 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0ECE0' },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: Colors.success600, marginTop: 6 },
  action: { fontSize: 13.5, color: '#2C3830', lineHeight: 19 },
  meta: { fontSize: 11.5, color: Colors.textFaint, marginTop: 2 },
});

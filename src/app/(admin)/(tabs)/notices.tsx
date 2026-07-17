import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, getNoticeCategoryStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useNotices } from '@/features/notices/api';

export default function NoticesScreen() {
  const noticesQuery = useNotices();
  const notices = noticesQuery.data ?? [];
  const publishedCount = notices.filter((n) => n.state === 'PUBLISHED').length;
  const scheduledCount = notices.filter((n) => n.state === 'SCHEDULED').length;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notices</Text>
        <Text style={styles.headerSubtitle}>
          {publishedCount} published · {scheduledCount} scheduled
        </Text>
      </View>

      <View style={styles.body}>
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <AsyncState
              isLoading={noticesQuery.isLoading}
              isError={noticesQuery.isError}
              onRetry={() => noticesQuery.refetch()}
              isEmpty={notices.length === 0}
              emptyMessage="No notices published yet. Tap + to compose one."
            />
          }
          renderItem={({ item }) => {
            const catStyle = getNoticeCategoryStyle(item.category);
            const stateStyle =
              item.state === 'PUBLISHED'
                ? { label: 'Published', color: Colors.success600, bg: '#E3F2E9' }
                : { label: 'Scheduled', color: '#9A6B14', bg: '#F6ECD8' };
            return (
              <View style={styles.card}>
                <View style={styles.cardTopRow}>
                  <StatusPill label={catStyle.label} color={catStyle.color} backgroundColor={catStyle.bg} />
                  <StatusPill label={stateStyle.label} color={stateStyle.color} backgroundColor={stateStyle.bg} />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{formatDate(item.published_at ?? item.created_at)}</Text>
              </View>
            );
          }}
        />

        <Pressable style={styles.fab} onPress={() => router.push('/(admin)/compose-notice')}>
          <Text style={styles.fabLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  header: { backgroundColor: Colors.green400, paddingTop: 58, paddingHorizontal: 20, paddingBottom: 30 },
  headerTitle: { fontFamily: FontFamily.headingExtraBold, fontSize: 26, color: Colors.textOnDark },
  headerSubtitle: { fontSize: 14, color: 'rgba(247,244,236,0.68)', marginTop: 5 },
  body: { flex: 1, paddingHorizontal: 16, marginTop: -10 },
  listContent: { paddingTop: 16, paddingBottom: 100, gap: 10 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.cardLarge - 4,
    padding: 15,
  },
  cardTopRow: { flexDirection: 'row', gap: 8 },
  cardTitle: { fontSize: 15.5, fontWeight: '700', marginTop: 10 },
  cardMeta: { fontSize: 12, color: Colors.textFaint, marginTop: 5 },
  fab: {
    position: 'absolute',
    right: 8,
    bottom: 16,
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

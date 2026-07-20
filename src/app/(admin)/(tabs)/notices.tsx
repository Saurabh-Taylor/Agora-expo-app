import { router, type Href } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, getNoticeCategoryStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useNotices } from '@/features/notices/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export default function NoticesScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const noticesQuery = useNotices(profileQuery.data?.society_id);
  const notices = noticesQuery.data ?? [];
  const publishedCount = notices.filter((notice) => notice.state === 'PUBLISHED' && !notice.archived_at).length;
  const draftCount = notices.filter((notice) => notice.state !== 'PUBLISHED' && !notice.archived_at).length;
  const archivedCount = notices.filter((notice) => !!notice.archived_at).length;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notices</Text>
        <Text style={styles.headerSubtitle}>
          {publishedCount} published - {draftCount} drafts - {archivedCount} archived
        </Text>
      </View>

      <View style={styles.body}>
        <FlatList
          data={notices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <AsyncState
              isLoading={profileQuery.isLoading || noticesQuery.isLoading}
              isError={profileQuery.isError || noticesQuery.isError}
              onRetry={() => {
                profileQuery.refetch();
                noticesQuery.refetch();
              }}
              isEmpty={notices.length === 0}
              emptyMessage="No notices yet. Tap + to create your first notice."
            />
          }
          renderItem={({ item }) => {
            const categoryStyle = getNoticeCategoryStyle(item.category);
            const stateStyle = item.archived_at
              ? { label: 'Archived', color: Colors.danger700, bg: '#F9E4E1' }
              : item.state === 'PUBLISHED'
                ? { label: 'Published', color: Colors.success600, bg: '#E3F2E9' }
                : { label: 'Draft', color: '#9A6B14', bg: '#F6ECD8' };
            return (
              <Pressable
                style={styles.card}
                onPress={() =>
                  router.push({ pathname: '/(admin)/notice/[id]', params: { id: item.id } } as unknown as Href)
                }>
                <View style={styles.cardTopRow}>
                  <StatusPill
                    label={categoryStyle.label}
                    color={categoryStyle.color}
                    backgroundColor={categoryStyle.bg}
                  />
                  <StatusPill label={stateStyle.label} color={stateStyle.color} backgroundColor={stateStyle.bg} />
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardPreview} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.cardMeta}>{formatDate(item.published_at ?? item.created_at)}</Text>
              </Pressable>
            );
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compose notice"
          style={styles.fab}
          onPress={() => router.push('/(admin)/compose-notice')}>
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
  headerSubtitle: { fontSize: 13, color: 'rgba(247,244,236,0.68)', marginTop: 5 },
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
  cardTitle: { fontSize: 15.5, fontWeight: '700', marginTop: 10, color: Colors.textPrimary },
  cardPreview: { fontSize: 13, lineHeight: 19, color: Colors.textMuted, marginTop: 5 },
  cardMeta: { fontSize: 12, color: Colors.textFaint, marginTop: 7 },
  fab: {
    position: 'absolute',
    right: 8,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
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

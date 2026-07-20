import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDate, getNoticeCategoryStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useNoticeDetail } from '@/features/notices/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const noticeQuery = useNoticeDetail(id, profileQuery.data?.society_id);
  const notice = noticeQuery.data;

  if (!notice) {
    return (
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <BackArrowButton onPress={() => router.back()} />
        </View>
        <AsyncState
          isLoading={noticeQuery.isLoading}
          isError={noticeQuery.isError}
          onRetry={() => noticeQuery.refetch()}
          isEmpty={!noticeQuery.isLoading && !noticeQuery.isError}
          emptyMessage="This notice isn't available."
        />
      </View>
    );
  }

  const catStyle = getNoticeCategoryStyle(notice.category);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <View style={[styles.catPill, { backgroundColor: catStyle.bg }]}>
          <Text style={[styles.catPillLabel, { color: catStyle.color }]}>{catStyle.label}</Text>
        </View>
      </View>

      <Text style={styles.title}>{notice.title}</Text>
      <Text style={styles.meta}>{formatDate(notice.published_at ?? notice.created_at)}</Text>

      <View style={styles.divider} />

      <Text style={styles.body}>{notice.body}</Text>

      <View style={styles.attributionCard}>
        <View style={styles.attributionAvatar}>
          <Text style={styles.attributionInitial}>S</Text>
        </View>
        <View>
          <Text style={styles.attributionName}>Society Office</Text>
          <Text style={styles.attributionSub}>Society Admin</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catPill: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999 },
  catPillLabel: { fontSize: 10, letterSpacing: 0.5, fontWeight: '700' },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 24, lineHeight: 30, marginTop: 18 },
  meta: { fontSize: 13, color: Colors.textMuted, marginTop: 10 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 18 },
  body: { fontSize: 15, lineHeight: 24, color: '#2C3830' },
  attributionCard: {
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 4,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attributionAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#E9F1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attributionInitial: { fontFamily: FontFamily.headingBold, fontSize: 15, color: Colors.success700 },
  attributionName: { fontSize: 13.5, fontWeight: '700' },
  attributionSub: { fontSize: 12, color: Colors.textMuted },
});

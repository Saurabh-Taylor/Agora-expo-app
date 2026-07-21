import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { formatDate, getNoticeCategoryStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useNoticeDetail } from '@/features/notices/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

function NoticeIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d="M6.5 15.5V9.25l10-3.75v13l-10-3Zm0 0 1.2 3.5h3.1l-1.1-2.4M17 9.1h1.25A1.75 1.75 0 0 1 20 10.85v2.3a1.75 1.75 0 0 1-1.75 1.75H17"
        stroke={Colors.textOnDark}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function VerifiedPublisherIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17" fill="none" accessibilityElementsHidden>
      <Circle cx="8.5" cy="8.5" r="8.5" fill={Colors.categorySecurity.bg} />
      <Path
        d="m5.1 8.7 2.05 2.05 4.75-4.8"
        stroke={Colors.success700}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function NoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const noticeQuery = useNoticeDetail(id, profileQuery.data?.society_id);
  const notice = noticeQuery.data;

  if (!notice) {
    return (
      <View style={[styles.root, styles.fallbackContent, { paddingTop: insets.top + 22 }]}>
        <View style={styles.headerRow}>
          <BackArrowButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Notice</Text>
        </View>
        <AsyncState
          isLoading={noticeQuery.isLoading}
          isError={noticeQuery.isError}
          errorTitle="Notice unavailable"
          errorMessage="We couldn’t load this notice. Try again."
          onRetry={() => noticeQuery.refetch()}
          isEmpty={!noticeQuery.isLoading && !noticeQuery.isError}
          emptyMessage="This notice isn't available."
        />
      </View>
    );
  }

  const categoryStyle = getNoticeCategoryStyle(notice.category);
  const publishedDate = formatDate(notice.published_at ?? notice.created_at);
  const bodyParagraphs = notice.body.trim().split(/\n\s*\n/).filter(Boolean);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 36 },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Notice</Text>
      </View>

      <View style={styles.noticePaper}>
        <View style={styles.paperTopAccent} />

        <View style={styles.paperContent}>
          <View style={styles.noticeHeader}>
            <View style={styles.noticeIcon}>
              <NoticeIcon />
            </View>
            <View style={styles.noticeHeaderText}>
              <Text style={styles.noticeOverline}>AGORA COMMUNITY</Text>
              <Text style={styles.noticeHeading}>Official Notice</Text>
            </View>
          </View>

          <View style={styles.metaPanel}>
            <View style={[styles.categoryPill, { backgroundColor: categoryStyle.bg }]}>
              <Text style={[styles.categoryLabel, { color: categoryStyle.color }]}>
                {categoryStyle.label}
              </Text>
            </View>
            <View style={styles.dateBlock}>
              <Text style={styles.dateLabel}>PUBLISHED</Text>
              <Text style={styles.date}>{publishedDate}</Text>
            </View>
          </View>

          <View style={styles.subjectSection}>
            <Text style={styles.sectionLabel}>SUBJECT</Text>
            <Text style={styles.title}>{notice.title}</Text>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.messageSection}>
            <Text style={styles.sectionLabel}>MESSAGE</Text>
            <View style={styles.bodyGroup}>
              {bodyParagraphs.map((paragraph, index) => (
                <Text key={index} style={[styles.body, index > 0 && styles.bodySpacing]}>
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.publisherFooter}>
            <View style={styles.publisherAvatar}>
              <Text style={styles.publisherInitial}>S</Text>
            </View>
            <View style={styles.publisherText}>
              <View style={styles.publisherNameRow}>
                <Text style={styles.publisherName}>Society Office</Text>
                <VerifiedPublisherIcon />
              </View>
              <Text style={styles.publisherRole}>Issued by Society Admin</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  fallbackContent: { paddingHorizontal: 18 },
  content: { paddingHorizontal: 18 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  headerTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    color: Colors.textPrimary,
    marginLeft: 14,
  },
  noticePaper: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.cardLarge,
    marginTop: 22,
    overflow: 'hidden',
    shadowColor: Colors.green900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  paperTopAccent: {
    height: 8,
    backgroundColor: Colors.green500,
  },
  paperContent: {
    padding: 20,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeHeaderText: {
    flex: 1,
    marginLeft: 13,
  },
  noticeOverline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: Colors.success700,
  },
  noticeHeading: {
    fontFamily: FontFamily.headingBold,
    fontSize: 20,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  metaPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.adminCanvas,
    borderRadius: Radius.input,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 20,
    gap: 12,
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: Radius.pill,
  },
  categoryLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
  },
  dateBlock: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
  dateLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
    color: Colors.textFaint,
  },
  date: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  subjectSection: {
    marginTop: 26,
    paddingLeft: 14,
    borderLeftWidth: 4,
    borderLeftColor: Colors.gold,
  },
  sectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.textMuted,
  },
  title: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 28,
    lineHeight: 34,
    color: Colors.textPrimary,
    marginTop: 7,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 24,
  },
  messageSection: {
    minHeight: 96,
  },
  bodyGroup: {
    marginTop: 11,
  },
  body: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 16,
    lineHeight: 26,
    color: Colors.textPrimary,
  },
  bodySpacing: {
    marginTop: 14,
  },
  publisherFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.adminCanvas,
    borderRadius: Radius.input,
    padding: 13,
    marginTop: 28,
  },
  publisherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: Colors.categorySecurity.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publisherInitial: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    color: Colors.success700,
  },
  publisherText: {
    flex: 1,
    marginLeft: 11,
  },
  publisherNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  publisherName: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  publisherRole: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

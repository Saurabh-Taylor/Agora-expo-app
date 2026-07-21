import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDateTime, getComplaintStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { ComplaintAttachment } from '@/components/complaint-attachment';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useComplaintDetail, useComplaintRealtimeSync } from '@/features/complaints/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export default function ResidentComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const detailQuery = useComplaintDetail(id, profileQuery.data?.society_id);
  useComplaintRealtimeSync(profileQuery.data?.society_id);
  const complaint = detailQuery.data?.complaint;

  if (!complaint) {
    return (
      <View style={styles.root}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={profileQuery.isLoading || detailQuery.isLoading}
          isError={profileQuery.isError || detailQuery.isError}
          onRetry={() => { profileQuery.refetch(); detailQuery.refetch(); }}
          isEmpty={!detailQuery.isLoading && !detailQuery.isError}
          emptyMessage="This complaint isn't available."
        />
      </View>
    );
  }

  const statusStyle = getComplaintStatusStyle(complaint.status);
  const events = detailQuery.data?.events ?? [];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <BackArrowButton onPress={() => router.back()} />

      <View style={styles.summaryCard}>
        <View style={styles.metaRow}>
          <View style={styles.categoryPill}>
            <View style={styles.categoryDot} />
            <Text style={styles.categoryLabel}>{complaint.category}</Text>
          </View>
          <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
        </View>

        <Text style={styles.title}>{complaint.title}</Text>
        <Text style={styles.subMeta}>Raised on {formatDateTime(complaint.created_at)}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionOverline}>ISSUE DETAILS</Text>
        <Text style={styles.descriptionText}>{complaint.description}</Text>
        <ComplaintAttachment attachmentPath={complaint.attachment_path} societyId={complaint.society_id} />
      </View>

      <View style={styles.activityHeader}>
        <View>
          <Text style={styles.sectionOverline}>PROGRESS</Text>
          <Text style={styles.sectionTitle}>Complaint timeline</Text>
        </View>
        <Text style={styles.updateCount}>
          {events.length} {events.length === 1 ? 'update' : 'updates'}
        </Text>
      </View>

      <View style={styles.timelineCard}>
        {events.map((event, index) => {
          const eventStyle = getComplaintStatusStyle(event.status);
          const isLastEvent = index === events.length - 1;
          return (
            <View key={event.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDotRing, { borderColor: eventStyle.bg }]}>
                  <View style={[styles.timelineDot, { backgroundColor: eventStyle.color }]} />
                </View>
                {!isLastEvent && <View style={styles.timelineLine} />}
              </View>
              <View style={[styles.timelineContent, !isLastEvent && styles.timelineContentSpaced]}>
                <View style={styles.timelineStatusRow}>
                  <Text style={styles.timelineStatus}>
                    {event.note === 'Complaint raised' ? 'Complaint raised' : eventStyle.label}
                  </Text>
                  <Text style={styles.timelineMeta}>{formatDateTime(event.created_at)}</Text>
                </View>
                {event.note && event.note !== 'Complaint raised' && (
                  <Text style={styles.timelineNote}>{event.note}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 48 },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.cardLarge,
    padding: 20,
    marginTop: 22,
    shadowColor: Colors.green900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.categoryGeneral.bg,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryDot: { width: 7, height: 7, borderRadius: Radius.pill, backgroundColor: Colors.gold },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: Colors.categoryGeneral.text },
  title: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 25,
    lineHeight: 31,
    color: Colors.textPrimary,
    marginTop: 20,
  },
  subMeta: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 20 },
  sectionOverline: { fontSize: 10.5, letterSpacing: 1.7, fontWeight: '700', color: Colors.success700 },
  descriptionText: { fontSize: 15, lineHeight: 23, color: '#2C3830', marginTop: 9 },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 19,
    color: Colors.textPrimary,
    marginTop: 4,
  },
  updateCount: { fontSize: 12, color: Colors.textMuted },
  timelineCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    paddingHorizontal: 18,
    paddingVertical: 19,
  },
  timelineRow: { flexDirection: 'row', gap: 13 },
  timelineRail: { width: 18, alignItems: 'center' },
  timelineDotRing: {
    width: 18,
    height: 18,
    borderRadius: Radius.pill,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDot: { width: 6, height: 6, borderRadius: Radius.pill },
  timelineLine: { width: 2, flex: 1, minHeight: 34, backgroundColor: Colors.border, marginVertical: 3 },
  timelineContent: { flex: 1, minHeight: 24 },
  timelineContentSpaced: { paddingBottom: 20 },
  timelineStatusRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  timelineStatus: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700', color: Colors.textPrimary },
  timelineNote: { fontSize: 13, color: Colors.textMuted, marginTop: 5, lineHeight: 19 },
  timelineMeta: { fontSize: 11.5, color: Colors.textFaint, marginTop: 1 },
});

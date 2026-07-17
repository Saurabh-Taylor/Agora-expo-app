import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDate, getComplaintStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useComplaintDetail } from '@/features/complaints/api';

export default function ResidentComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detailQuery = useComplaintDetail(id);
  const complaint = detailQuery.data?.complaint;

  if (!complaint) {
    return (
      <View style={styles.root}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={detailQuery.isLoading}
          isError={detailQuery.isError}
          onRetry={() => detailQuery.refetch()}
          isEmpty={!detailQuery.isLoading && !detailQuery.isError}
          emptyMessage="This complaint isn't available."
        />
      </View>
    );
  }

  const statusStyle = getComplaintStatusStyle(complaint.status);
  // Synthesize the "raised" entry from the complaint row itself — residents
  // can't insert complaint_events (admin-only per AGENTS.md's write scope),
  // so the timeline always has at least this one entry.
  const timeline = [
    { id: 'raised', status: 'OPEN' as const, note: null, created_at: complaint.created_at, isRaised: true },
    ...(detailQuery.data?.events ?? []).map((event) => ({ ...event, isRaised: false })),
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackArrowButton onPress={() => router.back()} />

      <View style={styles.metaRow}>
        <Text style={styles.categoryLabel}>{complaint.category.toUpperCase()}</Text>
        <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
      </View>
      <Text style={styles.title}>{complaint.title}</Text>
      <Text style={styles.subMeta}>Raised {formatDate(complaint.created_at)}</Text>

      <View style={styles.descriptionCard}>
        <Text style={styles.descriptionText}>{complaint.description}</Text>
      </View>

      <Text style={styles.label}>TIMELINE</Text>
      <View style={styles.timeline}>
        {timeline.map((event) => {
          const eventStyle = getComplaintStatusStyle(event.status);
          return (
            <View key={event.id} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: eventStyle.color }]} />
              <View style={styles.flex}>
                <Text style={styles.timelineStatus}>{event.isRaised ? 'Raised' : eventStyle.label}</Text>
                {'note' in event && event.note && <Text style={styles.timelineNote}>{event.note}</Text>}
                <Text style={styles.timelineMeta}>{formatDate(event.created_at)}</Text>
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
  flex: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  categoryLabel: { fontSize: 11.5, letterSpacing: 1, fontWeight: '700', color: Colors.textMuted },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, lineHeight: 28, marginTop: 10 },
  subMeta: { fontSize: 13.5, color: Colors.textMuted, marginTop: 8 },
  descriptionCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 4,
    padding: 14,
    marginTop: 16,
  },
  descriptionText: { fontSize: 14.5, lineHeight: 22, color: '#2C3830' },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  timeline: { marginTop: 12, gap: 16 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineDot: { width: 8, height: 8, borderRadius: 999, marginTop: 6 },
  timelineStatus: { fontSize: 13.5, fontWeight: '700' },
  timelineNote: { fontSize: 13, color: '#2C3830', marginTop: 2, lineHeight: 19 },
  timelineMeta: { fontSize: 11.5, color: Colors.textFaint, marginTop: 3 },
});

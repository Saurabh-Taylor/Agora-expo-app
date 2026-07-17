import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDate, getComplaintPriorityStyle, getComplaintStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import {
  useComplaintDetail,
  useUpdateComplaint,
  type Complaint,
  type ComplaintEvent,
  type ComplaintPriority,
  type ComplaintStatus,
} from '@/features/complaints/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const PRIORITIES: { value: ComplaintPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

const STATUSES: { value: ComplaintStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export default function ComplaintTriageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
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

  return (
    <ComplaintTriageForm complaint={complaint} events={detailQuery.data?.events ?? []} societyId={profileQuery.data?.society_id} />
  );
}

// A separate component so priority/status can lazy-initialize from the
// loaded complaint on first mount — this component only mounts once
// `complaint` exists, so no effect is needed to sync state after the fact.
function ComplaintTriageForm({
  complaint,
  events,
  societyId,
}: {
  complaint: Complaint;
  events: ComplaintEvent[];
  societyId: string | undefined;
}) {
  const updateComplaint = useUpdateComplaint();
  const [priority, setPriority] = useState<ComplaintPriority>(complaint.priority);
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status);
  const [note, setNote] = useState('');

  async function handleSave() {
    if (!societyId) return;
    try {
      await updateComplaint.mutateAsync({ id: complaint.id, societyId, priority, status, note });
      showToast('Complaint updated');
      router.back();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save changes');
    }
  }

  const priorityDotColor = getComplaintPriorityStyle(complaint.priority).color;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackArrowButton onPress={() => router.back()} />

      <View style={styles.metaRow}>
        <View style={[styles.priorityDot, { backgroundColor: priorityDotColor }]} />
        <Text style={styles.metaLabel}>{complaint.category.toUpperCase()}</Text>
      </View>
      <Text style={styles.title}>{complaint.title}</Text>
      <Text style={styles.subMeta}>
        Raised by {complaint.raised_by_profile?.full_name ?? 'Resident'}
        {complaint.flat ? ` · ${complaint.flat.tower ? `${complaint.flat.tower.code}-` : ''}${complaint.flat.number}` : ''} ·{' '}
        {formatDate(complaint.created_at)}
      </Text>

      <View style={styles.descriptionCard}>
        <Text style={styles.descriptionText}>{complaint.description}</Text>
      </View>

      {events.length > 0 && (
        <>
          <Text style={styles.label}>TIMELINE</Text>
          <View style={styles.timeline}>
            {events.map((event) => {
              const eventStyle = getComplaintStatusStyle(event.status);
              return (
                <View key={event.id} style={styles.timelineRow}>
                  <View style={[styles.timelineDot, { backgroundColor: eventStyle.color }]} />
                  <View style={styles.flex}>
                    <Text style={styles.timelineStatus}>{eventStyle.label}</Text>
                    {event.note && <Text style={styles.timelineNote}>{event.note}</Text>}
                    <Text style={styles.timelineMeta}>
                      {event.created_by_profile?.full_name ?? 'Admin'} · {formatDate(event.created_at)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.label}>PRIORITY</Text>
      <View style={styles.chipsRow}>
        {PRIORITIES.map((item) => {
          const active = priority === item.value;
          return (
            <Pressable
              key={item.value}
              style={[styles.priorityChip, active ? styles.chipActive : styles.chipInactive]}
              onPress={() => setPriority(item.value)}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>STATUS</Text>
      <View style={styles.chipsRow}>
        {STATUSES.map((item) => {
          const active = status === item.value;
          return (
            <Pressable
              key={item.value}
              style={[styles.priorityChip, active ? styles.chipActive : styles.chipInactive]}
              onPress={() => setStatus(item.value)}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>NOTE (OPTIONAL)</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add an update for the resident's timeline"
        placeholderTextColor={Colors.textFaint}
        style={[styles.input, styles.textarea]}
        multiline
        textAlignVertical="top"
      />

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={updateComplaint.isPending}>
        {updateComplaint.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
        <Text style={styles.saveButtonLabel}>Save changes</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 48 },
  flex: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  priorityDot: { width: 8, height: 8, borderRadius: 999 },
  metaLabel: { fontSize: 11.5, letterSpacing: 1, fontWeight: '700', color: Colors.textMuted },
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
  timeline: { marginTop: 10, gap: 14 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineDot: { width: 8, height: 8, borderRadius: 999, marginTop: 6 },
  timelineStatus: { fontSize: 13.5, fontWeight: '700' },
  timelineNote: { fontSize: 13, color: '#2C3830', marginTop: 2, lineHeight: 19 },
  timelineMeta: { fontSize: 11.5, color: Colors.textFaint, marginTop: 3 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  priorityChip: { flex: 1, paddingVertical: 11, borderRadius: Radius.input, borderWidth: 1.5, alignItems: 'center' },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 13.5, fontWeight: '700', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 13.5, fontWeight: '700', color: '#3E4A40' },
  input: {
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  textarea: { marginTop: 8, minHeight: 70 },
  saveButton: {
    marginTop: 26,
    height: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    backgroundColor: Colors.green500,
  },
  saveButtonLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.textOnDark },
});

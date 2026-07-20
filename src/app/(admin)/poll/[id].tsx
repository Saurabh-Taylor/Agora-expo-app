import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { computePollResults, formatDate, getErrorMessage, getPollDisplayState } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useArchivePoll, useClosePoll, usePollDetail, usePollVotesRealtimeSync } from '@/features/polls/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function AdminPollResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const pollQuery = usePollDetail(id, societyId);
  const closePoll = useClosePoll();
  const archivePoll = useArchivePoll();
  usePollVotesRealtimeSync(societyId);

  const poll = pollQuery.data;

  async function handleClose() {
    if (!poll || !societyId) return;
    try {
      await closePoll.mutateAsync({ id: poll.id, societyId });
      showToast('Poll closed');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not close the poll'));
    }
  }

  function confirmArchive() {
    if (!poll || !societyId) return;
    Alert.alert('Archive poll?', 'Residents will no longer see this poll. Results remain available to admins.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await archivePoll.mutateAsync({ id: poll.id, societyId });
            showToast('Poll archived');
            router.back();
          } catch (error) {
            showToast(getErrorMessage(error, 'Could not archive the poll'));
          }
        },
      },
    ]);
  }

  if (!poll) {
    return (
      <View style={styles.emptyRoot}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={pollQuery.isLoading || profileQuery.isLoading}
          isError={pollQuery.isError || profileQuery.isError}
          onRetry={() => {
            profileQuery.refetch();
            pollQuery.refetch();
          }}
          isEmpty={!pollQuery.isLoading && !profileQuery.isLoading && !pollQuery.isError && !profileQuery.isError}
          emptyMessage="This poll isn't available."
        />
      </View>
    );
  }

  const { options, totalVotes } = computePollResults(poll);
  const displayState = getPollDisplayState(poll);
  const stateColor = displayState === 'ACTIVE' ? Colors.success600 : Colors.textFaint;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackArrowButton onPress={() => router.back()} />

      <View style={styles.stateRow}>
        <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
        <Text style={[styles.stateLabel, { color: stateColor }]}>{displayState}</Text>
      </View>
      <Text style={styles.question}>{poll.question}</Text>
      <Text style={styles.meta}>
        Created {formatDate(poll.created_at)}
        {poll.closes_at ? ` · closes ${formatDate(poll.closes_at)}` : ' · no automatic close'}
      </Text>

      <View style={styles.optionsList}>
        {options.map((option) => (
          <View key={option.id} style={[styles.optionCard, { borderColor: option.isLeading ? Colors.success700 : Colors.border }]}>
            <View style={[styles.optionFill, { width: `${option.pct}%`, backgroundColor: option.isLeading ? '#E3F2E9' : '#F0ECE0' }]} />
            <View style={styles.optionRow}>
              <View style={styles.optionLabelRow}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                {option.isLeading && (
                  <View style={styles.leadingBadge}>
                    <Text style={styles.leadingBadgeLabel}>LEADING</Text>
                  </View>
                )}
              </View>
              <View style={styles.resultColumn}>
                <Text style={styles.optionPct}>{option.pct}%</Text>
                <Text style={styles.optionVotes}>{option.count} votes</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.votesFooter}>
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} · results update live
      </Text>

      {displayState === 'ACTIVE' && (
        <Pressable style={styles.closeButton} onPress={handleClose} disabled={closePoll.isPending}>
          {closePoll.isPending && <ActivityIndicator size="small" color={Colors.textPrimary} />}
          <Text style={styles.closeButtonLabel}>Close poll now</Text>
        </Pressable>
      )}

      {displayState === 'CLOSED' && !poll.archived_at && (
        <Pressable style={styles.archiveButton} onPress={confirmArchive} disabled={archivePoll.isPending}>
          {archivePoll.isPending && <ActivityIndicator size="small" color={Colors.danger700} />}
          <Text style={styles.archiveButtonLabel}>Archive poll</Text>
        </Pressable>
      )}

      {displayState === 'ARCHIVED' && <Text style={styles.archivedNote}>This poll is archived and hidden from residents.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  emptyRoot: { flex: 1, backgroundColor: Colors.adminCanvas, paddingTop: 66, paddingHorizontal: 20 },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 48 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  stateDot: { width: 7, height: 7, borderRadius: 999 },
  stateLabel: { fontSize: 10.5, letterSpacing: 1, fontWeight: '700' },
  question: { fontFamily: FontFamily.headingExtraBold, fontSize: 21, lineHeight: 27, marginTop: 10 },
  meta: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  optionsList: { gap: 12, marginTop: 20 },
  optionCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.card - 4,
    borderWidth: 1.5,
    minHeight: 64,
    backgroundColor: Colors.surface,
  },
  optionFill: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 10,
  },
  optionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  optionLabel: { fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
  leadingBadge: { backgroundColor: '#E3F2E9', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 },
  leadingBadgeLabel: { fontSize: 10, fontWeight: '700', color: Colors.success700 },
  resultColumn: { alignItems: 'flex-end' },
  optionPct: { fontFamily: FontFamily.headingExtraBold, fontSize: 16, color: Colors.success700 },
  optionVotes: { fontSize: 10.5, color: Colors.textMuted, marginTop: 2 },
  votesFooter: { fontSize: 13, color: Colors.textMuted, marginTop: 18 },
  closeButton: {
    marginTop: 22,
    minHeight: 50,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    gap: 8,
  },
  closeButtonLabel: { fontSize: 14.5, fontWeight: '700' },
  archiveButton: {
    marginTop: 22,
    minHeight: 50,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: '#E8C6BF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F6',
    flexDirection: 'row',
    gap: 8,
  },
  archiveButtonLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.danger700 },
  archivedNote: { marginTop: 22, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});

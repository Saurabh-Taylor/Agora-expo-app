import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { computePollResults, formatDate } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useClosePoll, usePollDetail, usePollVotesRealtimeSync } from '@/features/polls/api';
import { showToast } from '@/stores/toast-store';

export default function AdminPollResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pollQuery = usePollDetail(id);
  const closePoll = useClosePoll();
  usePollVotesRealtimeSync(id);

  const poll = pollQuery.data;

  async function handleClose() {
    if (!poll) return;
    try {
      await closePoll.mutateAsync(poll.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not close the poll');
    }
  }

  if (!poll) {
    return (
      <View style={styles.root}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={pollQuery.isLoading}
          isError={pollQuery.isError}
          onRetry={() => pollQuery.refetch()}
          isEmpty={!pollQuery.isLoading && !pollQuery.isError}
          emptyMessage="This poll isn't available."
        />
      </View>
    );
  }

  const { options, totalVotes } = computePollResults(poll);
  const stateColor = poll.state === 'ACTIVE' ? Colors.success600 : Colors.textFaint;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackArrowButton onPress={() => router.back()} />

      <View style={styles.stateRow}>
        <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
        <Text style={[styles.stateLabel, { color: stateColor }]}>{poll.state}</Text>
      </View>
      <Text style={styles.question}>{poll.question}</Text>
      <Text style={styles.meta}>Created {formatDate(poll.created_at)}</Text>

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
              <Text style={styles.optionPct}>{option.pct}%</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.votesFooter}>
        {totalVotes} vote{totalVotes === 1 ? '' : 's'} · updates live
      </Text>

      {poll.state === 'ACTIVE' && (
        <Pressable style={styles.closeButton} onPress={handleClose} disabled={closePoll.isPending}>
          <Text style={styles.closeButtonLabel}>Close poll now</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 48 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  stateDot: { width: 7, height: 7, borderRadius: 999 },
  stateLabel: { fontSize: 10.5, letterSpacing: 1, fontWeight: '700' },
  question: { fontFamily: FontFamily.headingExtraBold, fontSize: 21, lineHeight: 27, marginTop: 10 },
  meta: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  optionsList: { gap: 12, marginTop: 20 },
  optionCard: { position: 'relative', overflow: 'hidden', borderRadius: Radius.card - 4, borderWidth: 1.5, minHeight: 56, backgroundColor: Colors.surface },
  optionFill: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 10,
  },
  optionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  optionLabel: { fontSize: 14.5, fontWeight: '600' },
  leadingBadge: { backgroundColor: '#E3F2E9', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 },
  leadingBadgeLabel: { fontSize: 10, fontWeight: '700', color: Colors.success700 },
  optionPct: { fontFamily: FontFamily.headingExtraBold, fontSize: 16, color: Colors.success700 },
  votesFooter: { fontSize: 13, color: Colors.textMuted, marginTop: 18 },
  closeButton: {
    marginTop: 22,
    height: 50,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  closeButtonLabel: { fontSize: 14.5, fontWeight: '700' },
});

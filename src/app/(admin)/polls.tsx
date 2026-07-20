import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { computePollResults, formatDate, getPollDisplayState } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { usePolls } from '@/features/polls/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export default function PollsScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const pollsQuery = usePolls(profileQuery.data?.society_id);
  const polls = pollsQuery.data ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Polls & Surveys</Text>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={polls}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <AsyncState
            isLoading={pollsQuery.isLoading}
            isError={pollsQuery.isError}
            onRetry={() => pollsQuery.refetch()}
            isEmpty={polls.length === 0}
            emptyMessage="No polls yet. Create one to hear from residents."
          />
        }
        renderItem={({ item }) => {
          const displayState = getPollDisplayState(item);
          const stateColor = displayState === 'ACTIVE' ? Colors.success600 : Colors.textFaint;
          const { totalVotes } = computePollResults(item);
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/(admin)/poll/${item.id}`)}>
              <View style={styles.cardTopRow}>
                <View style={styles.stateRow}>
                  <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
                  <Text style={[styles.stateLabel, { color: stateColor }]}>{displayState}</Text>
                </View>
                <Text style={styles.votesLabel}>{totalVotes} votes</Text>
              </View>
              <Text style={styles.question}>{item.question}</Text>
              <Text style={styles.meta}>
                {item.poll_options.length} options · {formatDate(item.created_at)}
              </Text>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.createButton} onPress={() => router.push('/(admin)/create-poll')}>
        <Text style={styles.createButtonLabel}>+ Create a poll</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas, paddingTop: 66, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  list: { marginTop: 18 },
  listContent: { gap: 11, paddingBottom: 20 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    padding: 16,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateDot: { width: 7, height: 7, borderRadius: 999 },
  stateLabel: { fontSize: 10.5, letterSpacing: 1, fontWeight: '700' },
  votesLabel: { fontSize: 12, color: Colors.textFaint },
  question: { fontFamily: FontFamily.headingBold, fontSize: 16, lineHeight: 21, marginTop: 10 },
  meta: { fontSize: 12.5, color: Colors.textMuted, marginTop: 8 },
  createButton: {
    marginTop: 16,
    marginBottom: 16,
    height: 52,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: '#C9BE9F',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  createButtonLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.success700 },
});

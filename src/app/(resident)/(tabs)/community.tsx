import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { computePollResults, formatDate, getNoticeCategoryStyle, isPollOpen } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useNotices } from '@/features/notices/api';
import { useCastVote, usePolls, usePollVotesRealtimeSync, type PollWithVotes } from '@/features/polls/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type CommunityTab = 'Notices' | 'Polls';

function StarIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path d="M12 2l2.4 6.2H21l-5.2 4 2 6.6-5.8-4.1-5.8 4.1 2-6.6-5.2-4h6.6L12 2z" fill={Colors.gold} />
    </Svg>
  );
}

function CheckIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path d="M4.5 12.5l5 5L19.5 7" stroke={Colors.success700} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function PollCard({
  poll,
  societyId,
}: {
  poll: PollWithVotes;
  societyId: string | undefined;
}) {
  const castVote = useCastVote();
  const { options, totalVotes } = computePollResults(poll);
  const myVote = poll.poll_votes[0];
  const isActive = isPollOpen(poll);

  async function handlePick(optionId: string) {
    if (!isActive || !societyId) return;
    try {
      await castVote.mutateAsync({ pollId: poll.id, optionId, societyId });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not record your vote');
    }
  }

  return (
    <View style={styles.pollCard}>
      <View style={styles.pollTopRow}>
        {isActive ? (
          <View style={styles.activeBadgeRow}>
            <View style={styles.liveDot} />
            <Text style={styles.activeBadgeLabel}>ACTIVE POLL</Text>
          </View>
        ) : (
          <Text style={styles.closedBadgeLabel}>CLOSED · {formatDate(poll.created_at)}</Text>
        )}
        <Text style={styles.pollVotesLabel}>{totalVotes} votes</Text>
      </View>
      <Text style={styles.pollQuestion}>{poll.question}</Text>
      <View style={styles.pollOptions}>
        {options.map((option) => {
          const picked = myVote?.option_id === option.id;
          return (
            <Pressable
              key={option.id}
              disabled={!isActive || !!myVote || castVote.isPending}
              onPress={() => handlePick(option.id)}
              style={[
                styles.pollOption,
                isActive ? styles.pollOptionActive : styles.pollOptionClosed,
                picked && isActive && styles.pollOptionPicked,
              ]}>
              <View style={[styles.pollOptionFill, { width: `${option.pct}%` }, !isActive && styles.pollOptionFillClosed]} />
              <View style={styles.pollOptionRow}>
                <View style={styles.pollOptionLabelRow}>
                  <Text style={[styles.pollOptionLabel, !isActive && { fontWeight: option.isLeading ? '700' : '500' }]}>
                    {option.label}
                  </Text>
                  {picked && isActive && <CheckIcon />}
                </View>
                <Text style={styles.pollOptionPct}>{option.pct}%</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {isActive && myVote && <Text style={styles.pollFooter}>Your vote is recorded</Text>}
      {isActive && !myVote && <Text style={styles.pollFooter}>Tap an option to vote once</Text>}
      {!isActive && <Text style={styles.pollFooter}>Voting has closed</Text>}
    </View>
  );
}

export default function CommunityScreen() {
  const [activeTab, setActiveTab] = useState<CommunityTab>('Notices');
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const noticesQuery = useNotices(profileQuery.data?.society_id);
  const pollsQuery = usePolls(profileQuery.data?.society_id);

  const notices = noticesQuery.data ?? [];
  const polls = pollsQuery.data ?? [];
  const [pinned, ...rest] = notices;

  usePollVotesRealtimeSync(profileQuery.data?.society_id);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Community</Text>
      <Text style={styles.subtitle}>Notices &amp; polls from your society</Text>

      <View style={styles.segmented}>
        {(['Notices', 'Polls'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.segment, activeTab === tab && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, activeTab === tab && styles.segmentLabelActive]}>{tab}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'Notices' && (
        <>
          <AsyncState
            isLoading={noticesQuery.isLoading}
            isError={noticesQuery.isError}
            onRetry={() => noticesQuery.refetch()}
            isEmpty={notices.length === 0}
            emptyMessage="No notices published yet."
          />

          {pinned && (
            <Pressable style={styles.pinnedCard} onPress={() => router.push(`/(resident)/notice/${pinned.id}`)}>
              <View style={styles.pinnedTopRow}>
                <StarIcon />
                <Text style={styles.pinnedOverline}>PINNED · {getNoticeCategoryStyle(pinned.category).label.toUpperCase()}</Text>
              </View>
              <Text style={styles.pinnedTitle}>{pinned.title}</Text>
              <Text style={styles.pinnedMeta}>
                {formatDate(pinned.published_at ?? pinned.created_at)} · Read more →
              </Text>
            </Pressable>
          )}

          <View style={styles.list}>
            {rest.map((notice) => {
              const catStyle = getNoticeCategoryStyle(notice.category);
              return (
                <Pressable key={notice.id} style={styles.card} onPress={() => router.push(`/(resident)/notice/${notice.id}`)}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.catPill, { backgroundColor: catStyle.bg }]}>
                      <Text style={[styles.catPillLabel, { color: catStyle.color }]}>{catStyle.label}</Text>
                    </View>
                    <Text style={styles.cardDate}>{formatDate(notice.published_at ?? notice.created_at)}</Text>
                  </View>
                  <Text style={styles.cardTitle}>{notice.title}</Text>
                  <Text style={styles.cardBy}>Society Office</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {activeTab === 'Polls' && (
        <>
          <AsyncState
            isLoading={pollsQuery.isLoading}
            isError={pollsQuery.isError}
            onRetry={() => pollsQuery.refetch()}
            isEmpty={polls.length === 0}
            emptyMessage="No polls right now."
          />
          <View style={styles.pollsList}>
            {polls.map((poll) => (
              <PollCard key={poll.id} poll={poll} societyId={profileQuery.data?.society_id} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingTop: 66, paddingHorizontal: 16, paddingBottom: 48 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 26 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  segmented: { flexDirection: 'row', backgroundColor: '#EBE6D8', borderRadius: 14, padding: 4, marginTop: 16 },
  segment: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: Colors.green500 },
  segmentLabel: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  segmentLabelActive: { color: Colors.textOnDark },

  pinnedCard: { marginTop: 16, backgroundColor: Colors.green500, borderRadius: Radius.cardLarge - 2, padding: 18 },
  pinnedTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinnedOverline: { fontSize: 10.5, letterSpacing: 2, fontWeight: '700', color: Colors.gold },
  pinnedTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    lineHeight: 24,
    color: Colors.textOnDark,
    marginTop: 10,
  },
  pinnedMeta: { fontSize: 12.5, color: 'rgba(247,244,236,0.6)', marginTop: 8 },
  list: { gap: 10, marginTop: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    padding: 15,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catPill: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999 },
  catPillLabel: { fontSize: 10, letterSpacing: 0.5, fontWeight: '700' },
  cardDate: { fontSize: 11.5, color: Colors.textFaint },
  cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20, marginTop: 9 },
  cardBy: { fontSize: 12.5, color: Colors.textMuted, marginTop: 5 },

  pollsList: { gap: 12, marginTop: 16 },
  pollCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.cardLarge - 2, padding: 18 },
  pollTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: Colors.success600 },
  activeBadgeLabel: { fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700', color: Colors.success600 },
  closedBadgeLabel: { fontSize: 10.5, letterSpacing: 1, fontWeight: '700', color: Colors.textFaint },
  pollVotesLabel: { fontSize: 11.5, color: Colors.textFaint },
  pollQuestion: { fontFamily: FontFamily.headingBold, fontSize: 17.5, lineHeight: 23, marginTop: 12 },
  pollOptions: { marginTop: 6 },
  pollOption: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    marginTop: 10,
    minHeight: 48,
    borderWidth: 1.5,
  },
  pollOptionActive: { borderColor: Colors.border, backgroundColor: Colors.surface },
  pollOptionClosed: { borderColor: '#EEEAE0', backgroundColor: Colors.surface },
  pollOptionPicked: { borderColor: Colors.success700 },
  pollOptionFill: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: '#E9F1EC' },
  pollOptionFillClosed: { backgroundColor: '#EEEDE4' },
  pollOptionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, gap: 10 },
  pollOptionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  pollOptionLabel: { fontSize: 14.5, fontWeight: '600', color: '#17251D' },
  pollOptionPct: { fontSize: 13, fontWeight: '700', color: Colors.success700 },
  pollFooter: { fontSize: 12.5, color: Colors.textMuted, marginTop: 12 },
});

import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AsyncState } from '@/components/async-state';
import { AgoraLogo } from '@/components/icons/agora-logo';
import { avatarColorForName, getInitials, getTimeBasedGreeting } from '@/commonFunctions';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { usePendingVisitorRequests, useTodaysVisitorRequestsCount } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';

function PlusIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={Colors.green500} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function PendingIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke="#9A6B14" strokeWidth={1.8} />
      <Path d="M12 7.5V12l3 2" stroke="#9A6B14" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TodayIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={15} rx={2} stroke={Colors.success700} strokeWidth={1.7} />
      <Path d="M4 10h16M8 3v4M16 3v4" stroke={Colors.success700} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export default function GuardHomeScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const pendingQuery = usePendingVisitorRequests();
  const todaysCountQuery = useTodaysVisitorRequestsCount();

  const profile = profileQuery.data;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.brandRow}>
            <AgoraLogo size={24} />
            <Text style={styles.brandLabel}>Agora</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{profile ? getInitials(profile.full_name) : ''}</Text>
          </View>
        </View>
        <Text style={styles.greeting}>
          {getTimeBasedGreeting()}, {profile?.full_name.split(' ')[0] ?? ''}
        </Text>
        <Text style={styles.societyName}>{profile?.society?.name ?? ''} · Gate duty</Text>
      </View>

      <View style={styles.body}>
        <Pressable style={styles.registerCard} onPress={() => router.push('/(guard)/register-visitor')}>
          <View style={styles.registerIconWrap}>
            <PlusIcon />
          </View>
          <View style={styles.flex}>
            <Text style={styles.registerTitle}>Register Visitor</Text>
            <Text style={styles.registerSub}>Log a new arrival and notify the resident</Text>
          </View>
        </Pressable>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <PendingIcon />
            <Text style={styles.statValue}>{pendingQuery.data?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Pending Requests</Text>
          </View>
          <View style={styles.statCard}>
            <TodayIcon />
            <Text style={styles.statValue}>{todaysCountQuery.data ?? 0}</Text>
            <Text style={styles.statLabel}>Raised Today</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Pending Requests</Text>
        <View style={styles.opsCard}>
          <AsyncState
            isLoading={pendingQuery.isLoading}
            isError={pendingQuery.isError}
            isEmpty={pendingQuery.data?.length === 0}
            emptyMessage="No pending requests. Register a visitor to get started."
          />
          {pendingQuery.data?.map((request) => (
            <View key={request.id} style={styles.requestRow}>
              <View style={[styles.requestAvatar, { backgroundColor: avatarColorForName(request.visitor?.name ?? '?') }]}>
                <Text style={styles.requestInitial}>{getInitials(request.visitor?.name ?? '?')}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.requestName}>{request.visitor?.name ?? 'Visitor'}</Text>
                <Text style={styles.requestSub}>
                  {request.visitor?.category ?? '—'} ·{' '}
                  {request.flat?.tower ? `${request.flat.tower.code}-${request.flat.number}` : (request.flat?.number ?? '—')}
                </Text>
              </View>
              <View style={styles.waitingPill}>
                <Text style={styles.waitingLabel}>Waiting</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  scrollContent: { paddingBottom: 48 },
  flex: { flex: 1 },
  header: { backgroundColor: Colors.green400, paddingTop: 58, paddingHorizontal: 20, paddingBottom: 60 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandLabel: { fontFamily: FontFamily.headingExtraBold, fontSize: 19, color: Colors.textOnDark },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: Colors.textOnDark,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 14, color: Colors.green500 },
  greeting: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textOnDark, marginTop: 20 },
  societyName: { fontSize: 14, fontWeight: '600', color: 'rgba(247,244,236,0.72)', marginTop: 6 },
  body: { paddingHorizontal: 16, marginTop: -40 },
  registerCard: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.cardLarge - 2,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#10261B',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  registerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(16,38,27,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerTitle: { fontFamily: FontFamily.headingExtraBold, fontSize: 17, color: Colors.green500 },
  registerSub: { fontSize: 12.5, color: '#3E4A20', marginTop: 3 },
  statsRow: { flexDirection: 'row', gap: 11, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 15 },
  statValue: { fontFamily: FontFamily.headingExtraBold, fontSize: 23, marginTop: 10 },
  statLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: 17, marginTop: 24 },
  opsCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, marginTop: 12 },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0ECE0',
  },
  requestAvatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  requestInitial: { fontFamily: FontFamily.headingBold, fontSize: 15, color: Colors.green500 },
  requestName: { fontSize: 14.5, fontWeight: '600' },
  requestSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  waitingPill: { backgroundColor: '#F6ECD8', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  waitingLabel: { fontSize: 11, fontWeight: '700', color: '#9A6B14' },
});

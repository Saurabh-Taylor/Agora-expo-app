import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AsyncState } from '@/components/async-state';
import { AgoraLogo } from '@/components/icons/agora-logo';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { getInitials, getTimeBasedGreeting } from '@/commonFunctions';
import { useOpenComplaintsCount } from '@/features/complaints/api';
import { usePendingBookingsCount, useTodaysBookings } from '@/features/amenities/api';
import { useRecentAuditEvents } from '@/features/audit/api';
import { useFlats } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useResidents } from '@/features/residents/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

function ShieldAlertIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5l9.5 16.5H2.5L12 3.5z" stroke={Colors.danger500} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 10v4M12 16.5h.01" stroke={Colors.danger500} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function VerifyIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3} stroke={Colors.success700} strokeWidth={1.8} />
      <Path d="M3.5 19c0-3.2 2.6-5.3 5.5-5.3s5.5 2.1 5.5 5.3" stroke={Colors.success700} strokeWidth={1.8} />
      <Path d="M15 12l1.6 1.6L20 10" stroke={Colors.success700} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ComplaintIcon({ color = Colors.danger700 }: { color?: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3.5l9.5 16.5H2.5L12 3.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 10v4M12 16.5h.01" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ApprovalsIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={3.5} width={14} height={17} rx={2} stroke="#9A6B14" strokeWidth={1.8} />
      <Path d="M9 11l2 2 4-4.5" stroke="#9A6B14" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ResidentsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.2} stroke={Colors.success700} strokeWidth={1.7} />
      <Path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" stroke={Colors.success700} strokeWidth={1.7} />
      <Circle cx={17} cy={9} r={2.6} stroke={Colors.success700} strokeWidth={1.5} opacity={0.6} />
    </Svg>
  );
}

function FlatsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={4} width={14} height={17} rx={1.5} stroke={Colors.textPrimary} strokeWidth={1.7} />
      <Path d="M9 8h1M9 12h1M14 8h1M14 12h1M9 16h1M14 16h1" stroke={Colors.textPrimary} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function BookingsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={15} rx={2} stroke="#9A6B14" strokeWidth={1.7} />
      <Path d="M4 10h16M8 3v4M16 3v4" stroke="#9A6B14" strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

export default function AdminHomeScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const residentsQuery = useResidents();
  const flatsQuery = useFlats();
  const openComplaintsQuery = useOpenComplaintsCount();
  const pendingBookingsQuery = usePendingBookingsCount();
  const todaysBookingsQuery = useTodaysBookings();
  const auditQuery = useRecentAuditEvents(3);

  const profile = profileQuery.data;
  const pendingVerifyCount = residentsQuery.data?.filter((r) => !r.is_verified).length ?? 0;
  const openComplaints = openComplaintsQuery.data ?? 0;
  const pendingBookings = pendingBookingsQuery.data ?? 0;
  const priorityCount = pendingVerifyCount + openComplaints + pendingBookings;

  function comingSoon() {
    showToast('Coming in a later phase');
  }

  const quickActions = [
    { label: 'Add Resident', bg: '#E9F1EC', Icon: ResidentsIcon, go: () => router.push('/(admin)/add-resident') },
    { label: 'Publish Notice', bg: '#F6ECD8', Icon: BookingsIcon, go: comingSoon },
    { label: 'Create Poll', bg: '#EFEAF7', Icon: BookingsIcon, go: comingSoon },
    { label: 'Add Complaint', bg: '#F9E4E1', Icon: ComplaintIcon, go: comingSoon },
    { label: 'Add Staff', bg: '#E4EFF5', Icon: ResidentsIcon, go: comingSoon },
    { label: 'Manage Amenity', bg: '#E9F1EC', Icon: BookingsIcon, go: comingSoon },
    { label: 'View Reports', bg: '#EEEDE4', Icon: FlatsIcon, go: comingSoon },
    { label: 'More', bg: '#EEEDE4', Icon: FlatsIcon, go: () => router.push('/(admin)/(tabs)/more') },
  ];

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
        <Text style={styles.societyName}>{profile?.society?.name ?? ''}</Text>
      </View>

      <View style={styles.body}>
        {priorityCount > 0 ? (
          <View style={styles.priorityCard}>
            <View style={styles.priorityHeaderRow}>
              <View style={styles.priorityIconWrap}>
                <ShieldAlertIcon />
              </View>
              <Text style={styles.priorityTitle}>Priority Actions</Text>
            </View>
            <Text style={styles.prioritySub}>You have {priorityCount} pending items that need your attention.</Text>
            <View style={styles.priorityStatsRow}>
              <Pressable style={styles.priorityStat} onPress={() => router.push('/(admin)/(tabs)/community')}>
                <View style={styles.priorityStatTop}>
                  <VerifyIcon />
                  <Text style={styles.priorityStatValue}>{pendingVerifyCount}</Text>
                </View>
                <Text style={styles.priorityStatLabel}>Resident Verifications</Text>
              </Pressable>
              <Pressable style={styles.priorityStat} onPress={() => router.push('/(admin)/(tabs)/complaints')}>
                <View style={styles.priorityStatTop}>
                  <ComplaintIcon />
                  <Text style={styles.priorityStatValue}>{openComplaints}</Text>
                </View>
                <Text style={styles.priorityStatLabel}>Open Complaints</Text>
              </Pressable>
              <Pressable style={styles.priorityStat} onPress={comingSoon}>
                <View style={styles.priorityStatTop}>
                  <ApprovalsIcon />
                  <Text style={styles.priorityStatValue}>{pendingBookings}</Text>
                </View>
                <Text style={styles.priorityStatLabel}>Approvals</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.allCaughtUpCard}>
            <Text style={styles.allCaughtUpTitle}>You&apos;re all caught up</Text>
            <Text style={styles.allCaughtUpSub}>No pending verifications, complaints or approvals</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <ResidentsIcon />
            <Text style={styles.statValue}>{residentsQuery.data?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Total Residents</Text>
          </View>
          <View style={styles.statCard}>
            <FlatsIcon />
            <Text style={styles.statValue}>{flatsQuery.data?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Total Flats</Text>
          </View>
          <View style={styles.statCard}>
            <ComplaintIcon />
            <Text style={styles.statValue}>{openComplaints}</Text>
            <Text style={styles.statLabel}>Open Complaints</Text>
          </View>
          <View style={styles.statCard}>
            <BookingsIcon />
            <Text style={styles.statValue}>{todaysBookingsQuery.data?.length ?? 0}</Text>
            <Text style={styles.statLabel}>Bookings Today</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action) => (
            <Pressable key={action.label} style={styles.quickAction} onPress={action.go}>
              <View style={[styles.quickActionIcon, { backgroundColor: action.bg }]}>
                <action.Icon />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Today&apos;s Operations</Text>
        <View style={styles.opsCard}>
          <AsyncState
            isLoading={todaysBookingsQuery.isLoading}
            isError={todaysBookingsQuery.isError}
            onRetry={() => todaysBookingsQuery.refetch()}
            isEmpty={todaysBookingsQuery.data?.length === 0}
            emptyMessage="Nothing scheduled for today."
          />
          {todaysBookingsQuery.data?.map((booking) => (
            <View key={booking.id} style={styles.opRow}>
              <View style={styles.opIconWrap}>
                <BookingsIcon />
              </View>
              <View style={styles.flex}>
                <Text style={styles.opTitle}>{booking.amenity?.name ?? 'Amenity'}</Text>
                <Text style={styles.opSub}>
                  {new Date(booking.slot_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.confirmedPill}>
                <Text style={styles.confirmedLabel}>Confirmed</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>
        <View style={styles.opsCard}>
          <AsyncState
            isLoading={auditQuery.isLoading}
            isError={auditQuery.isError}
            onRetry={() => auditQuery.refetch()}
            isEmpty={auditQuery.data?.length === 0}
            emptyMessage="No recent activity yet."
          />
          {auditQuery.data?.map((event) => (
            <View key={event.id} style={styles.activityRow}>
              <View style={styles.activityDot} />
              <View style={styles.flex}>
                <Text style={styles.activityText}>{event.action}</Text>
                <Text style={styles.activityMeta}>{new Date(event.created_at).toLocaleString()}</Text>
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
  scrollContent: { paddingBottom: 108 },
  flex: { flex: 1 },
  header: {
    backgroundColor: Colors.green400,
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
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
  priorityCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.cardLarge - 2,
    padding: 18,
    shadowColor: '#10261B',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 4,
  },
  priorityHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  priorityIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FBE7E2', alignItems: 'center', justifyContent: 'center' },
  priorityTitle: { fontFamily: FontFamily.headingExtraBold, fontSize: 16, color: Colors.textPrimary, flex: 1 },
  prioritySub: { fontSize: 13, color: Colors.textMuted, marginTop: 8, lineHeight: 19 },
  priorityStatsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  priorityStat: { flex: 1, backgroundColor: '#F7F4EC', borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 11 },
  priorityStatTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityStatValue: { fontFamily: FontFamily.headingExtraBold, fontSize: 16 },
  priorityStatLabel: { fontSize: 10.5, color: Colors.textMuted, marginTop: 5, lineHeight: 13 },
  allCaughtUpCard: {
    backgroundColor: '#E9F1EC',
    borderWidth: 1,
    borderColor: '#CFE3D8',
    borderRadius: Radius.cardLarge - 2,
    padding: 20,
    alignItems: 'center',
  },
  allCaughtUpTitle: { fontSize: 14.5, fontWeight: '700', color: Colors.success700 },
  allCaughtUpSub: { fontSize: 12.5, color: '#3E6B50', marginTop: 3 },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: 17, marginTop: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 12 },
  statCard: { width: '47.5%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 15 },
  statValue: { fontFamily: FontFamily.headingExtraBold, fontSize: 23, marginTop: 10 },
  statLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  quickAction: { width: '22%', alignItems: 'center' },
  quickActionIcon: { width: '100%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 7, textAlign: 'center', lineHeight: 13 },
  opsCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, marginTop: 12 },
  opRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0ECE0' },
  opIconWrap: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#F6ECD8', alignItems: 'center', justifyContent: 'center' },
  opTitle: { fontSize: 14, fontWeight: '600' },
  opSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  confirmedPill: { backgroundColor: '#E3F2E9', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  confirmedLabel: { fontSize: 11, fontWeight: '700', color: Colors.success600 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0ECE0' },
  activityDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: Colors.success600 },
  activityText: { fontSize: 13.5, color: '#2C3830', lineHeight: 18 },
  activityMeta: { fontSize: 11.5, color: Colors.textFaint, marginTop: 2 },
});

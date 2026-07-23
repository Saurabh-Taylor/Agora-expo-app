import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AdminDashboardActionCard,
  AdminDashboardGrid,
  AdminDashboardListRow,
  AdminDashboardMetricCard,
  AdminDashboardPanel,
  AdminDashboardSection,
} from '@/components/admin-dashboard';
import { AsyncState } from '@/components/async-state';
import { AgoraLogo } from '@/components/icons/agora-logo';
import { AgoraSymbol, type AgoraSymbolName } from '@/components/icons/agora-symbol';
import { getInitials, getTimeBasedGreeting } from '@/commonFunctions';
import {
  type AdminDashboardTone,
  AdminDashboardTones,
  Colors,
  FontFamily,
  Radius,
} from '@/constants/commonConstants';
import { usePendingBookingsCount, useTodaysBookings } from '@/features/amenities/api';
import { useRecentAuditEvents } from '@/features/audit/api';
import { useOpenComplaintsCount } from '@/features/complaints/api';
import { useFlats } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useResidents } from '@/features/residents/api';
import { useAuthStore } from '@/stores/auth-store';

type QuickAction = {
  label: string;
  supportingText: string;
  icon: AgoraSymbolName;
  tone: AdminDashboardTone;
  route: Href;
};

const QUICK_ACTIONS = [
  {
    label: 'Add resident',
    supportingText: 'Create account',
    icon: 'addResident',
    tone: 'green',
    route: '/(admin)/add-resident',
  },
  {
    label: 'Publish notice',
    supportingText: 'Reach everyone',
    icon: 'notice',
    tone: 'gold',
    route: '/(admin)/compose-notice',
  },
  {
    label: 'Create poll',
    supportingText: 'Collect votes',
    icon: 'poll',
    tone: 'purple',
    route: '/(admin)/create-poll',
  },
  {
    label: 'Complaints',
    supportingText: 'Review helpdesk',
    icon: 'complaint',
    tone: 'red',
    route: '/(admin)/(tabs)/complaints',
  },
  {
    label: 'Add staff',
    supportingText: 'Build directory',
    icon: 'staff',
    tone: 'blue',
    route: '/(admin)/add-staff',
  },
  {
    label: 'Amenities',
    supportingText: 'Manage spaces',
    icon: 'amenity',
    tone: 'green',
    route: '/(admin)/amenities',
  },
  {
    label: 'Audit trail',
    supportingText: 'Review changes',
    icon: 'audit',
    tone: 'neutral',
    route: '/(admin)/audit',
  },
  {
    label: 'All modules',
    supportingText: 'Explore more',
    icon: 'more',
    tone: 'gold',
    route: '/(admin)/(tabs)/more',
  },
] as const satisfies readonly QuickAction[];

type PriorityItem = {
  count: number;
  title: string;
  subtitle: string;
  icon: AgoraSymbolName;
  tone: AdminDashboardTone;
  route: Href;
};

export default function AdminHomeScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const residentsQuery = useResidents(societyId);
  const flatsQuery = useFlats(societyId);
  const openComplaintsQuery = useOpenComplaintsCount(societyId);
  const pendingBookingsQuery = usePendingBookingsCount(societyId);
  const todaysBookingsQuery = useTodaysBookings(societyId);
  const auditQuery = useRecentAuditEvents(societyId, 3);

  const profile = profileQuery.data;
  const pendingVerifyCount = useMemo(
    () => residentsQuery.data?.filter((resident) => resident.is_active && !resident.is_verified).length ?? 0,
    [residentsQuery.data],
  );
  const openComplaints = openComplaintsQuery.data ?? 0;
  const pendingBookings = pendingBookingsQuery.data ?? 0;
  const priorityItems = useMemo<PriorityItem[]>(
    () =>
      [
        {
          count: pendingVerifyCount,
          title: 'Resident verification',
          subtitle: 'Review pending resident access',
          icon: 'verification' as const,
          tone: 'green' as const,
          route: '/(admin)/(tabs)/community' as Href,
        },
        {
          count: openComplaints,
          title: 'Open complaints',
          subtitle: 'Triage unresolved requests',
          icon: 'complaint' as const,
          tone: 'red' as const,
          route: '/(admin)/(tabs)/complaints' as Href,
        },
        {
          count: pendingBookings,
          title: 'Booking approvals',
          subtitle: 'Review amenity requests',
          icon: 'booking' as const,
          tone: 'gold' as const,
          route: '/(admin)/amenities' as Href,
        },
      ].filter((item) => item.count > 0),
    [openComplaints, pendingBookings, pendingVerifyCount],
  );

  const priorityCount = priorityItems.reduce((total, item) => total + item.count, 0);
  const priorityIsLoading =
    residentsQuery.isLoading || openComplaintsQuery.isLoading || pendingBookingsQuery.isLoading;
  const priorityIsError =
    residentsQuery.isError || openComplaintsQuery.isError || pendingBookingsQuery.isError;
  const firstName = profile?.full_name.split(' ')[0] ?? 'Admin';
  const societyName = profile?.society?.name ?? (profileQuery.isLoading ? 'Loading society...' : 'Your society');
  const todayLabel = new Date().toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  function retryPriorities() {
    residentsQuery.refetch();
    openComplaintsQuery.refetch();
    pendingBookingsQuery.refetch();
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View pointerEvents="none" style={styles.headerOrbLarge} />
        <View pointerEvents="none" style={styles.headerOrbSmall} />

        <View style={styles.headerTopRow}>
          <View style={styles.brandRow}>
            <AgoraLogo size={25} />
            <Text style={styles.brandLabel}>Agora</Text>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeLabel}>ADMIN</Text>
            </View>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{profile ? getInitials(profile.full_name) : 'A'}</Text>
          </View>
        </View>

        <Text style={styles.headerEyebrow}>{todayLabel.toUpperCase()}</Text>
        <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {getTimeBasedGreeting()}, {firstName}
        </Text>
        <View style={styles.societyPill}>
          <AgoraSymbol name="flats" color={Colors.gold} size={17} />
          <Text style={styles.societyName} numberOfLines={1}>
            {societyName}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.priorityCard}>
          <View style={styles.priorityHeader}>
            <View style={styles.priorityTitleRow}>
              <View style={styles.priorityHeaderIcon}>
                <AgoraSymbol name="attention" color={Colors.danger700} size={21} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.priorityEyebrow}>ACTION QUEUE</Text>
                <Text style={styles.priorityTitle}>Needs your attention</Text>
              </View>
              {!priorityIsLoading && !priorityIsError && (
                <View style={styles.priorityCountBadge}>
                  <Text style={styles.priorityCountLabel}>{priorityCount}</Text>
                </View>
              )}
            </View>

            {priorityIsLoading ? (
              <View style={styles.priorityState}>
                <ActivityIndicator color={Colors.success700} />
                <Text style={styles.priorityStateLabel}>Checking today&apos;s priorities...</Text>
              </View>
            ) : priorityIsError ? (
              <AsyncState
                isLoading={false}
                isError
                onRetry={retryPriorities}
                errorTitle="Couldn't check your priorities"
                errorMessage="The rest of the dashboard is still available."
              />
            ) : priorityItems.length > 0 ? (
              <AdminDashboardPanel>
                {priorityItems.map((item, index) => (
                  <AdminDashboardListRow
                    key={item.title}
                    icon={item.icon}
                    tone={item.tone}
                    title={item.title}
                    subtitle={item.subtitle}
                    trailing={
                      <View style={[styles.rowCount, { backgroundColor: AdminDashboardTones[item.tone].background }]}>
                        <Text style={[styles.rowCountLabel, { color: AdminDashboardTones[item.tone].foreground }]}>
                          {item.count}
                        </Text>
                      </View>
                    }
                    onPress={() => router.push(item.route)}
                    showChevron
                    isLast={index === priorityItems.length - 1}
                  />
                ))}
              </AdminDashboardPanel>
            ) : (
              <View style={styles.caughtUp}>
                <View style={styles.caughtUpIcon}>
                  <AgoraSymbol name="success" color={Colors.success700} size={24} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.caughtUpTitle}>Everything is on track</Text>
                  <Text style={styles.caughtUpSubtitle}>No pending approvals or unresolved actions.</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <AdminDashboardSection title="Society at a glance" subtitle="A live snapshot of today's operations">
          <AdminDashboardGrid>
            <AdminDashboardMetricCard
              icon="residents"
              tone="green"
              value={residentsQuery.isLoading ? '--' : (residentsQuery.data?.length ?? 0)}
              label="Residents"
              supportingText="Community members"
              onPress={() => router.push('/(admin)/(tabs)/community')}
            />
            <AdminDashboardMetricCard
              icon="flats"
              tone="neutral"
              value={flatsQuery.isLoading ? '--' : (flatsQuery.data?.length ?? 0)}
              label="Flats"
              supportingText="Homes configured"
              onPress={() => router.push('/(admin)/(tabs)/community')}
            />
            <AdminDashboardMetricCard
              icon="complaint"
              tone="red"
              value={openComplaintsQuery.isLoading ? '--' : openComplaints}
              label="Open complaints"
              supportingText="Awaiting resolution"
              onPress={() => router.push('/(admin)/(tabs)/complaints')}
            />
            <AdminDashboardMetricCard
              icon="booking"
              tone="gold"
              value={todaysBookingsQuery.isLoading ? '--' : (todaysBookingsQuery.data?.length ?? 0)}
              label="Bookings today"
              supportingText="Amenity schedule"
              onPress={() => router.push('/(admin)/amenities')}
            />
          </AdminDashboardGrid>
        </AdminDashboardSection>

        <AdminDashboardSection title="Quick actions" subtitle="Frequent admin tasks, one tap away">
          <AdminDashboardGrid>
            {QUICK_ACTIONS.map((action) => (
              <AdminDashboardActionCard
                key={action.label}
                icon={action.icon}
                tone={action.tone}
                label={action.label}
                supportingText={action.supportingText}
                onPress={() => router.push(action.route)}
              />
            ))}
          </AdminDashboardGrid>
        </AdminDashboardSection>

        <AdminDashboardSection title="Today's bookings" subtitle="Confirmed amenity activity">
          <AdminDashboardPanel>
            <AsyncState
              isLoading={todaysBookingsQuery.isLoading}
              isError={todaysBookingsQuery.isError}
              onRetry={() => todaysBookingsQuery.refetch()}
              isEmpty={todaysBookingsQuery.data?.length === 0}
              emptyTitle="No bookings today"
              emptyMessage="Today's amenity schedule is clear."
            />
            {todaysBookingsQuery.data?.map((booking, index) => (
              <AdminDashboardListRow
                key={booking.id}
                icon="booking"
                tone="gold"
                title={booking.amenity?.name ?? 'Amenity booking'}
                subtitle={new Date(booking.slot_start).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                trailing={
                  <View style={styles.statusPill}>
                    <Text style={styles.statusLabel}>Confirmed</Text>
                  </View>
                }
                isLast={index === (todaysBookingsQuery.data?.length ?? 0) - 1}
              />
            ))}
          </AdminDashboardPanel>
        </AdminDashboardSection>

        <AdminDashboardSection title="Recent activity" subtitle="Latest administrative changes">
          <AdminDashboardPanel>
            <AsyncState
              isLoading={auditQuery.isLoading}
              isError={auditQuery.isError}
              onRetry={() => auditQuery.refetch()}
              isEmpty={auditQuery.data?.length === 0}
              emptyTitle="No recent activity"
              emptyMessage="Administrative changes will appear here."
            />
            {auditQuery.data?.map((event, index) => (
              <AdminDashboardListRow
                key={event.id}
                icon="audit"
                tone="neutral"
                title={event.action}
                subtitle={new Date(event.created_at).toLocaleString()}
                isLast={index === (auditQuery.data?.length ?? 0) - 1}
              />
            ))}
          </AdminDashboardPanel>
        </AdminDashboardSection>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  scrollContent: { paddingBottom: 120 },
  flex: { flex: 1, minWidth: 0 },
  header: {
    overflow: 'hidden',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 70,
    backgroundColor: Colors.green400,
  },
  headerOrbLarge: {
    position: 'absolute',
    width: 230,
    height: 230,
    top: -70,
    right: -88,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  headerOrbSmall: {
    position: 'absolute',
    width: 104,
    height: 104,
    right: 42,
    bottom: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(231,163,60,0.07)',
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandLabel: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 20,
    color: Colors.textOnDark,
  },
  adminBadge: {
    marginLeft: 3,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(231,163,60,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(231,163,60,0.35)',
  },
  adminBadgeLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: Colors.gold,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: Colors.textOnDark,
  },
  avatarLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 15,
    color: Colors.green500,
  },
  headerEyebrow: {
    marginTop: 22,
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.gold,
  },
  greeting: {
    marginTop: 7,
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 29,
    lineHeight: 32,
    color: Colors.textOnDark,
  },
  societyPill: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    minHeight: 34,
    marginTop: 14,
    paddingVertical: 7,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(247,244,236,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(247,244,236,0.12)',
  },
  societyName: {
    flexShrink: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12.5,
    color: 'rgba(247,244,236,0.82)',
  },
  body: { paddingHorizontal: 16, marginTop: -52 },
  priorityCard: {
    padding: 16,
    borderRadius: Radius.cardLarge,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    shadowColor: Colors.green900,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 5,
  },
  priorityHeader: { gap: 14 },
  priorityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  priorityHeaderIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: AdminDashboardTones.red.background,
  },
  priorityEyebrow: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: Colors.textMuted,
  },
  priorityTitle: {
    marginTop: 2,
    fontFamily: FontFamily.headingBold,
    fontSize: 17,
    color: Colors.textPrimary,
  },
  priorityCountBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: AdminDashboardTones.red.background,
  },
  priorityCountLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 13,
    color: Colors.danger700,
  },
  priorityState: {
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  priorityStateLabel: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12.5,
    color: Colors.textMuted,
  },
  rowCount: {
    minWidth: 27,
    height: 27,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  rowCountLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 12,
  },
  caughtUp: {
    minHeight: 78,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.card,
    backgroundColor: AdminDashboardTones.green.background,
  },
  caughtUpIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: Colors.surface,
  },
  caughtUpTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13.5,
    color: Colors.success700,
  },
  caughtUpSubtitle: {
    marginTop: 2,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11.5,
    color: AdminDashboardTones.green.foreground,
  },
  statusPill: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: Radius.pill,
    backgroundColor: AdminDashboardTones.green.background,
  },
  statusLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    color: Colors.success700,
  },
});

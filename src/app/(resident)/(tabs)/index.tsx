import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { avatarColorForName, formatTime, getInitials, getTimeBasedGreeting, getVisitorRequestStatusStyle, titleCase } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { AgoraLogo } from '@/components/icons/agora-logo';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useDuesRealtimeSync, useFlatDues } from '@/features/dues/api';
import { useFlatWithTower } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useFlatVisitorRequests, useVisitorRequestsRealtimeSync } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';

function PlusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={Colors.success700} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function ShieldCheckIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l8 3.6v5.2c0 5.2-3.4 8.9-8 10.6-4.6-1.7-8-5.4-8-10.6V5.6L12 2z" stroke={Colors.gold} strokeWidth={1.8} />
      <Path d="M8.6 12l2.3 2.3 4.5-4.6" stroke={Colors.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MegaphoneIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10v4a1 1 0 0 0 1 1h2l7 4V5L6 9H4a1 1 0 0 0-1 1z" stroke={Colors.success700} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M18 9.5c1 .8 1 3.2 0 4" stroke={Colors.success700} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke={Colors.success700} strokeWidth={1.8} />
      <Path d="M3 9.5h18M8 3v3.6M16 3v3.6" stroke={Colors.success700} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function RupeeIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4h12M6 8h12M6 8c4 0 7 1.5 7 4.5S14 17 8 17l8 6" stroke={Colors.success700} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ResidentHomeScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const profile = profileQuery.data;
  const flatQuery = useFlatWithTower(profile?.flat_id, profile?.society_id);
  const requestsQuery = useFlatVisitorRequests(profile?.flat_id, profile?.society_id);
  const duesQuery = useFlatDues(profile?.flat_id, profile?.society_id);

  useVisitorRequestsRealtimeSync('flat_id', profile?.flat_id);
  useDuesRealtimeSync(profile?.flat_id, profile?.society_id);

  const requests = requestsQuery.data ?? [];
  const pending = requests.find((request) => request.status === 'PENDING');
  const recent = requests.filter((request) => request.id !== pending?.id).slice(0, 5);
  const lastResolved = recent[0];

  const currentDue = (duesQuery.data ?? [])
    .filter((due) => due.status === 'UNPAID')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const duesSubtitle = currentDue
    ? `₹${currentDue.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} due`
    : 'View bills & payment history';

  return (
    <View style={styles.root}>
      {pending && (
        <Pressable style={styles.banner} onPress={() => router.push(`/(resident)/visitor-request/${pending.id}`)}>
          <View style={[styles.bannerAvatar, { backgroundColor: avatarColorForName(pending.visitor?.name ?? '?') }]}>
            <Text style={styles.bannerAvatarLabel}>{getInitials(pending.visitor?.name ?? '?')}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.bannerOverline}>AGORA · GATE · NOW</Text>
            <Text style={styles.bannerTitle}>{pending.visitor?.name ?? 'Visitor'} is at the gate</Text>
            <Text style={styles.bannerSub}>Tap to respond</Text>
          </View>
          <View style={styles.bannerDot} />
        </Pressable>
      )}

      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
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
          {flatQuery.data && (
            <View style={styles.flatChip}>
              <Text style={styles.flatChipLabel}>
                {flatQuery.data.tower ? `${flatQuery.data.tower.code}-${flatQuery.data.number}` : flatQuery.data.number}
                {flatQuery.data.tower ? ` · ${flatQuery.data.tower.name}` : ''}
                {profile?.society?.name ? ` · ${profile.society.name}` : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {pending ? (
            <Pressable style={styles.ringingCard} onPress={() => router.push(`/(resident)/visitor-request/${pending.id}`)}>
              <View style={styles.ringingTopRow}>
                <View style={styles.liveDot} />
                <Text style={styles.ringingOverline}>WAITING AT THE GATE</Text>
              </View>
              <View style={styles.ringingMain}>
                <View style={[styles.ringingAvatar, { backgroundColor: avatarColorForName(pending.visitor?.name ?? '?') }]}>
                  <Text style={styles.ringingAvatarLabel}>{getInitials(pending.visitor?.name ?? '?')}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.ringingName}>{pending.visitor?.name ?? 'Visitor'}</Text>
                  <Text style={styles.ringingSub}>{pending.visitor ? titleCase(pending.visitor.category) : '—'}</Text>
                </View>
              </View>
              <View style={styles.respondButton}>
                <Text style={styles.respondButtonLabel}>Respond</Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.quietCard}>
              <View style={styles.quietIconWrap}>
                <ShieldCheckIcon />
              </View>
              <View style={styles.flex}>
                <Text style={styles.quietTitle}>All quiet at the gate</Text>
                <Text style={styles.quietSub}>
                  {lastResolved
                    ? `Last visitor ${getVisitorRequestStatusStyle(lastResolved.status).label.toLowerCase()} at ${formatTime(
                        lastResolved.decision_at ?? lastResolved.created_at,
                      )}`
                    : 'No visitor activity yet.'}
                </Text>
              </View>
            </View>
          )}

          <Pressable style={styles.actionCard} onPress={() => router.push('/(resident)/pre-approve')}>
            <View style={styles.actionIconWrap}>
              <PlusIcon />
            </View>
            <View style={styles.flex}>
              <Text style={styles.actionTitle}>Pre-approve a guest</Text>
              <Text style={styles.actionSub}>Skip the gate call</Text>
            </View>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={() => router.push('/(resident)/complaints')}>
            <View style={styles.actionIconWrap}>
              <MegaphoneIcon />
            </View>
            <View style={styles.flex}>
              <Text style={styles.actionTitle}>Raise a complaint</Text>
              <Text style={styles.actionSub}>Track it through to resolution</Text>
            </View>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={() => router.push('/(resident)/amenities')}>
            <View style={styles.actionIconWrap}>
              <CalendarIcon />
            </View>
            <View style={styles.flex}>
              <Text style={styles.actionTitle}>Book an amenity</Text>
              <Text style={styles.actionSub}>Clubhouse, pool, and more</Text>
            </View>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={() => router.push('/(resident)/dues')}>
            <View style={styles.actionIconWrap}>
              <RupeeIcon />
            </View>
            <View style={styles.flex}>
              <Text style={styles.actionTitle}>Maintenance dues</Text>
              <Text style={styles.actionSub}>{duesSubtitle}</Text>
            </View>
          </Pressable>

          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Recent visitors</Text>
            <Pressable onPress={() => router.push('/gate')}>
              <Text style={styles.viewAllLabel}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.listCard}>
            <AsyncState
              isLoading={requestsQuery.isLoading}
              isError={requestsQuery.isError}
              errorTitle="Recent visitors unavailable"
              errorMessage="We couldn’t retrieve your visitor history. Try again."
              onRetry={() => requestsQuery.refetch()}
              isEmpty={recent.length === 0}
              emptyMessage="No visitor activity for your flat yet."
            />
            {recent.map((request) => {
              const style = getVisitorRequestStatusStyle(request.status);
              return (
                <View key={request.id} style={styles.requestRow}>
                  <View style={[styles.requestAvatar, { backgroundColor: avatarColorForName(request.visitor?.name ?? '?') }]}>
                    <Text style={styles.requestInitial}>{getInitials(request.visitor?.name ?? '?')}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.requestName}>{request.visitor?.name ?? 'Visitor'}</Text>
                    <Text style={styles.requestSub}>{request.visitor ? titleCase(request.visitor.category) : '—'}</Text>
                  </View>
                  <View style={styles.requestMeta}>
                    <StatusPill label={style.label} color={style.color} backgroundColor={style.bg} />
                    <Text style={styles.requestTime}>{formatTime(request.decision_at ?? request.created_at)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
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
  flatChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  flatChipLabel: { fontSize: 12.5, fontWeight: '600', color: '#3E4A40' },
  body: { paddingHorizontal: 16, marginTop: -40 },

  banner: {
    position: 'absolute',
    top: 58,
    left: 12,
    right: 12,
    zIndex: 40,
    backgroundColor: 'rgba(16,38,27,0.96)',
    borderRadius: 20,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0A1911',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 34,
    elevation: 10,
  },
  bannerAvatar: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerAvatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 17, color: Colors.green500 },
  bannerOverline: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', color: Colors.gold },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: Colors.textOnDark, marginTop: 2 },
  bannerSub: { fontSize: 12, color: 'rgba(247,244,236,0.65)', marginTop: 1 },
  bannerDot: { width: 9, height: 9, borderRadius: 999, backgroundColor: Colors.gold },

  ringingCard: {
    backgroundColor: Colors.green500,
    borderRadius: Radius.cardLarge,
    padding: 18,
    shadowColor: '#0A1911',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    elevation: 6,
  },
  ringingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: Colors.gold },
  ringingOverline: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.gold },
  ringingMain: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  ringingAvatar: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ringingAvatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 21, color: Colors.green500 },
  ringingName: { fontSize: 17, fontWeight: '700', color: Colors.textOnDark },
  ringingSub: { fontSize: 13, color: 'rgba(247,244,236,0.65)', marginTop: 2, textTransform: 'capitalize' },
  respondButton: {
    marginTop: 16,
    backgroundColor: Colors.textOnDark,
    borderRadius: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  respondButtonLabel: { fontSize: 15, fontWeight: '700', color: Colors.green500 },

  quietCard: {
    backgroundColor: Colors.green500,
    borderRadius: Radius.cardLarge,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quietIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(231,163,60,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quietTitle: { fontSize: 15.5, fontWeight: '700', color: Colors.textOnDark },
  quietSub: { fontSize: 12.5, color: 'rgba(247,244,236,0.6)', marginTop: 2 },

  actionCard: {
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#E9F1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { fontSize: 14.5, fontWeight: '700' },
  actionSub: { fontSize: 12.5, color: Colors.textMuted, marginTop: 2 },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24 },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: 17 },
  viewAllLabel: { fontSize: 13, fontWeight: '700', color: Colors.success700 },
  listCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, marginTop: 12 },
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
  requestMeta: { alignItems: 'flex-end', gap: 4 },
  requestTime: { fontSize: 11, color: Colors.textFaint },
});

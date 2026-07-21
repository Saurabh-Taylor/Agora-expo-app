import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  avatarColorForName,
  formatDateTime,
  formatTime,
  getEffectiveVisitorRequestStatus,
  getInitials,
  getVisitorRequestStatusStyle,
  isGatePassActive,
  titleCase,
} from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { useFlatWithTower } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import {
  useActiveGatePasses,
  useFlatVisitorRequests,
  useVisitorRequestsRealtimeSync,
  type VisitorCategory,
} from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';

const FILTERS: { value: VisitorCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'GUEST', label: 'Guest' },
  { value: 'SERVICE', label: 'Service' },
];

export default function GateLogScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const profile = profileQuery.data;
  const flatQuery = useFlatWithTower(profile?.flat_id, profile?.society_id);
  const requestsQuery = useFlatVisitorRequests(profile?.flat_id, profile?.society_id, 50);
  const activePassesQuery = useActiveGatePasses(profile?.flat_id, profile?.society_id);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('ALL');
  const [expiryClock, setExpiryClock] = useState(() => Date.now());

  useVisitorRequestsRealtimeSync('flat_id', profile?.flat_id);

  useEffect(() => {
    const now = Date.now();
    const nextExpiry = (activePassesQuery.data ?? [])
      .map((request) => request.valid_until ? new Date(request.valid_until).getTime() : 0)
      .filter((expiry) => expiry > now)
      .sort((first, second) => first - second)[0];

    if (!nextExpiry) return;

    const timeout = setTimeout(
      () => setExpiryClock(Date.now()),
      Math.max(nextExpiry - now + 100, 100),
    );
    return () => clearTimeout(timeout);
  }, [activePassesQuery.data, expiryClock]);

  const filtered = useMemo(() => {
    const all = requestsQuery.data ?? [];
    return filter === 'ALL' ? all : all.filter((request) => request.visitor?.category === filter);
  }, [requestsQuery.data, filter]);
  const filterLabel = FILTERS.find((item) => item.value === filter)?.label.toLowerCase() ?? 'visitor';
  const activePasses = (activePassesQuery.data ?? []).filter((request) => isGatePassActive(request, expiryClock));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Gate log</Text>
      <Text style={styles.subtitle}>
        {flatQuery.data?.tower ? `${flatQuery.data.tower.code}-${flatQuery.data.number}` : (flatQuery.data?.number ?? '')}
        {flatQuery.data?.tower ? ` · ${flatQuery.data.tower.name}` : ''}
      </Text>

      {(activePassesQuery.isLoading || activePassesQuery.isError || activePasses.length > 0) && (
        <View style={styles.activeSection}>
          <Text style={styles.sectionTitle}>Active gate passes</Text>
          <View style={styles.activeList}>
            <AsyncState
              isLoading={activePassesQuery.isLoading}
              isError={activePassesQuery.isError}
              onRetry={() => activePassesQuery.refetch()}
            />
            {activePasses.map((request) => (
              <Pressable
                key={request.id}
                style={styles.passCard}
                onPress={() => router.push({ pathname: '/(resident)/gate-pass', params: { id: request.id } })}
                accessibilityRole="button"
                accessibilityLabel={`Open gate pass for ${request.visitor?.name ?? 'visitor'}`}>
                <View style={styles.passTopRow}>
                  <Text style={styles.passCode}>{request.gate_pass_code}</Text>
                  <Text style={styles.passLink}>View pass</Text>
                </View>
                <Text style={styles.passName}>{request.visitor?.name ?? 'Visitor'}</Text>
                <Text style={styles.passMeta}>
                  {request.visitor ? titleCase(request.visitor.category) : 'Visitor'}
                  {request.valid_until ? ` - Valid until ${formatDateTime(request.valid_until)}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.chipsRow}>
        {FILTERS.map((item) => {
          const active = filter === item.value;
          return (
            <Text
              key={item.value}
              onPress={() => setFilter(item.value)}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              {item.label}
            </Text>
          );
        })}
      </View>

      <View style={styles.listCard}>
        <AsyncState
          isLoading={requestsQuery.isLoading}
          isError={requestsQuery.isError}
          onRetry={() => requestsQuery.refetch()}
          isEmpty={filtered.length === 0}
          emptyTitle={filter === 'ALL' ? 'No gate activity' : `No ${filterLabel} visits`}
          emptyMessage={
            filter === 'ALL' ? 'Visitor activity for your flat will appear here.' : `No ${filterLabel} visits match this filter.`
          }
        />
        {filtered.map((request) => {
          const effectiveStatus = getEffectiveVisitorRequestStatus(request, expiryClock);
          const style = getVisitorRequestStatusStyle(effectiveStatus);
          return (
            <View key={request.id} style={styles.requestRow}>
              <View style={[styles.requestAvatar, { backgroundColor: avatarColorForName(request.visitor?.name ?? '?') }]}>
                <Text style={styles.requestInitial}>{getInitials(request.visitor?.name ?? '?')}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.requestName}>{request.visitor?.name ?? 'Visitor'}</Text>
                <Text style={styles.requestSub}>
                  {request.visitor ? titleCase(request.visitor.category) : '—'}
                  {request.is_pre_approved ? ' · Pre-approved' : ''}
                </Text>
              </View>
              <View style={styles.requestMeta}>
                <StatusPill label={style.label} color={style.color} backgroundColor={style.bg} />
                <Text style={styles.requestTime}>
                  {formatTime(request.exit_at ?? request.entry_at ?? request.decision_at ?? request.created_at)}
                </Text>
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
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 16, paddingBottom: 48 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 26 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  activeSection: { marginTop: 20 },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: 16, color: Colors.textPrimary },
  activeList: { gap: 10, marginTop: 10 },
  passCard: {
    backgroundColor: Colors.green500,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  passTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passCode: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, letterSpacing: 1.5, color: Colors.gold },
  passLink: { fontSize: 12.5, fontWeight: '700', color: Colors.textOnDark },
  passName: { fontSize: 14.5, fontWeight: '700', color: Colors.textOnDark, marginTop: 9 },
  passMeta: { fontSize: 11.5, color: 'rgba(247,244,236,0.68)', marginTop: 3 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
    borderWidth: 1.5,
  },
  chipActive: { backgroundColor: Colors.green500, color: Colors.textOnDark, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, color: '#3E4A40', borderColor: Colors.borderAlt },
  listCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, marginTop: 16 },
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

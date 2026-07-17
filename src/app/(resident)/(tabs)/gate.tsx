import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { avatarColorForName, formatTime, getInitials, getVisitorRequestStatusStyle, titleCase } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { useFlatWithTower } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useFlatVisitorRequests, useVisitorRequestsRealtimeSync, type VisitorCategory } from '@/features/visitors/api';
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
  const flatQuery = useFlatWithTower(profile?.flat_id);
  const requestsQuery = useFlatVisitorRequests(profile?.flat_id, 50);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('ALL');

  useVisitorRequestsRealtimeSync('flat_id', profile?.flat_id);

  const filtered = useMemo(() => {
    const all = requestsQuery.data ?? [];
    return filter === 'ALL' ? all : all.filter((request) => request.visitor?.category === filter);
  }, [requestsQuery.data, filter]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Gate log</Text>
      <Text style={styles.subtitle}>
        {flatQuery.data?.tower ? `${flatQuery.data.tower.code}-${flatQuery.data.number}` : (flatQuery.data?.number ?? '')}
        {flatQuery.data?.tower ? ` · ${flatQuery.data.tower.name}` : ''}
      </Text>

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
          emptyMessage="No visitor activity to show."
        />
        {filtered.map((request) => {
          const style = getVisitorRequestStatusStyle(request.status);
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

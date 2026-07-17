import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { avatarColorForName, formatTime, getInitials, getVisitorRequestStatusStyle, titleCase } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useSocietyVisitorRequests, useVisitorRequestsRealtimeSync, type VisitorRequestDetail } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type StatusFilter = 'ALL' | 'PENDING' | 'READY' | 'INSIDE' | 'DONE';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'READY', label: 'Ready' },
  { value: 'INSIDE', label: 'Inside' },
  { value: 'DONE', label: 'Done' },
];

function matchesFilter(request: VisitorRequestDetail, filter: StatusFilter) {
  switch (filter) {
    case 'PENDING':
      return request.status === 'PENDING';
    case 'READY':
      return request.status === 'APPROVED' && !request.entry_at;
    case 'INSIDE':
      return request.status === 'ENTERED' && !request.exit_at;
    case 'DONE':
      return request.status === 'EXITED' || request.status === 'REJECTED' || request.status === 'LEFT_AT_GATE';
    default:
      return true;
  }
}

function normalizeCode(value: string) {
  return value.replace(/\s+/g, '');
}

export default function MovementLogScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const requestsQuery = useSocietyVisitorRequests();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [code, setCode] = useState('');

  useVisitorRequestsRealtimeSync('society_id', profileQuery.data?.society_id);

  const requests = requestsQuery.data ?? [];
  const filtered = useMemo(
    () => (requestsQuery.data ?? []).filter((request) => matchesFilter(request, filter)),
    [requestsQuery.data, filter],
  );

  function handleVerifyCode() {
    const target = normalizeCode(code);
    if (!target) return;
    const match = requests.find(
      (request) => request.gate_pass_code && normalizeCode(request.gate_pass_code) === target && request.status === 'APPROVED' && !request.entry_at,
    );
    if (!match) {
      showToast('No matching gate pass found for that code.');
      return;
    }
    setCode('');
    router.push(`/(guard)/verify/${match.id}`);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Movement log</Text>
      <Text style={styles.subtitle}>{profileQuery.data?.society?.name ?? ''} · Live</Text>

      <Text style={styles.label}>VERIFY A GATE PASS</Text>
      <View style={styles.codeRow}>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="e.g. 482 917"
          placeholderTextColor={Colors.textFaint}
          style={styles.codeInput}
        />
        <Pressable style={styles.codeButton} onPress={handleVerifyCode}>
          <Text style={styles.codeButtonLabel}>Verify</Text>
        </Pressable>
      </View>

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
          const actionable = matchesFilter(request, 'READY') || matchesFilter(request, 'INSIDE');
          return (
            <Pressable
              key={request.id}
              style={styles.requestRow}
              onPress={() => router.push(`/(guard)/verify/${request.id}`)}>
              <View style={[styles.requestAvatar, { backgroundColor: avatarColorForName(request.visitor?.name ?? '?') }]}>
                <Text style={styles.requestInitial}>{getInitials(request.visitor?.name ?? '?')}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.requestName}>{request.visitor?.name ?? 'Visitor'}</Text>
                <Text style={styles.requestSub}>
                  {request.visitor ? titleCase(request.visitor.category) : '—'} ·{' '}
                  {request.flat?.tower ? `${request.flat.tower.code}-${request.flat.number}` : (request.flat?.number ?? '—')}
                </Text>
              </View>
              <View style={styles.requestMeta}>
                <StatusPill label={style.label} color={style.color} backgroundColor={style.bg} />
                <Text style={styles.requestTime}>
                  {formatTime(request.exit_at ?? request.entry_at ?? request.decision_at ?? request.created_at)}
                </Text>
                {actionable && <Text style={styles.actionHint}>Tap to verify</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 16, paddingBottom: 48 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 26 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  codeInput: {
    flex: 1,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  codeButton: {
    paddingHorizontal: 20,
    borderRadius: Radius.input,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeButtonLabel: { fontSize: 14, fontWeight: '700', color: Colors.textOnDark },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
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
  actionHint: { fontSize: 10, color: Colors.success700, fontWeight: '700' },
});

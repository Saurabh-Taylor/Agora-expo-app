import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  avatarColorForName,
  formatTime,
  getEffectiveVisitorRequestStatus,
  getErrorMessage,
  getInitials,
  getVisitorRequestStatusStyle,
  isVisitorReadyForEntry,
  titleCase,
} from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { GuardVisitorLogbook } from '@/components/guard-visitor-logbook';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import {
  useGuardLiveVisitorRequests,
  useVerifyGatePassCode,
  useVisitorRequestsRealtimeSync,
  type VisitorRequestDetail,
} from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type MovementMode = 'LIVE' | 'LOGBOOK';
type StatusFilter = 'ALL' | 'PENDING' | 'READY' | 'INSIDE';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'READY', label: 'Ready' },
  { value: 'INSIDE', label: 'Inside' },
];

function matchesFilter(request: VisitorRequestDetail, filter: StatusFilter) {
  const effectiveStatus = getEffectiveVisitorRequestStatus(request);

  switch (filter) {
    case 'PENDING':
      return effectiveStatus === 'PENDING';
    case 'READY':
      return isVisitorReadyForEntry(request);
    case 'INSIDE':
      return effectiveStatus === 'ENTERED' && !request.exit_at;
    default:
      return true;
  }
}

export default function MovementLogScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const requestsQuery = useGuardLiveVisitorRequests(societyId);
  const verifyGatePass = useVerifyGatePassCode(societyId);
  const [mode, setMode] = useState<MovementMode>('LIVE');
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [code, setCode] = useState('');

  useVisitorRequestsRealtimeSync('society_id', societyId);

  const filtered = useMemo(
    () => (requestsQuery.data ?? []).filter((request) => matchesFilter(request, filter)),
    [requestsQuery.data, filter],
  );

  async function handleVerifyCode() {
    if (!code.trim() || verifyGatePass.isPending) return;

    try {
      const request = await verifyGatePass.mutateAsync({ code });
      setCode('');
      router.push(`/(guard)/verify/${request.id}`);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not verify this gate pass'));
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Gate register</Text>
        <Text style={styles.subtitle}>{profileQuery.data?.society?.name ?? ''} · Guard access</Text>
        <View style={styles.modeSelector}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'LIVE' }}
            onPress={() => setMode('LIVE')}
            style={[styles.modeButton, mode === 'LIVE' && styles.modeButtonActive]}>
            <Text style={[styles.modeLabel, mode === 'LIVE' && styles.modeLabelActive]}>Live</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === 'LOGBOOK' }}
            onPress={() => setMode('LOGBOOK')}
            style={[styles.modeButton, mode === 'LOGBOOK' && styles.modeButtonActive]}>
            <Text style={[styles.modeLabel, mode === 'LOGBOOK' && styles.modeLabelActive]}>Logbook</Text>
          </Pressable>
        </View>
      </View>

      {mode === 'LOGBOOK' ? (
        <GuardVisitorLogbook societyId={societyId} />
      ) : (
        <ScrollView style={styles.liveScroll} contentContainerStyle={styles.liveContent}>
          <Text style={styles.label}>VERIFY A GATE PASS</Text>
          <View style={styles.codeRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="e.g. 482 917"
              placeholderTextColor={Colors.textFaint}
              style={styles.codeInput}
              keyboardType="number-pad"
              maxLength={7}
              accessibilityLabel="Six digit gate pass"
            />
            <Pressable
              style={[styles.codeButton, verifyGatePass.isPending && styles.codeButtonDisabled]}
              onPress={() => void handleVerifyCode()}
              disabled={verifyGatePass.isPending}
              accessibilityRole="button">
              {verifyGatePass.isPending ? (
                <ActivityIndicator size="small" color={Colors.textOnDark} />
              ) : (
                <Text style={styles.codeButtonLabel}>Verify</Text>
              )}
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            style={styles.scanQrButton}
            onPress={() => router.push('/(guard)/scan-pass' as Href)}>
            <Text style={styles.scanQrButtonLabel}>Scan QR gate pass</Text>
          </Pressable>

          <View style={styles.chipsRow}>
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(item.value)}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.listCard}>
            <AsyncState
              isLoading={requestsQuery.isLoading}
              isError={requestsQuery.isError}
              isRetrying={requestsQuery.isRefetching}
              onRetry={() => requestsQuery.refetch()}
              isEmpty={!requestsQuery.isLoading && !requestsQuery.isError && filtered.length === 0}
              emptyTitle="No active gate movement"
              emptyMessage="Pending approvals and visitors currently inside will appear here."
            />
            {filtered.map((request) => {
              const effectiveStatus = getEffectiveVisitorRequestStatus(request);
              const statusStyle = getVisitorRequestStatusStyle(effectiveStatus);
              const actionable = matchesFilter(request, 'READY') || matchesFilter(request, 'INSIDE');
              return (
                <Pressable
                  key={request.id}
                  style={styles.requestRow}
                  onPress={() => router.push(`/(guard)/verify/${request.id}`)}
                  accessibilityRole="button">
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
                    <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  header: {
    paddingTop: 62,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.adminCanvas,
  },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 26, color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  modeSelector: {
    marginTop: 17,
    padding: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
  },
  modeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: { backgroundColor: Colors.green500 },
  modeLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.textMuted },
  modeLabelActive: { color: Colors.textOnDark },
  liveScroll: { flex: 1 },
  liveContent: { paddingHorizontal: 16, paddingBottom: 48 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 10 },
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  codeInput: {
    flex: 1,
    minHeight: 48,
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
    minWidth: 90,
    paddingHorizontal: 20,
    borderRadius: Radius.input,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeButtonDisabled: { opacity: 0.65 },
  codeButtonLabel: { fontSize: 14, fontWeight: '700', color: Colors.textOnDark },
  scanQrButton: {
    minHeight: 48,
    marginTop: 10,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.green500,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanQrButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.green500 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  chip: {
    minHeight: 40,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabel: { fontSize: 13, fontWeight: '600', color: '#3E4A40' },
  chipLabelActive: { color: Colors.textOnDark },
  listCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, marginTop: 16, overflow: 'hidden' },
  requestRow: {
    minHeight: 74,
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
  requestName: { fontSize: 14.5, fontWeight: '600', color: Colors.textPrimary },
  requestSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  requestMeta: { alignItems: 'flex-end', gap: 4 },
  requestTime: { fontSize: 11, color: Colors.textFaint },
  actionHint: { fontSize: 10, color: Colors.success700, fontWeight: '700' },
});

import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  avatarColorForName,
  formatVehicleLabel,
  formatTime,
  getEffectiveVisitorRequestStatus,
  getInitials,
  getVisitorRequestStatusStyle,
  getErrorMessage,
  isVisitorReadyForEntry,
  titleCase,
} from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useMarkEntry, useMarkExit, useVisitorRequestDetail } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function VerifyVisitorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const detailQuery = useVisitorRequestDetail(id, profileQuery.data?.society_id);
  const markEntry = useMarkEntry();
  const markExit = useMarkExit();

  const request = detailQuery.data;

  const isLoading = profileQuery.isLoading || detailQuery.isLoading;
  const isError = profileQuery.isError || detailQuery.isError;

  if (isLoading || isError || !request) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => {
            profileQuery.refetch();
            detailQuery.refetch();
          }}
          isEmpty={!isLoading && !isError && !request}
          emptyMessage="Request not found."
        />
      </View>
    );
  }

  const effectiveStatus = getEffectiveVisitorRequestStatus(request);
  const style = getVisitorRequestStatusStyle(effectiveStatus);
  const canMarkEntry = isVisitorReadyForEntry(request);
  const canMarkExit = request.status === 'ENTERED' && !request.exit_at;

  async function handleMarkEntry() {
    try {
      await markEntry.mutateAsync({ id: id as string });
      showToast('Entry marked');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not mark visitor entry'));
      detailQuery.refetch();
    }
  }

  async function handleMarkExit() {
    try {
      await markExit.mutateAsync({ id: id as string });
      showToast('Exit marked');
      router.back();
    } catch {
      showToast('This request was already updated.');
      router.back();
    }
  }

  const flatLabel = request.flat?.tower ? `${request.flat.tower.code}-${request.flat.number}` : (request.flat?.number ?? '—');

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <BackArrowButton onPress={() => router.back()} />
      <View style={styles.profileRow}>
        <View style={[styles.avatar, { backgroundColor: avatarColorForName(request.visitor?.name ?? '?') }]}>
          <Text style={styles.avatarLabel}>{getInitials(request.visitor?.name ?? '?')}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{request.visitor?.name ?? 'Visitor'}</Text>
          <Text style={styles.unitLine}>
            {request.visitor ? titleCase(request.visitor.category) : '—'} · {flatLabel}
          </Text>
        </View>
      </View>

      <StatusPill label={style.label} color={style.color} backgroundColor={style.bg} />

      <View style={styles.card}>
        {!!formatVehicleLabel(request.vehicle_number, request.vehicle_type) && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Vehicle</Text>
            <Text style={styles.rowValue}>{formatVehicleLabel(request.vehicle_number, request.vehicle_type)}</Text>
          </View>
        )}
        {request.is_pre_approved && request.gate_pass_code && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Gate pass</Text>
            <Text style={styles.rowValue}>{request.gate_pass_code}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Requested</Text>
          <Text style={styles.rowValue}>{formatTime(request.created_at)}</Text>
        </View>
        {request.decision_at && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Decided</Text>
            <Text style={styles.rowValue}>{formatTime(request.decision_at)}</Text>
          </View>
        )}
        {request.entry_at && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Entered</Text>
            <Text style={styles.rowValue}>{formatTime(request.entry_at)}</Text>
          </View>
        )}
        {request.exit_at && (
          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>Exited</Text>
            <Text style={styles.rowValue}>{formatTime(request.exit_at)}</Text>
          </View>
        )}
      </View>

      {canMarkEntry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark visitor entry"
          style={styles.actionButton}
          onPress={handleMarkEntry}
          disabled={markEntry.isPending}>
          {markEntry.isPending && <ActivityIndicator size="small" color="#fff" />}
          <Text style={styles.actionLabel}>Mark Entry</Text>
        </Pressable>
      )}
      {canMarkExit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark visitor exit"
          style={[styles.actionButton, styles.exitButton]}
          onPress={handleMarkExit}
          disabled={markExit.isPending}>
          {markExit.isPending && <ActivityIndicator size="small" color="#fff" />}
          <Text style={styles.actionLabel}>Mark Exit</Text>
        </Pressable>
      )}
      {!canMarkEntry && !canMarkExit && (
        <Text style={styles.doneNote}>This request is {style.label.toLowerCase()} — no further action needed.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas, paddingHorizontal: 20 },
  flex: { flex: 1 },
  content: {},
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  avatar: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 24, color: Colors.green500 },
  name: { fontFamily: FontFamily.headingExtraBold, fontSize: 23 },
  unitLine: { fontSize: 13.5, color: Colors.textMuted, marginTop: 3, textTransform: 'capitalize' },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0ECE0' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: Colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '600' },
  actionButton: {
    marginTop: 20,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.success600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  exitButton: { backgroundColor: Colors.green500 },
  actionLabel: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
  doneNote: { marginTop: 20, fontSize: 13.5, color: Colors.textMuted, textAlign: 'center' },
});

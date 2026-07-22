import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { avatarColorForName, formatTime, formatVehicleLabel, getInitials, getVisitorRequestStatusStyle, titleCase } from '@/commonFunctions';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useDecideVisitorRequest, useVisitorRequestDetail } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

function DenyIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={Colors.danger300} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

function ApproveIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 12.5l5 5L19.5 7" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function VisitorRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const detailQuery = useVisitorRequestDetail(id, profileQuery.data?.society_id);
  const decide = useDecideVisitorRequest();
  const [pendingDecision, setPendingDecision] = useState<'APPROVED' | 'REJECTED' | 'LEFT_AT_GATE' | null>(null);

  const request = detailQuery.data;

  async function handleDecide(decision: 'APPROVED' | 'REJECTED' | 'LEFT_AT_GATE') {
    if (!request || decide.isPending) return;
    setPendingDecision(decision);
    try {
      await decide.mutateAsync({
        id: request.id,
        decision,
        raisedBy: request.raised_by,
        visitorName: request.visitor?.name ?? 'Visitor',
      });
      router.replace({
        pathname: '/(resident)/decision',
        params: {
          outcome: decision,
          visitorName: request.visitor?.name ?? 'Visitor',
          flatLabel: request.flat?.tower ? `${request.flat.tower.code}-${request.flat.number}` : (request.flat?.number ?? ''),
        },
      });
    } catch {
      showToast('This request was already handled.');
      router.replace('/(resident)/(tabs)');
    } finally {
      setPendingDecision(null);
    }
  }

  if (profileQuery.isLoading || detailQuery.isLoading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  if (profileQuery.isError || detailQuery.isError || !request) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.errorText}>This request isn&apos;t available.</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.errorButton}
          onPress={() => {
            profileQuery.refetch();
            detailQuery.refetch();
          }}>
          <Text style={styles.errorButtonLabel}>Try again</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.homeButton} onPress={() => router.replace('/(resident)/(tabs)')}>
          <Text style={styles.homeButtonLabel}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  if (request.status !== 'PENDING') {
    const style = getVisitorRequestStatusStyle(request.status);
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.resolvedTitle}>{request.visitor?.name ?? 'This visitor'}</Text>
        <Text style={[styles.resolvedStatus, { color: style.color }]}>Already {style.label.toLowerCase()}</Text>
        <Pressable style={styles.errorButton} onPress={() => router.replace('/(resident)/(tabs)')}>
          <Text style={styles.errorButtonLabel}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  const isDelivery = request.visitor?.category === 'DELIVERY';
  const avatarBg = avatarColorForName(request.visitor?.name ?? '?');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.topRow}>
        <View style={styles.topRowLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.topRowLabel}>Waiting at your gate</Text>
        </View>
        <Text style={styles.topRowTime}>{formatTime(request.created_at)}</Text>
      </View>

      <View style={styles.center}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={styles.avatarLabel}>{getInitials(request.visitor?.name ?? '?')}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagLabel}>{request.visitor ? titleCase(request.visitor.category) : '—'} · WAITING</Text>
        </View>
        <Text style={styles.name}>{request.visitor?.name ?? 'Visitor'}</Text>
        {request.flat && (
          <Text style={styles.detail}>
            For {request.flat.tower ? `${request.flat.tower.code}-${request.flat.number}` : request.flat.number}
          </Text>
        )}
        {!!formatVehicleLabel(request.vehicle_number, request.vehicle_type) && (
          <Text style={styles.detail}>Vehicle: {formatVehicleLabel(request.vehicle_number, request.vehicle_type)}</Text>
        )}
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Deny visitor entry"
          style={[styles.denyButton, decide.isPending && styles.buttonDisabled]}
          disabled={decide.isPending}
          onPress={() => handleDecide('REJECTED')}>
          {pendingDecision === 'REJECTED' ? <ActivityIndicator size="small" color={Colors.danger300} /> : <DenyIcon />}
          <Text style={styles.denyLabel}>Deny</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Approve visitor entry"
          style={[styles.approveButton, decide.isPending && styles.buttonDisabled]}
          disabled={decide.isPending}
          onPress={() => handleDecide('APPROVED')}>
          {pendingDecision === 'APPROVED' ? <ActivityIndicator size="small" color="#fff" /> : <ApproveIcon />}
          <Text style={styles.approveLabel}>Approve</Text>
        </Pressable>
      </View>

      {isDelivery && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask delivery visitor to leave the item at the gate"
          style={[styles.gateButton, decide.isPending && styles.buttonDisabled]}
          disabled={decide.isPending}
          onPress={() => handleDecide('LEFT_AT_GATE')}>
          <Text style={styles.gateButtonLabel}>Ask to leave at the gate</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.green600, paddingHorizontal: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: Colors.gold },
  topRowLabel: { fontSize: 13, color: 'rgba(247,244,236,0.6)' },
  topRowTime: { fontSize: 13, color: 'rgba(247,244,236,0.6)' },
  avatar: { width: 104, height: 104, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: FontFamily.headingExtraBold, fontSize: 42, color: Colors.green500 },
  tag: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: 'rgba(231,163,60,0.4)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  tagLabel: { fontSize: 10.5, letterSpacing: 1.5, fontWeight: '700', color: Colors.gold },
  name: { fontFamily: FontFamily.headingExtraBold, fontSize: 27, color: Colors.textOnDark, marginTop: 12 },
  detail: { fontSize: 14, color: 'rgba(247,244,236,0.65)', marginTop: 5 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 26 },
  denyButton: {
    flex: 1,
    height: 58,
    borderRadius: Radius.card - 2,
    backgroundColor: 'rgba(247,244,236,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(247,244,236,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  denyLabel: { fontSize: 16, fontWeight: '700', color: Colors.danger300 },
  approveButton: {
    flex: 1.35,
    height: 58,
    borderRadius: Radius.card - 2,
    backgroundColor: Colors.success600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.success600,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 26,
    elevation: 4,
  },
  approveLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  buttonDisabled: { opacity: 0.6 },
  gateButton: {
    marginTop: 12,
    height: 50,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: 'rgba(231,163,60,0.5)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateButtonLabel: { fontSize: 14.5, fontWeight: '600', color: Colors.gold },
  errorText: { fontSize: 14.5, color: Colors.textOnDark, textAlign: 'center' },
  errorButton: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14, backgroundColor: Colors.gold },
  errorButtonLabel: { fontSize: 14, fontWeight: '700', color: Colors.green500 },
  homeButton: { minHeight: 44, marginTop: 6, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  homeButtonLabel: { fontSize: 14, fontWeight: '700', color: Colors.textOnDark },
  resolvedTitle: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textOnDark },
  resolvedStatus: { fontSize: 15, fontWeight: '700', marginTop: 8 },
});

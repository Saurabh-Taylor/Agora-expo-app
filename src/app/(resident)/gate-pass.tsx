import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { formatDateTime, formatVehicleLabel, isGatePassActive, titleCase } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useRevokePreApproval, useVisitorRequestDetail } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

function CheckIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 12.5l5 5L19.5 7" stroke={Colors.success400} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CopyIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x={8} y={8} width={12} height={12} rx={2.5} stroke={Colors.green500} strokeWidth={2} />
      <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke={Colors.green500} strokeWidth={2} />
    </Svg>
  );
}

function RevokeIcon() {
  return (
    <Svg width={27} height={27} viewBox="0 0 24 24" fill="none">
      <Path
        d="m7 7 10 10M17 7 7 17"
        stroke={Colors.gold}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function GatePassScreen() {
  const params = useLocalSearchParams<{ id?: string; created?: string }>();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const detailQuery = useVisitorRequestDetail(params.id, profileQuery.data?.society_id);
  const revokePreApproval = useRevokePreApproval();
  const request = detailQuery.data;
  const isLoading = profileQuery.isLoading || detailQuery.isLoading;
  const isError = profileQuery.isError || detailQuery.isError;
  const [isRevokeDialogVisible, setIsRevokeDialogVisible] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  if (isLoading || isError || !request) {
    return (
      <View style={[styles.stateRoot, { paddingTop: insets.top + 22 }]}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => {
            profileQuery.refetch();
            detailQuery.refetch();
          }}
          isEmpty={!isLoading && !isError && !request}
          emptyTitle="Gate pass unavailable"
          emptyMessage="This gate pass could not be found."
        />
      </View>
    );
  }

  if (!isGatePassActive(request) || !request.gate_pass_code || !request.valid_until) {
    return (
      <View style={[styles.stateRoot, { paddingTop: insets.top + 22 }]}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={false}
          isError={false}
          isEmpty
          emptyTitle="Gate pass no longer active"
          emptyMessage="It has expired, been revoked, or already been used. The visit remains in your Gate log."
        />
      </View>
    );
  }

  const requestId = request.id;
  const visitorName = request.visitor?.name ?? 'Visitor';
  const category = request.visitor?.category ? titleCase(request.visitor.category) : '';
  const vehicle = formatVehicleLabel(request.vehicle_number, request.vehicle_type);
  const passMessage = `Agora gate pass ${request.gate_pass_code} for ${visitorName} at your society. Valid until ${formatDateTime(
    request.valid_until,
  )}. Share this code with the guard at the gate.`;

  async function handleCopy() {
    await Clipboard.setStringAsync(passMessage);
    showToast('Pass copied - share it with your visitor');
  }

  async function handleShare() {
    await Share.share({ message: passMessage });
  }

  async function revokePass() {
    try {
      await revokePreApproval.mutateAsync({ id: requestId });
      setIsRevokeDialogVisible(false);
      showToast('Gate pass revoked');
      router.replace('/(resident)/(tabs)/gate');
    } catch (error) {
      setRevokeError(error instanceof Error ? error.message : 'This gate pass is no longer active');
      detailQuery.refetch();
    }
  }

  function openRevokeDialog() {
    setRevokeError(null);
    setIsRevokeDialogVisible(true);
  }

  function closeRevokeDialog() {
    if (revokePreApproval.isPending) return;
    setRevokeError(null);
    setIsRevokeDialogVisible(false);
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 20 },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.spacerTop} />
      <View style={styles.iconWrap}>
        <CheckIcon />
      </View>
      <Text style={styles.title}>{params.created === 'true' ? 'Gate pass created' : 'Active gate pass'}</Text>
      <Text style={styles.sub}>Share this code with your visitor for verification at the gate</Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeOverline}>AGORA GATE PASS</Text>
        <Text style={styles.code}>{request.gate_pass_code}</Text>
        <Text style={styles.codeName}>{visitorName}</Text>
        <Text style={styles.codeMeta}>{[category, vehicle].filter(Boolean).join(' / ')}</Text>
        <View style={styles.validityDivider} />
        <Text style={styles.validityLabel}>VALID UNTIL</Text>
        <Text style={styles.validityValue}>{formatDateTime(request.valid_until)}</Text>
      </View>

      <View style={styles.spacerBottom} />

      <Pressable
        style={styles.copyButton}
        onPress={() => void handleCopy()}
        accessibilityRole="button"
        accessibilityLabel="Copy gate pass">
        <CopyIcon />
        <Text style={styles.copyButtonLabel}>Copy code</Text>
      </Pressable>
      <Pressable
        style={styles.shareButton}
        onPress={() => void handleShare()}
        accessibilityRole="button"
        accessibilityLabel="Share gate pass">
        <Text style={styles.shareButtonLabel}>Share pass</Text>
      </Pressable>
      <Pressable
        style={styles.revokeButton}
        onPress={openRevokeDialog}
        disabled={revokePreApproval.isPending}
        accessibilityRole="button"
        accessibilityLabel="Revoke gate pass">
        <Text style={styles.revokeButtonLabel}>{revokePreApproval.isPending ? 'Revoking...' : 'Revoke pass'}</Text>
      </Pressable>
      <Pressable style={styles.doneButton} onPress={() => router.replace('/(resident)/(tabs)/gate')}>
        <Text style={styles.doneButtonLabel}>Done</Text>
      </Pressable>

      <ConfirmationDialog
        visible={isRevokeDialogVisible}
        icon={<RevokeIcon />}
        title="Revoke this gate pass?"
        message={`${visitorName} will no longer be able to use this code at the gate.`}
        confirmLabel="Revoke pass"
        cancelLabel="Keep pass"
        isPending={revokePreApproval.isPending}
        errorMessage={revokeError}
        onCancel={closeRevokeDialog}
        onConfirm={() => void revokePass()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stateRoot: { flex: 1, backgroundColor: Colors.canvas, paddingHorizontal: 20 },
  root: { flex: 1, backgroundColor: Colors.green600 },
  content: { flexGrow: 1, paddingHorizontal: 24, alignItems: 'center' },
  spacerTop: { flex: 0.35 },
  spacerBottom: { flex: 1 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: 'rgba(31,157,92,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 23, color: Colors.textOnDark, marginTop: 18 },
  sub: { maxWidth: 310, fontSize: 13.5, color: 'rgba(247,244,236,0.65)', marginTop: 6, textAlign: 'center' },
  codeCard: {
    width: '100%',
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(231,163,60,0.55)',
    borderStyle: 'dashed',
    borderRadius: Radius.cardLarge - 2,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(231,163,60,0.06)',
    alignItems: 'center',
  },
  codeOverline: { fontSize: 10.5, letterSpacing: 2, fontWeight: '700', color: Colors.gold },
  code: { fontFamily: FontFamily.headingExtraBold, fontSize: 40, letterSpacing: 2, color: Colors.textOnDark, marginTop: 8 },
  codeName: { fontSize: 15, fontWeight: '600', color: Colors.textOnDark, marginTop: 10 },
  codeMeta: { fontSize: 13, color: 'rgba(247,244,236,0.65)', marginTop: 3 },
  validityDivider: { width: '70%', height: 1, backgroundColor: 'rgba(247,244,236,0.15)', marginVertical: 13 },
  validityLabel: { fontSize: 9.5, letterSpacing: 1.5, fontWeight: '700', color: Colors.gold },
  validityValue: { fontSize: 12.5, color: Colors.textOnDark, marginTop: 4 },
  copyButton: {
    width: '100%',
    height: 52,
    borderRadius: Radius.card - 2,
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  copyButtonLabel: { fontSize: 15, fontWeight: '700', color: Colors.green500 },
  shareButton: {
    width: '100%',
    height: 48,
    marginTop: 9,
    borderRadius: Radius.card - 2,
    borderWidth: 1,
    borderColor: 'rgba(247,244,236,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.textOnDark },
  revokeButton: { minHeight: 42, marginTop: 5, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  revokeButtonLabel: { fontSize: 13.5, fontWeight: '600', color: '#F2B8B0' },
  doneButton: { width: '100%', height: 42, alignItems: 'center', justifyContent: 'center' },
  doneButtonLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(247,244,236,0.7)' },
});

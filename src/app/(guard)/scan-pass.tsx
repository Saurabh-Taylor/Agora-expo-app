import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { extractGatePassCodeFromQr, getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useVerifyGatePassCode } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function ScanGatePassScreen() {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const verifyGatePass = useVerifyGatePassCode(societyId);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setScanError(null);
      return () => setScanned(true);
    }, []),
  );

  async function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (scanned || verifyGatePass.isPending) return;

    setScanned(true);
    const code = extractGatePassCodeFromQr(result.data);
    if (!code) {
      setScanError('This is not a valid Agora gate-pass QR.');
      return;
    }

    try {
      const request = await verifyGatePass.mutateAsync({ code });
      router.replace(`/(guard)/verify/${request.id}`);
    } catch (error) {
      setScanError(getErrorMessage(error, 'Could not verify this gate pass'));
    }
  }

  function scanAgain() {
    setScanError(null);
    setScanned(false);
  }

  async function askForCameraPermission() {
    try {
      await requestPermission();
    } catch {
      showToast('Could not request camera permission');
    }
  }

  if (!permission) {
    return <View style={styles.loadingRoot}><ActivityIndicator color={Colors.green500} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionRoot, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}>
        <BackArrowButton onPress={() => router.back()} />
        <View style={styles.permissionContent}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionText}>
            Agora uses the camera only to scan visitor gate-pass QR codes. Manual six-digit verification remains available.
          </Text>
          <Pressable
            accessibilityRole='button'
            style={styles.permissionButton}
            onPress={() => void (permission.canAskAgain ? askForCameraPermission() : Linking.openSettings())}>
            <Text style={styles.permissionButtonLabel}>
              {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (profileQuery.isLoading || profileQuery.isError || !societyId) {
    return (
      <View style={[styles.permissionRoot, { paddingTop: insets.top + 18 }]}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={profileQuery.isLoading}
          isError={profileQuery.isError}
          onRetry={() => profileQuery.refetch()}
          isEmpty={!profileQuery.isLoading && !profileQuery.isError && !societyId}
          emptyTitle='Guard access unavailable'
          emptyMessage='Your society scope could not be verified.'
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing='back'
        active={!scanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : (result) => void handleBarcodeScanned(result)}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Scan gate pass</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View pointerEvents='none' style={styles.scanArea}>
        <View style={styles.scanFrame} />
      </View>

      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 20 }]}>
        {verifyGatePass.isPending ? (
          <>
            <ActivityIndicator color={Colors.green500} />
            <Text style={styles.bottomTitle}>Verifying with Agora...</Text>
            <Text style={styles.bottomText}>Checking society, status, validity, and entry rules.</Text>
          </>
        ) : scanError ? (
          <>
            <Text style={styles.errorTitle}>Pass not accepted</Text>
            <Text style={styles.bottomText}>{scanError}</Text>
            <Pressable accessibilityRole='button' style={styles.scanAgainButton} onPress={scanAgain}>
              <Text style={styles.scanAgainLabel}>Scan another QR</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.bottomTitle}>Align the QR inside the frame</Text>
            <Text style={styles.bottomText}>The pass will be rechecked against live gate records before any entry action.</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.green900 },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.adminCanvas },
  permissionRoot: { flex: 1, paddingHorizontal: 20, backgroundColor: Colors.adminCanvas },
  permissionContent: { flex: 1, justifyContent: 'center', paddingBottom: 80 },
  permissionTitle: { fontFamily: FontFamily.headingExtraBold, fontSize: 25, color: Colors.textPrimary, textAlign: 'center' },
  permissionText: { marginTop: 12, fontSize: 14, lineHeight: 21, color: Colors.textMuted, textAlign: 'center' },
  permissionButton: {
    minHeight: 52,
    marginTop: 24,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.textOnDark },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9,24,16,0.72)',
  },
  title: { fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textOnDark },
  headerSpacer: { width: 38 },
  scanArea: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  scanFrame: {
    width: 252,
    height: 252,
    borderWidth: 3,
    borderRadius: 24,
    borderColor: Colors.gold,
    backgroundColor: 'transparent',
  },
  bottomCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    minHeight: 142,
    paddingTop: 20,
    paddingHorizontal: 20,
    borderRadius: Radius.cardLarge,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTitle: { marginTop: 8, fontFamily: FontFamily.headingBold, fontSize: 17, color: Colors.textPrimary, textAlign: 'center' },
  errorTitle: { fontFamily: FontFamily.headingBold, fontSize: 17, color: Colors.danger700, textAlign: 'center' },
  bottomText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: Colors.textMuted, textAlign: 'center' },
  scanAgainButton: {
    minHeight: 44,
    marginTop: 14,
    paddingHorizontal: 22,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanAgainLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.textOnDark },
});

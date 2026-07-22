import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime, formatVehicleLabel, isGatePassActive, titleCase } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { ResidentVisitorRegister } from '@/components/resident-visitor-register';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { useFlatWithTower } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useActiveGatePasses, useVisitorRequestsRealtimeSync } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';

export default function GateLogScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const profile = profileQuery.data;
  const flatQuery = useFlatWithTower(profile?.flat_id, profile?.society_id);
  const activePassesQuery = useActiveGatePasses(profile?.flat_id, profile?.society_id);
  const [expiryClock, setExpiryClock] = useState(() => Date.now());

  useVisitorRequestsRealtimeSync('flat_id', profile?.flat_id);

  useEffect(() => {
    const now = Date.now();
    const nextExpiry = (activePassesQuery.data ?? [])
      .map((request) => (request.valid_until ? new Date(request.valid_until).getTime() : 0))
      .filter((expiry) => expiry > now)
      .sort((first, second) => first - second)[0];
    if (!nextExpiry) return;
    const timeout = setTimeout(() => setExpiryClock(Date.now()), Math.max(nextExpiry - now + 100, 100));
    return () => clearTimeout(timeout);
  }, [activePassesQuery.data, expiryClock]);

  if (profileQuery.isLoading || flatQuery.isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator color={Colors.success700} />
        <Text style={styles.stateText}>Opening your gate...</Text>
      </View>
    );
  }

  if (profileQuery.isError || flatQuery.isError || !profile?.flat_id) {
    return (
      <View style={styles.centerState}>
        <AsyncState
          isLoading={false}
          isError
          onRetry={() => {
            profileQuery.refetch();
            flatQuery.refetch();
          }}
          errorTitle="Could not open your gate"
          errorMessage="Your resident profile or flat assignment could not be loaded."
        />
      </View>
    );
  }

  const activePasses = (activePassesQuery.data ?? []).filter((request) =>
    isGatePassActive(request, expiryClock),
  );
  const flatLabel = flatQuery.data?.tower
    ? `${flatQuery.data.tower.code}-${flatQuery.data.number}`
    : (flatQuery.data?.number ?? '');
  const towerLabel = flatQuery.data?.tower?.name ?? 'Your society';

  const header = (
    <>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>My gate</Text>
          <Text style={styles.subtitle}>{[flatLabel, towerLabel].filter(Boolean).join(' / ')}</Text>
        </View>
        <Pressable onPress={() => router.push('/(resident)/pre-approve')} style={styles.preApproveButton}>
          <Text style={styles.preApproveIcon}>+</Text>
          <Text style={styles.preApproveText}>Guest pass</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroOverline}>PRIVATE FLAT RECORD</Text>
        <Text style={styles.heroTitle}>Every arrival, entry and exit in one place.</Text>
        <Text style={styles.heroBody}>
          Choose a recent day below, or filter by month, custom dates, visitor type and visit state.
        </Text>
      </View>

      {(activePassesQuery.isLoading || activePassesQuery.isError || activePasses.length > 0) && (
        <View style={styles.activeSection}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Active gate passes</Text>
            {!!activePasses.length && <Text style={styles.sectionCount}>{activePasses.length}</Text>}
          </View>
          <AsyncState
            isLoading={activePassesQuery.isLoading}
            isError={activePassesQuery.isError}
            isRetrying={activePassesQuery.isRefetching}
            loadingMessage="Checking active passes..."
            onRetry={() => activePassesQuery.refetch()}
          />
          <View style={styles.activeList}>
            {activePasses.map((request) => (
              <Pressable
                key={request.id}
                style={styles.passCard}
                onPress={() => router.push({ pathname: '/(resident)/gate-pass', params: { id: request.id } })}>
                <View style={styles.passTopRow}>
                  <View>
                    <Text style={styles.passOverline}>ACTIVE PASS</Text>
                    <Text style={styles.passCode}>{request.gate_pass_code}</Text>
                  </View>
                  <Text style={styles.passLink}>Open</Text>
                </View>
                <Text style={styles.passName}>{request.visitor?.name ?? 'Visitor'}</Text>
                <Text style={styles.passMeta}>
                  {request.visitor ? titleCase(request.visitor.category) : 'Visitor'}
                  {formatVehicleLabel(request.vehicle_number, request.vehicle_type)
                    ? ` / ${formatVehicleLabel(request.vehicle_number, request.vehicle_type)}`
                    : ''}
                </Text>
                {request.valid_until && (
                  <Text style={styles.passValidity}>Valid until {formatDateTime(request.valid_until)}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </>
  );

  return <ResidentVisitorRegister societyId={profile?.society_id} flatId={profile?.flat_id} header={header} />;
}

const styles = StyleSheet.create({
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.canvas },
  stateText: { fontSize: 13, color: Colors.textMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleCopy: { flex: 1 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 28, color: Colors.textPrimary },
  subtitle: { marginTop: 3, fontSize: 12.5, color: Colors.textMuted },
  preApproveButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 15,
    paddingHorizontal: 13,
    backgroundColor: Colors.green500,
  },
  preApproveIcon: { marginTop: -2, fontSize: 22, lineHeight: 22, color: Colors.textOnDark },
  preApproveText: { fontSize: 12.5, fontWeight: '700', color: Colors.textOnDark },
  hero: { marginTop: 20, borderRadius: 22, padding: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  heroOverline: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: Colors.success700 },
  heroTitle: { marginTop: 8, maxWidth: 300, fontFamily: FontFamily.headingBold, fontSize: 21, lineHeight: 26, color: Colors.textPrimary },
  heroBody: { marginTop: 8, fontSize: 12.5, lineHeight: 18, color: Colors.textMuted },
  activeSection: { marginTop: 22 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: 16, color: Colors.textPrimary },
  sectionCount: { fontSize: 12, fontWeight: '700', color: Colors.success700 },
  activeList: { gap: 10, marginTop: 10 },
  passCard: { borderRadius: 19, padding: 16, backgroundColor: Colors.green500 },
  passTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  passOverline: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4, color: 'rgba(247,244,236,0.55)' },
  passCode: { marginTop: 2, fontFamily: FontFamily.headingExtraBold, fontSize: 23, letterSpacing: 1.5, color: Colors.gold },
  passLink: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, overflow: 'hidden', fontSize: 11.5, fontWeight: '700', color: Colors.textOnDark, backgroundColor: 'rgba(255,255,255,0.1)' },
  passName: { marginTop: 12, fontSize: 15, fontWeight: '700', color: Colors.textOnDark },
  passMeta: { marginTop: 3, fontSize: 11.5, color: 'rgba(247,244,236,0.68)' },
  passValidity: { marginTop: 9, fontSize: 10.5, color: 'rgba(247,244,236,0.52)' },
});

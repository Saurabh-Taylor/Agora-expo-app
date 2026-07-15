import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { getVerificationStatusStyle } from '@/commonFunctions';
import { useTowerStats } from '@/features/towers/api';
import { useResidents } from '@/features/residents/api';

export default function TowerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const towerStatsQuery = useTowerStats();
  const residentsQuery = useResidents();

  const tower = towerStatsQuery.data?.find((t) => t.id === id);
  const towerResidents = useMemo(
    () => (residentsQuery.data ?? []).filter((r) => r.flat?.tower_id === id),
    [residentsQuery.data, id],
  );

  const isLoading = towerStatsQuery.isLoading || residentsQuery.isLoading;
  const isError = towerStatsQuery.isError || residentsQuery.isError;

  if (isLoading || isError || !tower) {
    return (
      <View style={styles.root}>
        <AsyncState isLoading={isLoading} isError={isError} isEmpty={!tower} emptyMessage="Tower not found." />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <View style={styles.flex}>
          <Text style={styles.title}>{tower.name}</Text>
          <Text style={styles.subtitle}>{tower.floors} floors</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{tower.totalFlats}</Text>
          <Text style={styles.statLabel}>Total flats</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: Colors.success600 }]}>{tower.occupiedFlats}</Text>
          <Text style={styles.statLabel}>Occupied</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: '#9A6B14' }]}>{tower.vacantFlats}</Text>
          <Text style={styles.statLabel}>Vacant</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{tower.owners}</Text>
          <Text style={styles.statLabel}>Owners</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{tower.tenants}</Text>
          <Text style={styles.statLabel}>Tenants</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, { color: Colors.danger700 }]}>0</Text>
          <Text style={styles.statLabel}>Open issues</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>RESIDENTS · {towerResidents.length}</Text>
      <FlatList
        data={towerResidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<AsyncState isLoading={false} isError={false} isEmpty emptyMessage="No residents recorded in this tower yet." />}
        renderItem={({ item }) => {
          const status = getVerificationStatusStyle(item.is_verified);
          return (
            <Pressable style={styles.residentRow} onPress={() => router.push(`/(admin)/resident/${item.id}`)}>
              <View style={styles.unitCodeWrap}>
                <Text style={styles.unitCode}>{tower.code}-{item.flat?.number}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.residentName}>
                  {tower.code}-{item.flat?.number} <Text style={styles.residentNameSub}>({item.full_name})</Text>
                </Text>
                <Text style={styles.subtitle}>{item.occupancy_type ?? '—'}</Text>
              </View>
              <StatusPill label={status.label} color={status.color} backgroundColor={status.bg} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas, paddingTop: 66, paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 20 },
  statCell: { width: '31%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 14, alignItems: 'center' },
  statValue: { fontFamily: FontFamily.headingExtraBold, fontSize: 21 },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 3 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 24 },
  listContent: { gap: 10, marginTop: 10, paddingBottom: 40 },
  residentRow: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 4,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unitCodeWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E9F1EC', alignItems: 'center', justifyContent: 'center' },
  unitCode: { fontFamily: FontFamily.headingExtraBold, fontSize: 12.5, color: Colors.success700 },
  residentName: { fontSize: 14.5, fontWeight: '700' },
  residentNameSub: { fontWeight: '500', color: Colors.textMuted, fontSize: 13 },
});

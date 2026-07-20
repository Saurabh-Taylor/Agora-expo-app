import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AsyncState } from '@/components/async-state';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { avatarColorForName, getInitials, getVerificationStatusStyle } from '@/commonFunctions';
import { useFlats } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useTowerStats } from '@/features/towers/api';
import { useResidents } from '@/features/residents/api';
import { useAuthStore } from '@/stores/auth-store';

const RING_RADIUS = 15.5;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type CommunityTab = 'Towers' | 'Flats' | 'Residents';

function TowerIcon() {
  return (
    <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h12v18H6V3z" stroke={Colors.textPrimary} strokeWidth={1.6} />
      <Path d="M9 6.5h1.4M13.6 6.5H15M9 9.5h1.4M13.6 9.5H15M9 12.5h1.4M13.6 12.5H15M9 15.5h1.4M13.6 15.5H15" stroke={Colors.textPrimary} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M3 21h18" stroke={Colors.textPrimary} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 5l7 7-7 7" stroke={Colors.textFaint} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function OccupancyRing({ pct }: { pct: number }) {
  const offset = RING_CIRCUMFERENCE * (1 - pct / 100);
  return (
    <View style={styles.ringWrap}>
      <Svg width={50} height={50} viewBox="0 0 36 36" style={styles.ringSvg}>
        <Circle cx={18} cy={18} r={RING_RADIUS} fill="none" stroke={Colors.border} strokeWidth={3} />
        <Circle
          cx={18}
          cy={18}
          r={RING_RADIUS}
          fill="none"
          stroke={Colors.success700}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </Svg>
      <Text style={styles.ringLabel}>{pct}%</Text>
    </View>
  );
}

export default function CommunityScreen() {
  const [activeTab, setActiveTab] = useState<CommunityTab>('Towers');
  const [search, setSearch] = useState('');
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const towerStatsQuery = useTowerStats(societyId);
  const flatsQuery = useFlats(societyId);
  const residentsQuery = useResidents(societyId);

  const query = search.trim().toLowerCase();

  const filteredTowers = useMemo(
    () => (towerStatsQuery.data ?? []).filter((t) => !query || t.name.toLowerCase().includes(query)),
    [towerStatsQuery.data, query],
  );
  const filteredFlats = useMemo(
    () =>
      (flatsQuery.data ?? [])
        .map((flat) => ({
          ...flat,
          tower: towerStatsQuery.data?.find((tower) => tower.id === flat.tower_id),
          resident: residentsQuery.data?.find((resident) => resident.flat_id === flat.id),
        }))
        .filter(
          (flat) =>
            !query ||
            flat.number.toLowerCase().includes(query) ||
            flat.tower?.name.toLowerCase().includes(query) ||
            flat.tower?.code.toLowerCase().includes(query),
        ),
    [flatsQuery.data, residentsQuery.data, towerStatsQuery.data, query],
  );
  const filteredResidents = useMemo(
    () => (residentsQuery.data ?? []).filter((r) => !query || r.full_name.toLowerCase().includes(query)),
    [residentsQuery.data, query],
  );

  const searchPlaceholder =
    activeTab === 'Towers' ? 'Search towers' : activeTab === 'Flats' ? 'Search flats by tower' : 'Search residents';

  function addAction() {
    if (activeTab === 'Residents') {
      router.push('/(admin)/add-resident');
    } else if (activeTab === 'Flats') {
      router.push('/(admin)/add-flat' as Href);
    } else {
      router.push('/(admin)/add-tower');
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <Text style={styles.headerSubtitle}>Manage buildings, flats & residents</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.segmented}>
          {(['Towers', 'Flats', 'Residents'] as const).map((tab) => (
            <Pressable key={tab} style={styles.segment} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.segmentLabel, activeTab === tab && styles.segmentLabelActive]}>{tab}</Text>
              {activeTab === tab && <View style={styles.segmentIndicator} />}
            </Pressable>
          ))}
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={Colors.textFaint}
            style={styles.searchInput}
          />
        </View>

        {activeTab === 'Towers' && (
          <FlatList
            data={filteredTowers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <AsyncState
                isLoading={towerStatsQuery.isLoading}
                isError={towerStatsQuery.isError}
                onRetry={() => towerStatsQuery.refetch()}
                isEmpty={filteredTowers.length === 0}
                emptyMessage="No towers match your search."
              />
            }
            renderItem={({ item }) => {
              const pct = item.totalFlats > 0 ? Math.round((item.occupiedFlats / item.totalFlats) * 100) : 0;
              return (
                <Pressable style={styles.towerRow} onPress={() => router.push(`/(admin)/tower/${item.id}`)}>
                  <TowerIcon />
                  <View style={styles.flex}>
                    <Text style={styles.towerName}>{item.name}</Text>
                    <Text style={styles.towerSub}>
                      {item.totalFlats} Flats · {item.occupiedFlats} Occupied
                    </Text>
                  </View>
                  <OccupancyRing pct={pct} />
                  <ChevronRightIcon />
                </Pressable>
              );
            }}
          />
        )}

        {activeTab === 'Flats' && (
          <FlatList
            data={filteredFlats}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <AsyncState
                isLoading={flatsQuery.isLoading || towerStatsQuery.isLoading || residentsQuery.isLoading}
                isError={flatsQuery.isError || towerStatsQuery.isError || residentsQuery.isError}
                onRetry={() => {
                  flatsQuery.refetch();
                  towerStatsQuery.refetch();
                  residentsQuery.refetch();
                }}
                isEmpty={filteredFlats.length === 0}
                emptyMessage={query ? 'No flats match your search.' : 'No flats have been created yet.'}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.flatRow}
                onPress={() =>
                  router.push({ pathname: '/(admin)/flat/[id]', params: { id: item.id } } as unknown as Href)
                }>
                <View style={styles.flatCode}>
                  <Text style={styles.flatCodeLabel}>{item.tower?.code ?? '?'}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.towerName}>{item.tower?.code}-{item.number}</Text>
                  <Text style={styles.towerSub}>{item.tower?.name ?? 'Unknown tower'} - Floor {item.floor}</Text>
                </View>
                <View style={styles.flatStatsCol}>
                  <Text style={item.resident ? styles.flatOccupied : styles.flatVacant}>
                    {item.resident ? 'Occupied' : 'Vacant'}
                  </Text>
                  <Text style={styles.flatResidentName} numberOfLines={1}>
                    {item.resident?.full_name ?? 'Ready to assign'}
                  </Text>
                </View>
                <ChevronRightIcon />
              </Pressable>
            )}
          />
        )}

        {activeTab === 'Residents' && (
          <FlatList
            data={filteredResidents}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <AsyncState
                isLoading={residentsQuery.isLoading}
                isError={residentsQuery.isError}
                onRetry={() => residentsQuery.refetch()}
                isEmpty={filteredResidents.length === 0}
                emptyMessage="No residents match your search."
              />
            }
            renderItem={({ item }) => {
              const status = item.is_active
                ? getVerificationStatusStyle(item.is_verified)
                : { label: 'Inactive', color: Colors.danger700, bg: '#F9E4E1' };
              return (
                <Pressable style={styles.residentRow} onPress={() => router.push(`/(admin)/resident/${item.id}`)}>
                  <View style={[styles.residentAvatar, { backgroundColor: avatarColorForName(item.full_name) }]}>
                    <Text style={styles.residentInitial}>{getInitials(item.full_name)}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.residentName}>{item.full_name}</Text>
                    <Text style={styles.towerSub}>
                      {item.flat?.number ?? '—'} · {item.occupancy_type ?? '—'}
                    </Text>
                  </View>
                  <StatusPill label={status.label} color={status.color} backgroundColor={status.bg} />
                </Pressable>
              );
            }}
          />
        )}

        <Pressable style={styles.addButton} onPress={addAction}>
          <Text style={styles.addButtonLabel}>
            {activeTab === 'Residents' ? '+ Add Resident' : activeTab === 'Flats' ? '+ Add Flat' : '+ Add Tower'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1, minWidth: 0 },
  header: { backgroundColor: Colors.green400, paddingTop: 58, paddingHorizontal: 20, paddingBottom: 54 },
  headerTitle: { fontFamily: FontFamily.headingExtraBold, fontSize: 26, color: Colors.textOnDark },
  headerSubtitle: { fontSize: 14, color: 'rgba(247,244,236,0.68)', marginTop: 5 },
  body: { flex: 1, paddingHorizontal: 16, marginTop: -26 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 6,
    shadowColor: '#10261B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 3,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  segmentLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.textFaint },
  segmentLabelActive: { color: Colors.green400 },
  segmentIndicator: { height: 2.5, width: '80%', backgroundColor: Colors.green400, marginTop: 8, borderRadius: 2 },
  searchRow: { marginTop: 16 },
  searchInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
    fontSize: 14.5,
    color: Colors.textPrimary,
  },
  listContent: { paddingTop: 14, paddingBottom: 90, gap: 10 },
  towerRow: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.cardLarge - 4,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  towerName: { fontSize: 15.5, fontWeight: '700' },
  towerSub: { fontSize: 12.5, color: Colors.textMuted, marginTop: 2 },
  ringWrap: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
  ringLabel: { fontSize: 11.5, fontWeight: '800' },
  flatRow: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.cardLarge - 4,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  flatCode: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E9F1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatCodeLabel: { fontFamily: FontFamily.headingExtraBold, fontSize: 14, color: Colors.success700 },
  flatStatsCol: { alignItems: 'flex-end' },
  flatOccupied: { fontSize: 13, fontWeight: '700', color: Colors.success600 },
  flatVacant: { fontSize: 13, fontWeight: '700', color: '#9A6B14' },
  flatResidentName: { maxWidth: 100, fontSize: 11.5, color: Colors.textMuted, marginTop: 2 },
  residentRow: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.cardLarge - 4,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  residentAvatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  residentInitial: { fontFamily: FontFamily.headingBold, fontSize: 16, color: Colors.green500 },
  residentName: { fontSize: 15, fontWeight: '600' },
  addButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.green500 },
});

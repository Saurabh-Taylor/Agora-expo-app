import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage, getVerificationStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useResidents } from '@/features/residents/api';
import { useDeleteEmptyTower, useTowerStats } from '@/features/towers/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function TowerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const towerStatsQuery = useTowerStats(societyId);
  const residentsQuery = useResidents(societyId);
  const deleteTower = useDeleteEmptyTower();

  const tower = towerStatsQuery.data?.find((item) => item.id === id);
  const towerResidents = useMemo(
    () => (residentsQuery.data ?? []).filter((resident) => resident.flat?.tower_id === id),
    [residentsQuery.data, id],
  );

  const isLoading = towerStatsQuery.isLoading || residentsQuery.isLoading;
  const isError = towerStatsQuery.isError || residentsQuery.isError;

  if (isLoading || isError || !tower) {
    return (
      <View style={styles.root}>
        <AsyncState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => {
            towerStatsQuery.refetch();
            residentsQuery.refetch();
          }}
          isEmpty={!tower}
          emptyMessage="Tower not found."
        />
      </View>
    );
  }

  const towerId = tower.id;

  function confirmDelete() {
    if (!societyId || deleteTower.isPending) return;
    Alert.alert(
      'Delete empty tower?',
      'This permanently removes the tower and its generated flats. Towers with residents or activity history cannot be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTower.mutateAsync({ id: towerId, societyId });
              showToast('Tower deleted');
              router.replace('/(admin)/(tabs)/community');
            } catch (error) {
              showToast(getErrorMessage(error, 'Could not delete the tower'));
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <View style={styles.flex}>
          <Text style={styles.title}>{tower.name}</Text>
          <Text style={styles.subtitle}>{tower.floors} floors - Code {tower.code}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          style={styles.editButton}
          onPress={() => router.push({ pathname: '/(admin)/edit-tower/[id]', params: { id: towerId } } as unknown as Href)}>
          <Text style={styles.editButtonLabel}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{tower.totalFlats}</Text>
          <Text style={styles.statLabel}>Total flats</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, styles.successText]}>{tower.occupiedFlats}</Text>
          <Text style={styles.statLabel}>Occupied</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, styles.vacantText]}>{tower.vacantFlats}</Text>
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
          <Text style={[styles.statValue, styles.dangerText]}>0</Text>
          <Text style={styles.statLabel}>Open issues</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>RESIDENTS - {towerResidents.length}</Text>
      <FlatList
        data={towerResidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <AsyncState
            isLoading={false}
            isError={false}
            isEmpty
            emptyMessage="No residents are assigned to this tower."
          />
        }
        ListFooterComponent={
          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Delete tower</Text>
            <Text style={styles.dangerDescription}>
              Only an unused tower with no residents or activity history can be permanently deleted.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={[styles.deleteButton, deleteTower.isPending && styles.disabledButton]}
              onPress={confirmDelete}
              disabled={deleteTower.isPending}>
              {deleteTower.isPending && <ActivityIndicator size="small" color={Colors.danger700} />}
              <Text style={styles.deleteButtonLabel}>
                {deleteTower.isPending ? 'Deleting...' : 'Delete empty tower'}
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const status = item.is_active
            ? getVerificationStatusStyle(item.is_verified)
            : { label: 'Inactive', color: Colors.danger700, bg: '#F9E4E1' };
          return (
            <Pressable style={styles.residentRow} onPress={() => router.push(`/(admin)/resident/${item.id}`)}>
              <View style={styles.unitCodeWrap}>
                <Text style={styles.unitCode}>{tower.code}-{item.flat?.number}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.residentName}>
                  {tower.code}-{item.flat?.number} <Text style={styles.residentNameSub}>({item.full_name})</Text>
                </Text>
                <Text style={styles.subtitle}>{item.occupancy_type ?? "-"}</Text>
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
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  editButton: {
    minWidth: 54,
    minHeight: 44,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  editButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.green500 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 20 },
  statCell: {
    width: '31%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { fontFamily: FontFamily.headingExtraBold, fontSize: 21 },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 3 },
  successText: { color: Colors.success600 },
  vacantText: { color: '#9A6B14' },
  dangerText: { color: Colors.danger700 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 24 },
  listContent: { gap: 10, paddingTop: 10, paddingBottom: 40 },
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
  dangerZone: {
    marginTop: 18,
    padding: 16,
    borderRadius: Radius.card - 4,
    borderWidth: 1,
    borderColor: '#EFC8C3',
    backgroundColor: '#FFF8F7',
  },
  dangerTitle: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.danger700 },
  dangerDescription: { marginTop: 5, fontSize: 12.5, lineHeight: 18, color: Colors.textMuted },
  deleteButton: {
    marginTop: 13,
    minHeight: 46,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.danger700,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.danger700 },
  disabledButton: { opacity: 0.55 },
});

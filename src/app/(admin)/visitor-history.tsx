import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  avatarColorForName,
  formatDate,
  formatTime,
  formatVehicleLabel,
  getVisitorHistorySince,
  getInitials,
  getVisitorRequestStatusStyle,
  titleCase,
} from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { FilterChip } from '@/components/filter-chip';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import {
  Colors,
  FontFamily,
  Radius,
  VisitorCategoryFilterOptions,
  VisitorHistoryRangeOptions,
  VisitorHistoryStatusOptions,
} from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import {
  useAdminVisitorHistory,
  type AdminVisitorHistoryFilters,
  type AdminVisitorHistoryItem,
  type VisitorCategory,
  type VisitorRequestStatus,
} from '@/features/visitors/api';
import { useTowers } from '@/features/towers/api';
import { useAuthStore } from '@/stores/auth-store';

type RangeFilter = (typeof VisitorHistoryRangeOptions)[number]['value'];
type StatusFilter = (typeof VisitorHistoryStatusOptions)[number]['value'];
type CategoryFilter = VisitorCategory | 'ALL';

function getActivityTime(item: AdminVisitorHistoryItem) {
  return item.exit_at ?? item.entry_at ?? item.decision_at ?? item.created_at;
}

export default function AdminVisitorHistoryScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const towersQuery = useTowers(societyId);

  const [range, setRange] = useState<RangeFilter>('30_DAYS');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [towerId, setTowerId] = useState<string | null>(null);
  const [flatDraft, setFlatDraft] = useState('');
  const [flatNumber, setFlatNumber] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const since = useMemo(() => getVisitorHistorySince(range), [range]);
  const filters = useMemo<AdminVisitorHistoryFilters>(
    () => ({
      since,
      status: status as VisitorRequestStatus | 'ALL',
      category,
      towerId,
      flatNumber,
    }),
    [category, flatNumber, since, status, towerId],
  );
  const historyQuery = useAdminVisitorHistory(societyId, filters);
  const history = historyQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const extraFilterCount = Number(category !== 'ALL') + Number(!!towerId) + Number(!!flatNumber);

  function applyFlatFilter() {
    const value = flatDraft.trim().toUpperCase();
    setFlatDraft(value);
    setFlatNumber(value || null);
  }

  function clearExtraFilters() {
    setCategory('ALL');
    setTowerId(null);
    setFlatDraft('');
    setFlatNumber(null);
  }

  function renderHistoryItem({ item }: { item: AdminVisitorHistoryItem }) {
    const statusStyle = getVisitorRequestStatusStyle(item.status);
    return (
      <View style={styles.historyCard}>
        <View style={[styles.avatar, { backgroundColor: avatarColorForName(item.visitor_name) }]}>
          <Text style={styles.avatarLabel}>{getInitials(item.visitor_name)}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.visitorName} numberOfLines={1}>
              {item.visitor_name}
            </Text>
            <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
          </View>
          <Text style={styles.cardMeta}>
            {titleCase(item.visitor_category)} · {item.tower_code}-{item.flat_number}
            {item.is_pre_approved ? ' · Pre-approved' : ''}
          </Text>
          {!!formatVehicleLabel(item.vehicle_number, item.vehicle_type) && (
            <Text style={styles.cardTime}>Vehicle {formatVehicleLabel(item.vehicle_number, item.vehicle_type)}</Text>
          )}
          <Text style={styles.cardTime}>
            Requested {formatDate(item.created_at)} at {formatTime(item.created_at)}
          </Text>
          {getActivityTime(item) !== item.created_at && (
            <Text style={styles.cardTime}>Last update {formatTime(getActivityTime(item))}</Text>
          )}
        </View>
      </View>
    );
  }

  const listHeader = (
    <View>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Visitor history</Text>
          <Text style={styles.subtitle}>Read-only society activity</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>DATE RANGE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {VisitorHistoryRangeOptions.map((item) => (
          <FilterChip
            key={item.value}
            label={item.label}
            selected={range === item.value}
            onPress={() => setRange(item.value)}
          />
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>STATUS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {VisitorHistoryStatusOptions.map((item) => (
          <FilterChip
            key={item.value}
            label={item.label}
            selected={status === item.value}
            onPress={() => setStatus(item.value)}
          />
        ))}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showFilters }}
        style={styles.moreFiltersButton}
        onPress={() => setShowFilters((visible) => !visible)}>
        <Text style={styles.moreFiltersLabel}>
          {showFilters ? 'Hide filters' : 'More filters'}
          {extraFilterCount ? ` (${extraFilterCount})` : ''}
        </Text>
        <Text style={styles.moreFiltersArrow}>{showFilters ? '−' : '+'}</Text>
      </Pressable>

      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.panelLabel}>VISITOR TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {VisitorCategoryFilterOptions.map((item) => (
              <FilterChip
                key={item.value}
                label={item.label}
                selected={category === item.value}
                onPress={() => setCategory(item.value)}
              />
            ))}
          </ScrollView>

          <Text style={styles.panelLabel}>TOWER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <FilterChip label="All towers" selected={!towerId} onPress={() => setTowerId(null)} />
            {(towersQuery.data ?? []).map((tower) => (
              <FilterChip
                key={tower.id}
                label={tower.code}
                selected={towerId === tower.id}
                onPress={() => setTowerId(tower.id)}
              />
            ))}
          </ScrollView>
          {towersQuery.isError && (
            <Pressable onPress={() => towersQuery.refetch()} style={styles.inlineRetry}>
              <Text style={styles.inlineRetryLabel}>Could not load towers. Try again</Text>
            </Pressable>
          )}

          <Text style={styles.panelLabel}>EXACT FLAT NUMBER</Text>
          <View style={styles.flatFilterRow}>
            <TextInput
              value={flatDraft}
              onChangeText={setFlatDraft}
              onSubmitEditing={applyFlatFilter}
              autoCapitalize="characters"
              placeholder="e.g. 1204"
              placeholderTextColor={Colors.textFaint}
              style={styles.flatInput}
              returnKeyType="search"
            />
            <Pressable style={styles.applyButton} onPress={applyFlatFilter}>
              <Text style={styles.applyButtonLabel}>Apply</Text>
            </Pressable>
          </View>
          {!!extraFilterCount && (
            <Pressable onPress={clearExtraFilters} style={styles.clearButton}>
              <Text style={styles.clearButtonLabel}>Clear additional filters</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>Activity</Text>
        <Text style={styles.readOnlyLabel}>READ ONLY</Text>
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={history}
      keyExtractor={(item) => item.request_id}
      renderItem={renderHistoryItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <AsyncState
          isLoading={profileQuery.isLoading || historyQuery.isLoading}
          isError={profileQuery.isError || historyQuery.isError}
          isRetrying={historyQuery.isRefetching}
          onRetry={() => {
            profileQuery.refetch();
            historyQuery.refetch();
          }}
          isEmpty={!profileQuery.isLoading && !historyQuery.isLoading && history.length === 0}
          emptyTitle="No visitor activity"
          emptyMessage="No visitor records match the selected date and filters."
          actionLabel={extraFilterCount || status !== 'ALL' || range !== 'ALL_TIME' ? 'Clear filters' : undefined}
          onAction={() => {
            setRange('ALL_TIME');
            setStatus('ALL');
            clearExtraFilters();
          }}
        />
      }
      ListFooterComponent={
        history.length > 0 ? (
          <View style={styles.footer}>
            {historyQuery.isFetchingNextPage ? (
              <ActivityIndicator color={Colors.success700} />
            ) : historyQuery.isFetchNextPageError ? (
              <Pressable onPress={() => historyQuery.fetchNextPage()} style={styles.loadMoreButton}>
                <Text style={styles.loadMoreLabel}>Could not load more · Try again</Text>
              </Pressable>
            ) : historyQuery.hasNextPage ? (
              <Pressable onPress={() => historyQuery.fetchNextPage()} style={styles.loadMoreButton}>
                <Text style={styles.loadMoreLabel}>Load more</Text>
              </Pressable>
            ) : (
              <Text style={styles.endLabel}>End of visitor history</Text>
            )}
          </View>
        ) : null
      }
      refreshing={historyQuery.isRefetching && !historyQuery.isFetchingNextPage}
      onRefresh={() => historyQuery.refetch()}
      onEndReached={() => {
        if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) {
          historyQuery.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.35}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingTop: 62, paddingHorizontal: 16, paddingBottom: 52, flexGrow: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerCopy: { flex: 1 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 25, color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 1 },
  sectionLabel: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: Colors.textMutedAlt,
    marginTop: 20,
    marginBottom: 8,
  },
  filterRow: { gap: 8, paddingRight: 12 },
  moreFiltersButton: {
    minHeight: 46,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreFiltersLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.green500 },
  moreFiltersArrow: { fontFamily: FontFamily.headingBold, fontSize: 20, color: Colors.green500 },
  filterPanel: {
    marginTop: 10,
    padding: 14,
    borderRadius: Radius.card,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelLabel: {
    fontSize: 10,
    letterSpacing: 1.25,
    fontWeight: '700',
    color: Colors.textMutedAlt,
    marginTop: 12,
    marginBottom: 8,
  },
  flatFilterRow: { flexDirection: 'row', gap: 8 },
  flatInput: {
    minHeight: 46,
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    borderRadius: Radius.input,
    paddingHorizontal: 13,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  applyButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonLabel: { color: Colors.textOnDark, fontSize: 13, fontWeight: '700' },
  clearButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  clearButtonLabel: { color: Colors.danger700, fontSize: 12.5, fontWeight: '700' },
  inlineRetry: { minHeight: 40, justifyContent: 'center' },
  inlineRetryLabel: { color: Colors.danger700, fontSize: 12.5 },
  resultsHeader: {
    marginTop: 24,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsTitle: { fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textPrimary },
  readOnlyLabel: { fontSize: 9.5, letterSpacing: 1.2, fontWeight: '800', color: Colors.textMutedAlt },
  historyCard: {
    flexDirection: 'row',
    gap: 11,
    padding: 14,
    marginBottom: 10,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 15, color: Colors.green500 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  visitorName: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: 14.5, color: Colors.textPrimary },
  cardMeta: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: Colors.textMuted },
  cardTime: { marginTop: 3, fontSize: 11.5, color: Colors.textFaint },
  footer: { minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  loadMoreButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreLabel: { fontSize: 13, fontWeight: '700', color: Colors.green500 },
  endLabel: { fontSize: 12, color: Colors.textFaint },
});

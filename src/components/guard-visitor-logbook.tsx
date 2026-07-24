import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  formatDate,
  formatLogbookMonth,
  formatRegisterNumber,
  formatTime,
  formatVehicleLabel,
  formatVisitDuration,
  getCurrentLogbookMonth,
  getQueryKey,
  getLogbookMonthBounds,
  getVisitorHistorySince,
  getVisitorRequestStatusStyle,
  parseHistoryDateInput,
  titleCase,
} from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { FilterChip } from '@/components/filter-chip';
import { StatusPill } from '@/components/status-pill';
import {
  CalendarMonthLabels,
  Colors,
  DEFAULT_GUARD_LOGBOOK_FILTERS,
  FontFamily,
  GuardLogbookRangeOptions,
  GuardLogbookStateOptions,
  LOGBOOK_LOCATION_SEARCH_DEBOUNCE_MS,
  QueryKeyRoots,
  Radius,
  VisitorCategoryFilterOptions,
} from '@/constants/commonConstants';
import {
  useLogbookLocationSearch,
  useSocietyVisitorLogbook,
  useVisitorLogbookRealtimeNotice,
  type LogbookLocationResult,
  type SocietyVisitorLogbookFilters,
  type SocietyVisitorLogbookItem,
  type VisitorCategory,
} from '@/features/visitors/api';

type RangeFilter = (typeof GuardLogbookRangeOptions)[number]['value'];
type StateFilter = (typeof GuardLogbookStateOptions)[number]['value'];
type CategoryFilter = VisitorCategory | 'ALL';
type FilterView = 'FILTERS' | 'LOCATION';

type LogbookSelection = {
  range: RangeFilter;
  state: StateFilter;
  category: CategoryFilter;
  towerId: string | null;
  flatId: string | null;
  locationLabel: string;
  customFrom: string;
  customTo: string;
  month: string;
};

function createDefaultSelection(): LogbookSelection {
  return {
    ...DEFAULT_GUARD_LOGBOOK_FILTERS,
    month: getCurrentLogbookMonth(),
  };
}

function getStateQuery(state: StateFilter): Pick<SocietyVisitorLogbookFilters, 'status' | 'entryOnly'> {
  switch (state) {
    case 'INSIDE':
      return { status: 'ENTERED', entryOnly: true };
    case 'EXITED':
      return { status: 'EXITED', entryOnly: true };
    case 'PENDING':
      return { status: 'PENDING', entryOnly: false };
    case 'APPROVED':
      return { status: 'APPROVED', entryOnly: false };
    case 'REJECTED':
      return { status: 'REJECTED', entryOnly: false };
    case 'ALL_REQUESTS':
      return { status: null, entryOnly: false };
    default:
      return { status: null, entryOnly: true };
  }
}

function getSelectionFilters(selection: LogbookSelection): SocietyVisitorLogbookFilters {
  const stateQuery = getStateQuery(selection.state);
  const monthBounds = selection.range === 'MONTH' ? getLogbookMonthBounds(selection.month) : null;

  return {
    since:
      selection.range === 'CUSTOM'
        ? parseHistoryDateInput(selection.customFrom)
        : monthBounds?.since ?? getVisitorHistorySince(selection.range),
    until:
      selection.range === 'CUSTOM'
        ? parseHistoryDateInput(selection.customTo, true)
        : monthBounds?.until ?? null,
    status: stateQuery.status,
    category: selection.category === 'ALL' ? null : selection.category,
    towerId: selection.towerId,
    flatId: selection.flatId,
    entryOnly: stateQuery.entryOnly,
  };
}

function formatLogbookDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRegisterTime(iso: string | null) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
}

export function GuardVisitorLogbook({ societyId }: { societyId: string | null | undefined }) {
  const queryClient = useQueryClient();
  const [appliedSelection, setAppliedSelection] = useState<LogbookSelection>(createDefaultSelection);
  const [draftSelection, setDraftSelection] = useState<LogbookSelection>(createDefaultSelection);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterView, setFilterView] = useState<FilterView>('FILTERS');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  const filters = useMemo(() => getSelectionFilters(appliedSelection), [appliedSelection]);
  const logbookQuery = useSocietyVisitorLogbook(societyId, filters);
  const realtimeNotice = useVisitorLogbookRealtimeNotice(societyId);
  const debouncedLocationSearch = useDebouncedValue(
    locationSearch.trim(),
    LOGBOOK_LOCATION_SEARCH_DEBOUNCE_MS,
  );
  const locationQuery = useLogbookLocationSearch(
    debouncedLocationSearch,
    societyId,
    isFilterOpen && filterView === 'LOCATION',
  );

  const entries = logbookQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = logbookQuery.data?.pages[0]?.totalCount ?? 0;
  const rangeLabel =
    appliedSelection.range === 'MONTH'
      ? formatLogbookMonth(appliedSelection.month)
      : (GuardLogbookRangeOptions.find((option) => option.value === appliedSelection.range)?.label ?? 'Today');
  const stateLabel =
    GuardLogbookStateOptions.find((option) => option.value === appliedSelection.state)?.label ?? 'All visits';
  const activeFilterCount =
    Number(appliedSelection.range !== 'TODAY') +
    Number(appliedSelection.state !== 'VISITS') +
    Number(appliedSelection.category !== 'ALL') +
    Number(!!appliedSelection.towerId || !!appliedSelection.flatId);

  function openFilters() {
    setDraftSelection(appliedSelection);
    setFilterView('FILTERS');
    setFilterError(null);
    setIsFilterOpen(true);
  }

  function closeFilters() {
    setIsFilterOpen(false);
    setFilterView('FILTERS');
    setLocationSearch('');
    setFilterError(null);
  }

  function applyFilters() {
    if (draftSelection.range === 'CUSTOM') {
      const since = parseHistoryDateInput(draftSelection.customFrom);
      const until = parseHistoryDateInput(draftSelection.customTo, true);
      if (!since || !until) {
        setFilterError('Enter both dates as YYYY-MM-DD.');
        return;
      }
      if (new Date(until).getTime() <= new Date(since).getTime()) {
        setFilterError('The end date must be on or after the start date.');
        return;
      }
    }

    if (draftSelection.range === 'MONTH' && !getLogbookMonthBounds(draftSelection.month)) {
      setFilterError('Choose a valid month and year.');
      return;
    }

    setFilterError(null);
    setAppliedSelection(draftSelection);
    setExpandedRequestId(null);
    closeFilters();
  }

  function clearFilters() {
    const defaults = createDefaultSelection();
    setDraftSelection(defaults);
    setAppliedSelection(defaults);
    setExpandedRequestId(null);
    closeFilters();
  }

  function changeMonthYear(yearDelta: number) {
    const [year, month] = draftSelection.month.split('-').map(Number);
    setDraftSelection((current) => ({
      ...current,
      month: `${year + yearDelta}-${String(month).padStart(2, '0')}`,
    }));
  }

  function chooseMonth(monthIndex: number) {
    const year = Number(draftSelection.month.slice(0, 4));
    setDraftSelection((current) => ({
      ...current,
      month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    }));
  }

  function chooseLocation(location: LogbookLocationResult) {
    const isFlat = location.result_type === 'FLAT' && !!location.flat_id;
    setDraftSelection((current) => ({
      ...current,
      towerId: location.tower_id,
      flatId: isFlat ? location.flat_id : null,
      locationLabel: isFlat
        ? `Tower ${location.tower_code} / Flat ${location.flat_number}`
        : `Tower ${location.tower_code} - ${location.tower_name}`,
    }));
    setLocationSearch('');
    setFilterView('FILTERS');
  }

  function chooseEntireSociety() {
    setDraftSelection((current) => ({
      ...current,
      towerId: null,
      flatId: null,
      locationLabel: 'Entire society',
    }));
    setLocationSearch('');
    setFilterView('FILTERS');
  }

  async function refreshFirstPage() {
    realtimeNotice.clearNewActivity();
    await queryClient.resetQueries({
      queryKey: getQueryKey(QueryKeyRoots.visitorLogbook, societyId, filters),
      exact: true,
    });
  }

  function renderEntry({ item, index }: { item: SocietyVisitorLogbookItem; index: number }) {
    const previousItem = entries[index - 1];
    const showDate =
      !previousItem ||
      new Date(previousItem.activity_at).toDateString() !== new Date(item.activity_at).toDateString();
    const statusStyle = getVisitorRequestStatusStyle(item.status);
    const expanded = expandedRequestId === item.request_id;
    const hasVisit = !!item.entry_at;

    return (
      <View>
        {showDate && (
          <View style={styles.dateBand}>
            <Text style={styles.dateBandText}>{formatLogbookDate(item.activity_at)}</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpandedRequestId(expanded ? null : item.request_id)}
          style={styles.registerRow}>
          <View style={styles.rowColumns}>
            <View style={styles.numberColumn}>
              <Text style={styles.registerNumber}>{formatRegisterNumber(item.register_number)}</Text>
            </View>
            <View style={styles.visitorColumn}>
              <Text style={styles.visitorName} numberOfLines={1}>
                {item.visitor_name}
              </Text>
              <Text style={styles.visitorType} numberOfLines={1}>
                {titleCase(item.visitor_category)}
              </Text>
            </View>
            <View style={styles.flatColumn}>
              <Text style={styles.flatValue} numberOfLines={1}>
                {item.tower_code}-{item.flat_number}
              </Text>
            </View>
            <View style={styles.timeColumn}>
              <Text style={styles.timeValue}>{formatRegisterTime(item.entry_at)}</Text>
            </View>
            <View style={styles.timeColumn}>
              <Text style={styles.timeValue}>{formatRegisterTime(item.exit_at)}</Text>
            </View>
          </View>

          {expanded && (
            <View style={styles.expandedDetails}>
              <View style={styles.expandedTopRow}>
                <StatusPill
                  label={statusStyle.label}
                  color={statusStyle.color}
                  backgroundColor={statusStyle.bg}
                />
                <Text style={styles.durationText}>
                  {hasVisit ? formatVisitDuration(item.entry_at as string, item.exit_at) : 'No gate entry recorded'}
                </Text>
              </View>
              <Text style={styles.detailText}>Phone: {item.visitor_phone ?? 'Not provided'}</Text>
              <Text style={styles.detailText}>
                Vehicle: {formatVehicleLabel(item.vehicle_number, item.vehicle_type) ?? 'Not provided'}
              </Text>
              <Text style={styles.detailText}>
                Request: {formatDate(item.created_at)} at {formatTime(item.created_at)}
                {item.is_pre_approved ? ' / Pre-approved' : ''}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    );
  }

  const listHeader = (
    <View>
      {realtimeNotice.hasNewActivity && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void refreshFirstPage()}
          style={styles.newActivityBanner}>
          <Text style={styles.newActivityText}>New gate activity is available</Text>
          <Text style={styles.newActivityAction}>Refresh</Text>
        </Pressable>
      )}

      <View style={styles.registerIntro}>
        <View style={styles.registerIntroCopy}>
          <Text style={styles.registerOverline}>DIGITAL GATE REGISTER</Text>
          <Text style={styles.registerTitle}>{rangeLabel}</Text>
          <Text style={styles.registerScope} numberOfLines={2}>
            {stateLabel} / {appliedSelection.locationLabel} / {logbookQuery.isLoading ? '--' : totalCount}{' '}
            {filters.entryOnly ? 'entries' : 'requests'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={openFilters} style={styles.filterButton}>
          <Text style={styles.filterButtonLabel}>Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}</Text>
        </Pressable>
      </View>

      <Text style={styles.expandHint}>Tap a register row to view its full details.</Text>

      <View style={styles.columnHeader}>
        <View style={styles.numberColumn}>
          <Text style={styles.columnLabel}>NO.</Text>
        </View>
        <View style={styles.visitorColumn}>
          <Text style={styles.columnLabel}>VISITOR</Text>
        </View>
        <View style={styles.flatColumn}>
          <Text style={styles.columnLabel}>FLAT</Text>
        </View>
        <View style={styles.timeColumn}>
          <Text style={styles.columnLabel}>ENTRY</Text>
        </View>
        <View style={styles.timeColumn}>
          <Text style={styles.columnLabel}>EXIT</Text>
        </View>
      </View>
    </View>
  );

  function renderLocationPicker() {
    const results = locationQuery.data ?? [];

    return (
      <View style={styles.locationView}>
        <View style={styles.sheetHeader}>
          <Pressable accessibilityRole="button" onPress={() => setFilterView('FILTERS')} style={styles.backButton}>
            <Text style={styles.backButtonLabel}>Back</Text>
          </Pressable>
          <View style={styles.locationHeading}>
            <Text style={styles.sheetTitle}>Choose location</Text>
            <Text style={styles.sheetSubtitle}>Search instead of loading every flat</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={closeFilters} style={styles.closeButton}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.locationSearchWrap}>
          <TextInput
            autoFocus
            value={locationSearch}
            onChangeText={setLocationSearch}
            placeholder="Search A-101, 101 or Tower A"
            placeholderTextColor={Colors.textFaint}
            autoCapitalize="characters"
            maxLength={40}
            style={styles.locationSearchInput}
          />
        </View>

        <Pressable accessibilityRole="button" onPress={chooseEntireSociety} style={styles.locationRow}>
          <View style={styles.locationTypePill}>
            <Text style={styles.locationTypeLabel}>ALL</Text>
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationTitle}>Entire society</Text>
            <Text style={styles.locationSubtitle}>Do not limit the register by location</Text>
          </View>
        </Pressable>

        {!debouncedLocationSearch ? (
          <View style={styles.locationMessage}>
            <Text style={styles.locationMessageTitle}>Find a tower or flat</Text>
            <Text style={styles.locationMessageBody}>
              Type a tower code, tower name or flat number. Only the first 20 matches are returned.
            </Text>
          </View>
        ) : locationQuery.isLoading ? (
          <View style={styles.locationMessage}>
            <ActivityIndicator color={Colors.success700} />
            <Text style={styles.locationMessageBody}>Searching locations...</Text>
          </View>
        ) : locationQuery.isError ? (
          <View style={styles.locationMessage}>
            <Text style={styles.locationMessageTitle}>Could not search locations</Text>
            <Pressable accessibilityRole="button" onPress={() => locationQuery.refetch()} style={styles.inlineRetry}>
              <Text style={styles.inlineRetryLabel}>Try again</Text>
            </Pressable>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.locationMessage}>
            <Text style={styles.locationMessageTitle}>No matching locations</Text>
            <Text style={styles.locationMessageBody}>Try a tower code or a complete flat number.</Text>
          </View>
        ) : (
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={results}
            keyExtractor={(item) => `${item.result_type}:${item.flat_id ?? item.tower_id}`}
            contentContainerStyle={styles.locationResults}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" onPress={() => chooseLocation(item)} style={styles.locationRow}>
                <View style={styles.locationTypePill}>
                  <Text style={styles.locationTypeLabel}>{item.result_type === 'FLAT' ? 'FLAT' : 'TOWER'}</Text>
                </View>
                <View style={styles.locationCopy}>
                  <Text style={styles.locationTitle}>
                    {item.result_type === 'FLAT'
                      ? `${item.tower_code}-${item.flat_number}`
                      : `Tower ${item.tower_code}`}
                  </Text>
                  <Text style={styles.locationSubtitle}>
                    {item.result_type === 'FLAT'
                      ? `Flat ${item.flat_number} / ${item.tower_name}`
                      : item.tower_name}
                  </Text>
                </View>
                <Text style={styles.selectLabel}>Select</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    );
  }

  function renderFilterForm() {
    const selectedMonth = Number(draftSelection.month.slice(5, 7)) - 1;
    const selectedYear = Number(draftSelection.month.slice(0, 4));

    return (
      <>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Filter register</Text>
            <Text style={styles.sheetSubtitle}>The register loads after you apply</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={closeFilters} style={styles.closeButton}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.filterLabel}>DATE RANGE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {GuardLogbookRangeOptions.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                selected={draftSelection.range === option.value}
                onPress={() => setDraftSelection((current) => ({ ...current, range: option.value }))}
              />
            ))}
          </ScrollView>

          {draftSelection.range === 'MONTH' && (
            <View style={styles.monthPicker}>
              <View style={styles.yearRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous year"
                  onPress={() => changeMonthYear(-1)}
                  style={styles.yearButton}>
                  <Text style={styles.yearButtonLabel}>{'<'}</Text>
                </Pressable>
                <Text style={styles.yearLabel}>{selectedYear}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next year"
                  onPress={() => changeMonthYear(1)}
                  style={styles.yearButton}>
                  <Text style={styles.yearButtonLabel}>{'>'}</Text>
                </Pressable>
              </View>
              <View style={styles.monthGrid}>
                {CalendarMonthLabels.map((month, monthIndex) => {
                  const selected = selectedMonth === monthIndex;
                  return (
                    <Pressable
                      key={month}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => chooseMonth(monthIndex)}
                      style={[styles.monthButton, selected && styles.monthButtonSelected]}>
                      <Text style={[styles.monthButtonLabel, selected && styles.monthButtonLabelSelected]}>
                        {month}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {draftSelection.range === 'CUSTOM' && (
            <View style={styles.dateInputRow}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>FROM</Text>
                <TextInput
                  value={draftSelection.customFrom}
                  onChangeText={(customFrom) =>
                    setDraftSelection((current) => ({ ...current, customFrom }))
                  }
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textFaint}
                  autoCapitalize="none"
                  style={styles.dateInput}
                />
              </View>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>TO</Text>
                <TextInput
                  value={draftSelection.customTo}
                  onChangeText={(customTo) => setDraftSelection((current) => ({ ...current, customTo }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textFaint}
                  autoCapitalize="none"
                  style={styles.dateInput}
                />
              </View>
            </View>
          )}

          <Text style={styles.filterLabel}>ENTRY STATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {GuardLogbookStateOptions.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                selected={draftSelection.state === option.value}
                onPress={() => setDraftSelection((current) => ({ ...current, state: option.value }))}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>VISITOR TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {VisitorCategoryFilterOptions.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                selected={draftSelection.category === option.value}
                onPress={() => setDraftSelection((current) => ({ ...current, category: option.value }))}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>LOCATION</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setLocationSearch('');
              setFilterView('LOCATION');
            }}
            style={styles.locationSelector}>
            <View style={styles.locationSelectorCopy}>
              <Text style={styles.locationSelectorLabel}>{draftSelection.locationLabel}</Text>
              <Text style={styles.locationSelectorHint}>Search tower or flat</Text>
            </View>
            <Text style={styles.locationSelectorAction}>Change</Text>
          </Pressable>
        </ScrollView>

        {filterError && <Text style={styles.filterError}>{filterError}</Text>}
        <View style={styles.sheetActions}>
          <Pressable accessibilityRole="button" onPress={clearFilters} style={styles.clearButton}>
            <Text style={styles.clearButtonLabel}>Reset</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={applyFilters} style={styles.applyButton}>
            <Text style={styles.applyButtonLabel}>Show register</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={entries}
        keyExtractor={(item) => item.request_id}
        renderItem={renderEntry}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <AsyncState
            isLoading={logbookQuery.isLoading}
            isError={logbookQuery.isError}
            isRetrying={logbookQuery.isRefetching}
            loadingMessage="Opening the visitor register..."
            onRetry={() => void refreshFirstPage()}
            isEmpty={!logbookQuery.isLoading && !logbookQuery.isError && entries.length === 0}
            emptyTitle="No matching register entries"
            emptyMessage="No gate activity matches the selected period and filters."
            actionLabel={activeFilterCount ? 'Reset filters' : undefined}
            onAction={activeFilterCount ? clearFilters : undefined}
          />
        }
        ListFooterComponent={
          entries.length ? (
            <View style={styles.footer}>
              {logbookQuery.isFetchingNextPage ? (
                <ActivityIndicator color={Colors.success700} />
              ) : logbookQuery.isFetchNextPageError ? (
                <Pressable onPress={() => logbookQuery.fetchNextPage()} style={styles.loadMoreButton}>
                  <Text style={styles.loadMoreLabel}>Could not load more / Try again</Text>
                </Pressable>
              ) : logbookQuery.hasNextPage ? (
                <Pressable onPress={() => logbookQuery.fetchNextPage()} style={styles.loadMoreButton}>
                  <Text style={styles.loadMoreLabel}>Load more entries</Text>
                </Pressable>
              ) : (
                <Text style={styles.endLabel}>End of register</Text>
              )}
            </View>
          ) : null
        }
        refreshing={logbookQuery.isRefetching && !logbookQuery.isFetchingNextPage}
        onRefresh={() => void refreshFirstPage()}
        onEndReached={() => {
          if (logbookQuery.hasNextPage && !logbookQuery.isFetchingNextPage) {
            logbookQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
      />

      <Modal visible={isFilterOpen} transparent animationType="fade" onRequestClose={closeFilters}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeFilters}
            accessibilityRole="button"
            accessibilityLabel="Close logbook filters"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {filterView === 'LOCATION' ? renderLocationPicker() : renderFilterForm()}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 14, paddingBottom: 44, flexGrow: 1 },
  newActivityBanner: {
    minHeight: 48,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.input,
    backgroundColor: '#E5EFE9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  newActivityText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12.5, color: Colors.success700 },
  newActivityAction: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: Colors.success700 },
  registerIntro: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    backgroundColor: '#FCFAF4',
    borderWidth: 1,
    borderColor: '#DDD6C4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  registerIntroCopy: { flex: 1, minWidth: 0 },
  registerOverline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9.5,
    letterSpacing: 1.5,
    color: Colors.success700,
  },
  registerTitle: {
    marginTop: 4,
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 21,
    color: Colors.textPrimary,
  },
  registerScope: { marginTop: 4, fontSize: 11.5, lineHeight: 17, color: Colors.textMuted },
  filterButton: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: Radius.pill,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: Colors.textOnDark },
  expandHint: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#DDD6C4',
    backgroundColor: '#F8F4E9',
    fontSize: 10.5,
    color: Colors.textFaint,
  },
  columnHeader: {
    minHeight: 36,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.green500,
    borderTopWidth: 1,
    borderColor: Colors.green500,
  },
  columnLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: Colors.textOnDark,
  },
  numberColumn: { width: 38, justifyContent: 'center' },
  visitorColumn: { flex: 1, minWidth: 0, paddingRight: 5 },
  flatColumn: { width: 54, justifyContent: 'center', paddingRight: 3 },
  timeColumn: { width: 49, justifyContent: 'center', alignItems: 'flex-end' },
  dateBand: {
    minHeight: 31,
    paddingHorizontal: 11,
    justifyContent: 'center',
    backgroundColor: '#ECE5D2',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#D8CFB9',
  },
  dateBandText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.3,
    color: '#5F665D',
  },
  registerRow: {
    backgroundColor: '#FFFEFA',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#DDD6C4',
  },
  rowColumns: {
    minHeight: 58,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  registerNumber: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    fontVariant: ['tabular-nums'],
    color: Colors.success700,
  },
  visitorName: { fontFamily: FontFamily.bodySemiBold, fontSize: 12.5, color: Colors.textPrimary },
  visitorType: { marginTop: 2, fontSize: 9.5, color: Colors.textFaint },
  flatValue: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
    color: Colors.textMuted,
  },
  timeValue: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
    color: Colors.textPrimary,
  },
  expandedDetails: {
    marginHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE8DA',
  },
  expandedTopRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  durationText: { flex: 1, textAlign: 'right', fontSize: 10.5, color: Colors.textMuted },
  detailText: { marginTop: 3, fontSize: 10.5, lineHeight: 15, color: Colors.textMuted },
  footer: { minHeight: 70, alignItems: 'center', justifyContent: 'center' },
  loadMoreButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    justifyContent: 'center',
  },
  loadMoreLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: Colors.green500 },
  endLabel: { fontSize: 12, color: Colors.textFaint },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9,24,16,0.58)',
  },
  sheet: {
    maxHeight: '90%',
    minHeight: 360,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.adminCanvas,
    paddingTop: 10,
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.borderAlt,
  },
  sheetHeader: {
    minHeight: 65,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetTitle: { fontFamily: FontFamily.headingExtraBold, fontSize: 21, color: Colors.textPrimary },
  sheetSubtitle: { marginTop: 2, fontSize: 11.5, color: Colors.textMuted },
  closeButton: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  closeLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: Colors.textMuted },
  backButton: { minHeight: 44, minWidth: 48, justifyContent: 'center' },
  backButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: Colors.green500 },
  locationHeading: { flex: 1 },
  sheetContent: { paddingHorizontal: 18, paddingBottom: 18 },
  filterLabel: {
    marginTop: 15,
    marginBottom: 8,
    fontSize: 10.5,
    letterSpacing: 1.3,
    fontWeight: '700',
    color: Colors.textMutedAlt,
  },
  chipRow: { gap: 8, paddingRight: 8 },
  monthPicker: {
    marginTop: 12,
    padding: 12,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearButtonLabel: { fontFamily: FontFamily.headingBold, fontSize: 20, color: Colors.green500 },
  yearLabel: { fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textPrimary },
  monthGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  monthButton: {
    width: '23%',
    minHeight: 39,
    borderRadius: Radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.canvas,
  },
  monthButtonSelected: { backgroundColor: Colors.green500 },
  monthButtonLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: Colors.textMuted },
  monthButtonLabelSelected: { color: Colors.textOnDark },
  dateInputRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  dateInputGroup: { flex: 1 },
  dateInputLabel: { marginBottom: 5, fontSize: 9.5, fontWeight: '700', color: Colors.textMutedAlt },
  dateInput: {
    minHeight: 47,
    paddingHorizontal: 11,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    fontSize: 12.5,
    color: Colors.textPrimary,
  },
  locationSelector: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationSelectorCopy: { flex: 1, minWidth: 0 },
  locationSelectorLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: Colors.textPrimary },
  locationSelectorHint: { marginTop: 3, fontSize: 10.5, color: Colors.textFaint },
  locationSelectorAction: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: Colors.green500 },
  filterError: {
    marginHorizontal: 18,
    marginBottom: 8,
    padding: 10,
    borderRadius: Radius.input,
    backgroundColor: '#F9E4E1',
    fontSize: 11.5,
    color: Colors.danger700,
  },
  sheetActions: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.adminCanvas,
    flexDirection: 'row',
    gap: 10,
  },
  clearButton: {
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.textMuted },
  applyButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: Colors.textOnDark },
  locationView: { minHeight: 430, flexShrink: 1 },
  locationSearchWrap: { paddingHorizontal: 18, paddingBottom: 10 },
  locationSearchInput: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  locationResults: { paddingBottom: 18 },
  locationRow: {
    minHeight: 66,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  locationTypePill: {
    minWidth: 47,
    minHeight: 28,
    paddingHorizontal: 7,
    borderRadius: Radius.pill,
    backgroundColor: '#E5EFE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTypeLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 8.5,
    letterSpacing: 0.7,
    color: Colors.success700,
  },
  locationCopy: { flex: 1, minWidth: 0 },
  locationTitle: { fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: Colors.textPrimary },
  locationSubtitle: { marginTop: 3, fontSize: 10.5, color: Colors.textMuted },
  selectLabel: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.green500 },
  locationMessage: {
    minHeight: 170,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  locationMessageTitle: { fontFamily: FontFamily.headingBold, fontSize: 16, color: Colors.textPrimary },
  locationMessageBody: { textAlign: 'center', fontSize: 11.5, lineHeight: 17, color: Colors.textMuted },
  inlineRetry: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    justifyContent: 'center',
  },
  inlineRetryLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: Colors.green500 },
});

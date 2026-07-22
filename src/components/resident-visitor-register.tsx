import { type ReactNode, useMemo, useState } from 'react';
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
  avatarColorForName,
  formatDate,
  formatLogbookMonth,
  formatTime,
  formatVehicleLabel,
  formatVisitDuration,
  getCurrentLogbookMonth,
  getInitials,
  getLogbookMonthBounds,
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
  FontFamily,
  Radius,
  RESIDENT_HISTORY_QUICK_DAY_COUNT,
  ResidentHistoryRangeOptions,
  ResidentHistoryStateOptions,
  VisitorCategoryFilterOptions,
} from '@/constants/commonConstants';
import {
  useResidentVisitorHistory,
  type ResidentVisitorHistoryFilters,
  type ResidentVisitorHistoryItem,
  type VisitorCategory,
} from '@/features/visitors/api';

type RangeFilter = (typeof ResidentHistoryRangeOptions)[number]['value'];
type StateFilter = (typeof ResidentHistoryStateOptions)[number]['value'];
type CategoryFilter = VisitorCategory | 'ALL';

type ResidentHistorySelection = {
  range: RangeFilter;
  day: string;
  month: string;
  customFrom: string;
  customTo: string;
  state: StateFilter;
  category: CategoryFilter;
};

type QuickDay = {
  key: string;
  weekday: string;
  day: string;
  month: string;
};

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getQuickDays(now = new Date()) {
  return Array.from({ length: RESIDENT_HISTORY_QUICK_DAY_COUNT }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    return {
      key: getLocalDateKey(date),
      weekday: index === 0 ? 'Today' : date.toLocaleDateString([], { weekday: 'short' }),
      day: String(date.getDate()),
      month: date.toLocaleDateString([], { month: 'short' }),
    } satisfies QuickDay;
  });
}

function getDayBounds(day: string) {
  const since = parseHistoryDateInput(day);
  const until = parseHistoryDateInput(day, true);
  return since && until ? { since, until } : null;
}

function createInitialSelection(): ResidentHistorySelection {
  return {
    range: 'DAY',
    day: getLocalDateKey(new Date()),
    month: getCurrentLogbookMonth(),
    customFrom: '',
    customTo: '',
    state: 'VISITS',
    category: 'ALL',
  };
}

function getSelectionFilters(selection: ResidentHistorySelection): ResidentVisitorHistoryFilters {
  const dayBounds = selection.range === 'DAY' ? getDayBounds(selection.day) : null;
  const monthBounds = selection.range === 'MONTH' ? getLogbookMonthBounds(selection.month) : null;
  let since: string | null = null;
  let until: string | null = null;

  if (selection.range === 'DAY') {
    since = dayBounds?.since ?? null;
    until = dayBounds?.until ?? null;
  } else if (selection.range === '7_DAYS' || selection.range === '30_DAYS') {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (selection.range === '7_DAYS' ? 6 : 29));
    since = date.toISOString();
  } else if (selection.range === 'MONTH') {
    since = monthBounds?.since ?? null;
    until = monthBounds?.until ?? null;
  } else {
    since = parseHistoryDateInput(selection.customFrom);
    until = parseHistoryDateInput(selection.customTo, true);
  }

  return {
    since,
    until,
    status: selection.state === 'INSIDE' ? 'ENTERED' : selection.state === 'EXITED' ? 'EXITED' : null,
    category: selection.category === 'ALL' ? null : selection.category,
  };
}

function getRangeLabel(selection: ResidentHistorySelection) {
  if (selection.range === 'DAY') {
    const bounds = getDayBounds(selection.day);
    return bounds
      ? new Date(bounds.since).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
      : 'Selected day';
  }
  if (selection.range === 'MONTH') return formatLogbookMonth(selection.month);
  if (selection.range === 'CUSTOM') return `${selection.customFrom || 'From'} to ${selection.customTo || 'To'}`;
  return selection.range === '7_DAYS' ? 'Last 7 days' : 'Last 30 days';
}

function formatDateBand(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type ResidentVisitorRegisterProps = {
  societyId: string | null | undefined;
  flatId: string | null | undefined;
  header: ReactNode;
};

export function ResidentVisitorRegister({ societyId, flatId, header }: ResidentVisitorRegisterProps) {
  const quickDays = useMemo(() => getQuickDays(), []);
  const [appliedSelection, setAppliedSelection] = useState<ResidentHistorySelection>(createInitialSelection);
  const [draftSelection, setDraftSelection] = useState<ResidentHistorySelection>(createInitialSelection);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);

  const filters = useMemo(() => getSelectionFilters(appliedSelection), [appliedSelection]);
  const historyQuery = useResidentVisitorHistory(societyId, flatId, filters);
  const entries = historyQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = historyQuery.data?.pages[0]?.totalCount ?? 0;
  const stateLabel =
    ResidentHistoryStateOptions.find((option) => option.value === appliedSelection.state)?.label ?? 'All visits';
  const activeFilterCount =
    Number(appliedSelection.range !== 'DAY') +
    Number(appliedSelection.state !== 'VISITS') +
    Number(appliedSelection.category !== 'ALL');

  function selectQuickDay(day: string) {
    const selection = { ...appliedSelection, range: 'DAY' as const, day };
    setAppliedSelection(selection);
    setDraftSelection(selection);
    setExpandedRequestId(null);
  }

  function openFilters() {
    setDraftSelection(appliedSelection);
    setFilterError(null);
    setIsFilterOpen(true);
  }

  function closeFilters() {
    setFilterError(null);
    setIsFilterOpen(false);
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

    setAppliedSelection(draftSelection);
    setExpandedRequestId(null);
    closeFilters();
  }

  function resetFilters() {
    const selection = createInitialSelection();
    setAppliedSelection(selection);
    setDraftSelection(selection);
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

  function renderEntry({ item, index }: { item: ResidentVisitorHistoryItem; index: number }) {
    const previousItem = entries[index - 1];
    const showDate =
      !previousItem || new Date(previousItem.entry_at).toDateString() !== new Date(item.entry_at).toDateString();
    const expanded = expandedRequestId === item.request_id;
    const statusStyle = getVisitorRequestStatusStyle(item.status);

    return (
      <View>
        {showDate && (
          <View style={styles.dateBand}>
            <Text style={styles.dateBandText}>{formatDateBand(item.entry_at)}</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpandedRequestId(expanded ? null : item.request_id)}
          style={styles.entryCard}>
          <View style={[styles.avatar, { backgroundColor: avatarColorForName(item.visitor_name) }]}>
            <Text style={styles.avatarLabel}>{getInitials(item.visitor_name)}</Text>
          </View>
          <View style={styles.entryBody}>
            <Text style={styles.visitorName} numberOfLines={1}>
              {item.visitor_name}
            </Text>
            <Text style={styles.visitorMeta} numberOfLines={1}>
              {titleCase(item.visitor_category)}
              {item.is_pre_approved ? ' / Pre-approved' : ''}
            </Text>
            <View style={styles.timeRow}>
              <View>
                <Text style={styles.timeLabel}>ENTRY</Text>
                <Text style={styles.timeValue}>{formatTime(item.entry_at)}</Text>
              </View>
              <View>
                <Text style={styles.timeLabel}>EXIT</Text>
                <Text style={styles.timeValue}>{item.exit_at ? formatTime(item.exit_at) : '--'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.statusColumn}>
            <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
            <Text style={styles.expandLabel}>{expanded ? 'Hide' : 'Details'}</Text>
          </View>

          {expanded && (
            <View style={styles.expandedDetails}>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{formatVisitDuration(item.entry_at, item.exit_at)}</Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{item.visitor_phone ?? 'Not provided'}</Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Vehicle</Text>
                <Text style={styles.detailValue}>
                  {formatVehicleLabel(item.vehicle_number, item.vehicle_type) ?? 'Not provided'}
                </Text>
              </View>
              <View style={styles.detailLine}>
                <Text style={styles.detailLabel}>Requested</Text>
                <Text style={styles.detailValue}>
                  {formatDate(item.created_at)} at {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          )}
        </Pressable>
      </View>
    );
  }

  const registerHeader = (
    <>
      {header}
      <View style={styles.registerCard}>
        <View style={styles.registerHeader}>
          <View style={styles.registerCopy}>
            <Text style={styles.overline}>MY VISITOR REGISTER</Text>
            <Text style={styles.registerTitle}>{getRangeLabel(appliedSelection)}</Text>
            <Text style={styles.registerSummary}>
              {historyQuery.isLoading ? 'Opening register...' : `${totalCount} visits / ${stateLabel}`}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={openFilters} style={styles.filterButton}>
            <Text style={styles.filterButtonText}>Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickDays}>
          {quickDays.map((item) => {
            const selected = appliedSelection.range === 'DAY' && appliedSelection.day === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => selectQuickDay(item.key)}
                style={[styles.dayButton, selected && styles.dayButtonSelected]}>
                <Text style={[styles.dayWeekday, selected && styles.dayTextSelected]}>{item.weekday}</Text>
                <Text style={[styles.dayNumber, selected && styles.dayTextSelected]}>{item.day}</Text>
                <Text style={[styles.dayMonth, selected && styles.dayTextSelected]}>{item.month}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </>
  );

  const selectedMonth = Number(draftSelection.month.slice(5, 7)) - 1;
  const selectedYear = Number(draftSelection.month.slice(0, 4));

  return (
    <>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.content}
        data={entries}
        keyExtractor={(item) => item.request_id}
        renderItem={renderEntry}
        ListHeaderComponent={registerHeader}
        ListEmptyComponent={
          <AsyncState
            isLoading={historyQuery.isLoading}
            isError={historyQuery.isError}
            isRetrying={historyQuery.isRefetching}
            loadingMessage="Opening your visitor register..."
            onRetry={() => historyQuery.refetch()}
            isEmpty={!historyQuery.isLoading && !historyQuery.isError && entries.length === 0}
            emptyTitle="No visits in this period"
            emptyMessage="Try another day or adjust the visitor filters."
            actionLabel={activeFilterCount ? 'Reset filters' : undefined}
            onAction={activeFilterCount ? resetFilters : undefined}
          />
        }
        ListFooterComponent={
          entries.length ? (
            <View style={styles.footer}>
              {historyQuery.isFetchingNextPage ? (
                <ActivityIndicator color={Colors.success700} />
              ) : historyQuery.isFetchNextPageError ? (
                <Pressable onPress={() => historyQuery.fetchNextPage()} style={styles.loadMoreButton}>
                  <Text style={styles.loadMoreText}>Could not load more / Try again</Text>
                </Pressable>
              ) : historyQuery.hasNextPage ? (
                <Pressable onPress={() => historyQuery.fetchNextPage()} style={styles.loadMoreButton}>
                  <Text style={styles.loadMoreText}>Load more visits</Text>
                </Pressable>
              ) : (
                <Text style={styles.endText}>End of visitor register</Text>
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

      <Modal visible={isFilterOpen} transparent animationType="fade" onRequestClose={closeFilters}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.backdrop} onPress={closeFilters} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Filter visitor register</Text>
                <Text style={styles.sheetSubtitle}>Filters run securely on your flat history</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={closeFilters} style={styles.closeButton}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.filterLabel}>DATE RANGE</Text>
              <View style={styles.chipWrap}>
                {ResidentHistoryRangeOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    selected={draftSelection.range === option.value}
                    onPress={() => setDraftSelection((current) => ({ ...current, range: option.value }))}
                  />
                ))}
              </View>

              {draftSelection.range === 'MONTH' && (
                <View style={styles.monthPicker}>
                  <View style={styles.yearRow}>
                    <Pressable onPress={() => changeMonthYear(-1)} style={styles.yearButton}>
                      <Text style={styles.yearButtonText}>{'<'}</Text>
                    </Pressable>
                    <Text style={styles.yearText}>{selectedYear}</Text>
                    <Pressable onPress={() => changeMonthYear(1)} style={styles.yearButton}>
                      <Text style={styles.yearButtonText}>{'>'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.monthGrid}>
                    {CalendarMonthLabels.map((month, index) => {
                      const selected = selectedMonth === index;
                      return (
                        <Pressable
                          key={month}
                          onPress={() => chooseMonth(index)}
                          style={[styles.monthButton, selected && styles.monthButtonSelected]}>
                          <Text style={[styles.monthButtonText, selected && styles.monthButtonTextSelected]}>
                            {month}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {draftSelection.range === 'CUSTOM' && (
                <View style={styles.dateInputs}>
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>FROM</Text>
                    <TextInput
                      value={draftSelection.customFrom}
                      onChangeText={(customFrom) =>
                        setDraftSelection((current) => ({ ...current, customFrom: customFrom.trim() }))
                      }
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.textFaint}
                      maxLength={10}
                      style={styles.dateInput}
                    />
                  </View>
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>TO</Text>
                    <TextInput
                      value={draftSelection.customTo}
                      onChangeText={(customTo) =>
                        setDraftSelection((current) => ({ ...current, customTo: customTo.trim() }))
                      }
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={Colors.textFaint}
                      maxLength={10}
                      style={styles.dateInput}
                    />
                  </View>
                </View>
              )}

              <Text style={styles.filterLabel}>VISIT STATE</Text>
              <View style={styles.chipWrap}>
                {ResidentHistoryStateOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    selected={draftSelection.state === option.value}
                    onPress={() => setDraftSelection((current) => ({ ...current, state: option.value }))}
                  />
                ))}
              </View>

              <Text style={styles.filterLabel}>VISITOR TYPE</Text>
              <View style={styles.chipWrap}>
                {VisitorCategoryFilterOptions.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    selected={draftSelection.category === option.value}
                    onPress={() => setDraftSelection((current) => ({ ...current, category: option.value }))}
                  />
                ))}
              </View>
            </ScrollView>

            {filterError && <Text style={styles.filterError}>{filterError}</Text>}
            <View style={styles.sheetActions}>
              <Pressable onPress={resetFilters} style={styles.resetButton}>
                <Text style={styles.resetText}>Reset</Text>
              </Pressable>
              <Pressable onPress={applyFilters} style={styles.applyButton}>
                <Text style={styles.applyText}>Show visits</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingTop: 58, paddingHorizontal: 16, paddingBottom: 40 },
  registerCard: {
    marginTop: 20,
    backgroundColor: Colors.green700,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  registerHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 18, gap: 12 },
  registerCopy: { flex: 1 },
  overline: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: Colors.gold },
  registerTitle: { marginTop: 5, fontFamily: FontFamily.headingBold, fontSize: 20, color: Colors.textOnDark },
  registerSummary: { marginTop: 4, fontSize: 12, color: 'rgba(247,244,236,0.65)' },
  filterButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: 13,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterButtonText: { fontSize: 12.5, fontWeight: '700', color: Colors.textOnDark },
  quickDays: { gap: 8, paddingHorizontal: 14, paddingBottom: 16 },
  dayButton: {
    width: 62,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(247,244,236,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dayButtonSelected: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  dayWeekday: { fontSize: 10.5, fontWeight: '700', color: 'rgba(247,244,236,0.58)' },
  dayNumber: { marginTop: 3, fontFamily: FontFamily.headingBold, fontSize: 20, color: Colors.textOnDark },
  dayMonth: { fontSize: 10.5, color: 'rgba(247,244,236,0.58)' },
  dayTextSelected: { color: Colors.green700 },
  dateBand: { paddingTop: 20, paddingBottom: 8, paddingHorizontal: 3 },
  dateBandText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: Colors.textMutedAlt },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 16, color: Colors.green500 },
  entryBody: { flex: 1, minWidth: 130 },
  visitorName: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.textPrimary },
  visitorMeta: { marginTop: 2, fontSize: 11.5, color: Colors.textMuted },
  timeRow: { flexDirection: 'row', gap: 24, marginTop: 11 },
  timeLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: Colors.textFaint },
  timeValue: { marginTop: 2, fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  statusColumn: { alignItems: 'flex-end', gap: 8 },
  expandLabel: { fontSize: 11, fontWeight: '700', color: Colors.success700 },
  expandedDetails: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 11,
    gap: 8,
  },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 18 },
  detailLabel: { fontSize: 11.5, color: Colors.textMuted },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 11.5, fontWeight: '600', color: Colors.textPrimary },
  footer: { minHeight: 72, alignItems: 'center', justifyContent: 'center' },
  loadMoreButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: Colors.success700 },
  endText: { fontSize: 12, color: Colors.textFaint },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4,16,10,0.55)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.canvas,
    overflow: 'hidden',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20 },
  sheetTitle: { fontFamily: FontFamily.headingBold, fontSize: 20, color: Colors.textPrimary },
  sheetSubtitle: { marginTop: 3, fontSize: 12, color: Colors.textMuted },
  closeButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 },
  closeText: { fontSize: 13, fontWeight: '700', color: Colors.success700 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 18 },
  filterLabel: { marginTop: 18, marginBottom: 9, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.3, color: Colors.textMutedAlt },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthPicker: { marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: Colors.surface },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Colors.canvas },
  yearButtonText: { fontSize: 20, fontWeight: '700', color: Colors.green500 },
  yearText: { fontFamily: FontFamily.headingBold, fontSize: 18 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  monthButton: { width: '23%', paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: Colors.canvas },
  monthButtonSelected: { backgroundColor: Colors.green500 },
  monthButtonText: { fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  monthButtonTextSelected: { color: Colors.textOnDark },
  dateInputs: { flexDirection: 'row', gap: 10, marginTop: 14 },
  dateInputGroup: { flex: 1 },
  dateInputLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: Colors.textMutedAlt },
  dateInput: {
    marginTop: 6,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    color: Colors.textPrimary,
  },
  filterError: { paddingHorizontal: 20, paddingBottom: 8, fontSize: 12, color: Colors.danger500 },
  sheetActions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  resetButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: Colors.borderAlt },
  resetText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  applyButton: { flex: 2, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: Colors.green500 },
  applyText: { fontSize: 14, fontWeight: '700', color: Colors.textOnDark },
});

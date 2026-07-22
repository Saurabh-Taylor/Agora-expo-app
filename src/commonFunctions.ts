import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';
import Constants, { AppOwnership } from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { AUTH_RESEND_SECONDS, AvatarPalette, Colors, ONBOARDING_COMPLETE_STORAGE_KEY } from '@/constants/commonConstants';

let onboardingCompletedCache: boolean | undefined;

export async function hasCompletedOnboarding() {
  if (onboardingCompletedCache !== undefined) return onboardingCompletedCache;

  try {
    onboardingCompletedCache = (await AsyncStorage.getItem(ONBOARDING_COMPLETE_STORAGE_KEY)) === 'true';
  } catch {
    // A non-critical preference must never block access to sign in.
    onboardingCompletedCache = true;
  }

  return onboardingCompletedCache;
}

export async function markOnboardingComplete() {
  onboardingCompletedCache = true;
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_STORAGE_KEY, 'true');
  } catch {
    // Continue to sign in/out even if the device cannot persist this preference.
  }
}

// Android Expo Go no longer includes the native remote-notification module.
// Keep the import lazy so merely rendering the app cannot evaluate the
// unsupported module; development and production builds still load it.
export async function loadNotificationsModule() {
  const isAndroidExpoGo =
    Platform.OS === 'android' &&
    (Constants.appOwnership === AppOwnership.Expo || Constants.expoGoConfig !== null);

  if (isAndroidExpoGo) return null;
  return import('expo-notifications');
}

export function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value.trim());
}

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function useResendCountdown() {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const startCountdown = useCallback(() => {
    clearInterval(timer.current);
    setRemainingSeconds(AUTH_RESEND_SECONDS);
    timer.current = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }, []);

  const resetCountdown = useCallback(() => {
    clearInterval(timer.current);
    setRemainingSeconds(0);
  }, []);

  useEffect(() => resetCountdown, [resetCountdown]);

  return { remainingSeconds, startCountdown, resetCountdown };
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// Supabase reuses a registered channel when its topic matches. A fast
// unmount/remount can occur before asynchronous channel removal completes,
// so every hook mount needs a fresh topic before adding callbacks.
let realtimeChannelSequence = 0;

export function getUniqueRealtimeChannelTopic(topic: string) {
  realtimeChannelSequence += 1;
  return topic + ':' + realtimeChannelSequence;
}

export function getInitials(fullName: string) {
  return fullName.trim().charAt(0).toUpperCase() || '?';
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function avatarColorForName(name: string) {
  return AvatarPalette[hashString(name) % AvatarPalette.length];
}

export function getTimeBasedGreeting(now: Date = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getVerificationStatusStyle(isVerified: boolean) {
  return isVerified
    ? { label: 'Verified', color: Colors.success600, bg: '#E3F2E9' }
    : { label: 'Pending', color: '#9A6B14', bg: '#F6ECD8' };
}

const VISITOR_REQUEST_STATUS_STYLES = {
  PENDING: { label: 'Waiting', color: '#9A6B14', bg: '#F6ECD8' },
  APPROVED: { label: 'Approved', color: Colors.success600, bg: '#E3F2E9' },
  REJECTED: { label: 'Denied', color: Colors.danger700, bg: '#F9E4E1' },
  LEFT_AT_GATE: { label: 'Left at gate', color: '#9A6B14', bg: '#F6ECD8' },
  ENTERED: { label: 'Inside', color: Colors.success600, bg: '#E3F2E9' },
  EXITED: { label: 'Exited', color: Colors.textMuted, bg: '#EEEDE4' },
  CANCELLED: { label: 'Cancelled', color: Colors.textMuted, bg: '#EEEDE4' },
  EXPIRED: { label: 'Expired', color: Colors.textMuted, bg: '#EEEDE4' },
} as const;

export function getVisitorRequestStatusStyle(status: keyof typeof VISITOR_REQUEST_STATUS_STYLES) {
  return VISITOR_REQUEST_STATUS_STYLES[status];
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type VisitorEntryState = {
  status: string;
  is_pre_approved: boolean;
  entry_at: string | null;
  valid_until: string | null;
};

export function hasGatePassExpired(request: VisitorEntryState, now = Date.now()) {
  return (
    request.is_pre_approved &&
    request.status === 'APPROVED' &&
    !request.entry_at &&
    !!request.valid_until &&
    new Date(request.valid_until).getTime() <= now
  );
}

export function getEffectiveVisitorRequestStatus<TStatus extends string>(
  request: VisitorEntryState & { status: TStatus },
  now = Date.now(),
) {
  return hasGatePassExpired(request, now) ? ('EXPIRED' as const) : request.status;
}

export function isVisitorReadyForEntry(request: VisitorEntryState, now = Date.now()) {
  return (
    request.status === 'APPROVED' &&
    !request.entry_at &&
    (!request.is_pre_approved || (!!request.valid_until && new Date(request.valid_until).getTime() > now))
  );
}

export function isGatePassActive(request: VisitorEntryState, now = Date.now()) {
  return request.is_pre_approved && isVisitorReadyForEntry(request, now);
}

export function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

const NOTICE_CATEGORY_STYLES = {
  GENERAL: { label: 'General', color: Colors.categoryGeneral.text, bg: Colors.categoryGeneral.bg },
  WATER: { label: 'Water', color: Colors.categoryWater.text, bg: Colors.categoryWater.bg },
  EVENT: { label: 'Event', color: Colors.categoryEvent.text, bg: Colors.categoryEvent.bg },
  BILLING: { label: 'Billing', color: Colors.categoryBilling.text, bg: Colors.categoryBilling.bg },
  SECURITY: { label: 'Security', color: Colors.categorySecurity.text, bg: Colors.categorySecurity.bg },
} as const;

export function getNoticeCategoryStyle(category: keyof typeof NOTICE_CATEGORY_STYLES) {
  return NOTICE_CATEGORY_STYLES[category];
}

export function invalidateSocietyNotices(queryClient: QueryClient, societyId: string) {
  return queryClient.invalidateQueries({ queryKey: ['notices', societyId] });
}

export function getPublishedNoticePushInput(notice: { id: string; title: string }) {
  return {
    notifyAllResidents: true,
    title: 'New notice published',
    body: notice.title,
    data: { type: 'NOTICE', noticeId: notice.id },
  } as const;
}

const COMPLAINT_PRIORITY_STYLES = {
  LOW: { label: 'Low', color: Colors.textMuted, bg: '#EEEDE4' },
  MEDIUM: { label: 'Medium', color: '#9A6B14', bg: '#F6ECD8' },
  HIGH: { label: 'High', color: Colors.danger700, bg: '#F9E4E1' },
} as const;

export function getComplaintPriorityStyle(priority: keyof typeof COMPLAINT_PRIORITY_STYLES) {
  return COMPLAINT_PRIORITY_STYLES[priority];
}

const COMPLAINT_STATUS_STYLES = {
  OPEN: { label: 'Open', color: '#9A6B14', bg: '#F6ECD8' },
  IN_PROGRESS: { label: 'In progress', color: Colors.categoryWater.text, bg: Colors.categoryWater.bg },
  RESOLVED: { label: 'Resolved', color: Colors.success600, bg: '#E3F2E9' },
} as const;

export function getComplaintStatusStyle(status: keyof typeof COMPLAINT_STATUS_STYLES) {
  return COMPLAINT_STATUS_STYLES[status];
}

export function formatCurrency(amount: number) {
  return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function parseHistoryDateInput(value: string, endExclusive = false) {
  if (value.length !== 10 || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (endExclusive) date.setDate(date.getDate() + 1);
  return date.toISOString();
}


export function getCurrentLogbookMonth(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getLogbookMonthBounds(monthValue: string) {
  if (!/^\d{4}-\d{2}$/.test(monthValue)) return null;
  const [year, month] = monthValue.split('-').map(Number);
  if (month < 1 || month > 12) return null;
  const since = new Date(year, month - 1, 1);
  const until = new Date(year, month, 1);
  return { since: since.toISOString(), until: until.toISOString() };
}

export function formatLogbookMonth(monthValue: string) {
  const bounds = getLogbookMonthBounds(monthValue);
  if (!bounds) return 'Select month';
  return new Date(bounds.since).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

export function formatRegisterNumber(value: number | null) {
  return value === null ? '--' : String(value).padStart(3, '0');
}

export function getVisitorHistorySince(range: string, now = new Date()) {
  if (range === 'ALL_TIME' || range === 'CUSTOM') return null;
  const since = new Date(now);
  if (range === 'TODAY') {
    since.setHours(0, 0, 0, 0);
    return since.toISOString();
  }
  const days = range === '7_DAYS' ? 7 : 30;
  since.setDate(since.getDate() - days);
  return since.toISOString();
}


export function normalizeVehicleNumber(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function normalizeSingleLineInput(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function isVehicleDetailsValid(
  vehicleNumber: string,
  vehicleType: string | null | undefined,
) {
  const normalizedNumber = normalizeVehicleNumber(vehicleNumber);
  if (!vehicleType && !normalizedNumber) return true;
  return (
    !!vehicleType &&
    normalizedNumber.length >= 3 &&
    normalizedNumber.length <= 20 &&
    /^[A-Z0-9][A-Z0-9 -]*[A-Z0-9]$/.test(normalizedNumber)
  );
}

export function formatVehicleLabel(
  vehicleNumber: string | null | undefined,
  vehicleType: string | null | undefined,
) {
  if (!vehicleNumber) return null;
  const typeLabel =
    vehicleType === 'TWO_WHEELER'
      ? 'Two-wheeler'
      : vehicleType === 'COMMERCIAL'
        ? 'Commercial'
        : vehicleType === 'CAR'
          ? 'Car'
          : 'Vehicle';
  return `${typeLabel} / ${vehicleNumber}`;
}

export function formatVisitDuration(entryAt: string, exitAt: string | null) {
  if (!exitAt) return 'Currently inside';
  const totalMinutes = Math.max(0, Math.round((new Date(exitAt).getTime() - new Date(entryAt).getTime()) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const BOOKING_STATUS_STYLES = {
  PENDING: { label: 'Pending', color: '#9A6B14', bg: '#F6ECD8' },
  CONFIRMED: { label: 'Confirmed', color: Colors.success600, bg: '#E3F2E9' },
  CANCELLED: { label: 'Declined', color: Colors.danger700, bg: '#F9E4E1' },
} as const;

export function getBookingStatusStyle(status: keyof typeof BOOKING_STATUS_STYLES) {
  return BOOKING_STATUS_STYLES[status];
}

const STAFF_STATUS_STYLES = {
  ON_DUTY: { label: 'On duty', color: Colors.success600, bg: '#E3F2E9' },
  OFF_DUTY: { label: 'Off duty', color: Colors.textFaint, bg: '#EEEDE4' },
} as const;

export function getStaffStatusStyle(status: keyof typeof STAFF_STATUS_STYLES) {
  return STAFF_STATUS_STYLES[status];
}

const SERVICE_PROVIDER_STATUS_STYLES = {
  ON_DUTY: { label: 'Active', color: Colors.success600, bg: '#E3F2E9' },
  OFF_DUTY: { label: 'Inactive', color: Colors.textFaint, bg: '#EEEDE4' },
} as const;

export function getServiceProviderStatusStyle(status: keyof typeof SERVICE_PROVIDER_STATUS_STYLES) {
  return SERVICE_PROVIDER_STATUS_STYLES[status];
}

export function invalidateSocietyDirectory(queryClient: QueryClient, societyId: string) {
  return queryClient.invalidateQueries({ queryKey: ['directory', societyId] });
}

export function isValidDirectoryPhone(phone: string) {
  const value = phone.trim();
  return !value || (value.length >= 7 && value.length <= 20 && value.split("").every((character) => "0123456789+() -".includes(character)));
}

export function matchesDirectorySearch(entry: { name: string }, search: string, details: string[]) {
  const needle = search.trim().toLowerCase();
  return !needle || [entry.name, ...details].some((value) => value.toLowerCase().includes(needle));
}

export function formatMonthYear(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function invalidateSocietyAmenities(queryClient: QueryClient, societyId: string) {
  return queryClient.invalidateQueries({ queryKey: ['amenities', societyId] });
}

export function formatAmenityTimings(openTime: string | null, closeTime: string | null) {
  if (!openTime || !closeTime) return 'Timing not set';
  return `${openTime.slice(0, 5)} – ${closeTime.slice(0, 5)}`;
}

export function formatBookingSlot(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const day = startDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const startTime = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${startTime} – ${endTime}`;
}

export function isValidAmenityTimeRange(openTime: string, closeTime: string) {
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timePattern.test(openTime) && timePattern.test(closeTime) && openTime < closeTime;
}

export function invalidateSocietyComplaints(queryClient: QueryClient, societyId: string) {
  return queryClient.invalidateQueries({ queryKey: ['complaints', societyId] });
}

export function isPollOpen(poll: { state: 'ACTIVE' | 'CLOSED'; closes_at: string | null; archived_at: string | null }) {
  return poll.state === 'ACTIVE' && !poll.archived_at && (!poll.closes_at || new Date(poll.closes_at).getTime() > Date.now());
}

export function getPollDisplayState(poll: { state: 'ACTIVE' | 'CLOSED'; closes_at: string | null; archived_at: string | null }) {
  if (poll.archived_at) return 'ARCHIVED' as const;
  return isPollOpen(poll) ? ('ACTIVE' as const) : ('CLOSED' as const);
}

export function invalidateSocietyPolls(queryClient: QueryClient, societyId: string) {
  return queryClient.invalidateQueries({ queryKey: ['polls', societyId] });
}

type PollOptionRow = { id: string; label: string; sort_order: number; vote_count: number };

// Shared by the admin live-results screen and the resident poll-voting card
// so vote-tally math (count, percentage, leading option) lives in one place.
export function computePollResults(poll: { poll_options: PollOptionRow[] }) {
  const totalVotes = poll.poll_options.reduce((sum, option) => sum + option.vote_count, 0);
  const maxCount = Math.max(0, ...poll.poll_options.map((option) => option.vote_count));
  const options = [...poll.poll_options]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((option) => {
      const count = option.vote_count;
      return {
        ...option,
        count,
        pct: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
        isLeading: totalVotes > 0 && count === maxCount,
      };
    });
  return { options, totalVotes };
}

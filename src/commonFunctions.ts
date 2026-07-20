import Constants, { AppOwnership } from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { AUTH_RESEND_SECONDS, AvatarPalette, Colors } from '@/constants/commonConstants';

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
} as const;

export function getVisitorRequestStatusStyle(status: keyof typeof VISITOR_REQUEST_STATUS_STYLES) {
  return VISITOR_REQUEST_STATUS_STYLES[status];
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
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

type PollOptionRow = { id: string; label: string; sort_order: number };
type PollVoteRow = { option_id: string };

// Shared by the admin live-results screen and the resident poll-voting card
// so vote-tally math (count, percentage, leading option) lives in one place.
export function computePollResults(poll: { poll_options: PollOptionRow[]; poll_votes: PollVoteRow[] }) {
  const counts = new Map<string, number>();
  for (const vote of poll.poll_votes) {
    counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
  }
  const totalVotes = poll.poll_votes.length;
  const maxCount = Math.max(0, ...poll.poll_options.map((option) => counts.get(option.id) ?? 0));
  const options = [...poll.poll_options]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((option) => {
      const count = counts.get(option.id) ?? 0;
      return {
        ...option,
        count,
        pct: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0,
        isLeading: totalVotes > 0 && count === maxCount,
      };
    });
  return { options, totalVotes };
}

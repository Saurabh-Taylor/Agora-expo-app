import { AvatarPalette, Colors } from '@/constants/commonConstants';

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

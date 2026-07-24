/**
 * Agora design tokens, ported 1:1 from design_handoff_agora_app/README.md.
 * Fixed brand palette (no light/dark variant) — every screen must reference
 * these instead of repeating hex values, per AGENTS.md's no-duplication rule.
 */

export const Colors = {
  // Backgrounds
  canvas: '#EDE7DA',
  adminCanvas: '#F4EFE3',
  surface: '#FFFFFF',

  // Deep green (dark surfaces/headers)
  green900: '#091810',
  green800: '#0A1F16',
  green700: '#0B1C13',
  green600: '#0F2C1F',
  green500: '#10261B',
  green400: '#123528',

  // Accent gold (primary CTA/brand)
  gold: '#E7A33C',
  goldHover: '#F0B04E',
  logoGradientStart: '#F3B75B',
  logoGradientEnd: '#D0871F',

  // Success/CTA green
  success700: '#1D5C45',
  success600: '#1F9D5C',
  success400: '#4CC98A',

  // Text
  textPrimary: '#17251D',
  textOnDark: '#F7F4EC',
  textMuted: '#75806F',
  textMutedAlt: '#8A8470',
  textFaint: '#A9A794',

  // Borders/dividers
  border: '#E5E0D2',
  borderAlt: '#E0DACA',

  // Danger
  danger700: '#C0392B',
  danger500: '#D2483F',
  danger300: '#FF9A8D',

  // Category tags: [text, background]
  categoryGeneral: { text: '#5B6B5E', bg: '#EEEDE4' },
  categoryWater: { text: '#2E6E8E', bg: '#E4EFF5' },
  categoryEvent: { text: '#7B5EA7', bg: '#EFEAF7' },
  categoryBilling: { text: '#9A6B14', bg: '#F6ECD8' },
  categorySecurity: { text: '#1D5C45', bg: '#E9F1EC' },
} as const;

export const AdminDashboardTones = {
  green: { background: Colors.categorySecurity.bg, foreground: Colors.categorySecurity.text },
  gold: { background: Colors.categoryBilling.bg, foreground: Colors.categoryBilling.text },
  blue: { background: Colors.categoryWater.bg, foreground: Colors.categoryWater.text },
  purple: { background: Colors.categoryEvent.bg, foreground: Colors.categoryEvent.text },
  red: { background: '#F9E4E1', foreground: Colors.danger700 },
  neutral: { background: Colors.categoryGeneral.bg, foreground: Colors.categoryGeneral.text },
} as const;

export type AdminDashboardTone = keyof typeof AdminDashboardTones;

// Person-avatar background palette (residents/staff/bookings) — cycled
// deterministically by name, see commonFunctions#avatarColorForName.
export const AvatarPalette = ['#E7A33C', '#B9A7D6', '#8FB3C7', '#A7C4B5', '#D6C9A8', '#E0A9A0'] as const;

// complaints.category is freeform text (no DB enum) — this fixed set is the
// UI's own vocabulary, shared between the resident raise-complaint chips and
// the admin complaint list/triage labels.
export const ComplaintCategories = ['Plumbing', 'Electrical', 'Cleanliness', 'Security', 'Noise', 'Other'] as const;
export const COMPLAINT_ATTACHMENTS_BUCKET = 'complaint-attachments';
export const AMENITY_IMAGES_BUCKET = 'amenity-images';
export const AMENITY_IMAGE_MAX_COUNT = 4;
export const AMENITY_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const AMENITY_IMAGE_SIGNED_URL_SECONDS = 60 * 60;
export const AmenityBookingTypes = [
  { value: 'EXCLUSIVE', label: 'Exclusive', description: 'One booking reserves the entire slot.' },
  { value: 'SHARED', label: 'Shared', description: 'Multiple residents can book until capacity is reached.' },
] as const;
export const AmenitySlotDurations = [30, 60, 120] as const;
export const AMENITY_DEFAULT_SLOT_DURATION_MINUTES = 120;
export const AMENITY_DEFAULT_ADVANCE_BOOKING_DAYS = 7;
export const AMENITY_DEFAULT_DAILY_BOOKING_LIMIT = 1;
export const AMENITY_MAX_ADVANCE_BOOKING_DAYS = 90;
export const AMENITY_MAX_SHARED_CAPACITY = 100;
export const COMPLAINT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const AMENITY_MAX_DAILY_BOOKING_LIMIT = 20;
export const AmenityNotificationTypes = {
  decision: 'BOOKING_DECISION',
  maintenanceCancelled: 'BOOKING_MAINTENANCE_CANCELLED',
} as const;
export const COMPLAINT_ATTACHMENT_SIGNED_URL_SECONDS = 60 * 60;

export const ComplaintPriorities = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
] as const;

export const ComplaintStatuses = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
] as const;

export const AdminCommunityTabs = [
  { value: 'Towers', label: 'Towers' },
  { value: 'Flats', label: 'Flats' },
  { value: 'Residents', label: 'Residents' },
] as const;

export const NoticeCategories = [
  { value: 'GENERAL', label: 'General' },
  { value: 'WATER', label: 'Water' },
  { value: 'EVENT', label: 'Event' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'SECURITY', label: 'Security' },
] as const;

export const StaffRoles = ['Security', 'Housekeeping', 'Maintenance', 'Gardener', 'Other'] as const;
export const StaffShifts = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;
export const ServiceProviderCategories = ['Plumber', 'Electrician', 'Carpenter', 'Pest Control', 'Other'] as const;

export const VisitorCategoryOptions = [
  { value: 'GUEST', label: 'Guest' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'CAB', label: 'Cab' },
  { value: 'SERVICE', label: 'Service' },
] as const;

export const VisitorHistoryStatusOptions = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'ENTERED', label: 'Inside' },
  { value: 'EXITED', label: 'Exited' },
  { value: 'REJECTED', label: 'Denied' },
  { value: 'LEFT_AT_GATE', label: 'At gate' },
] as const;

export const VisitorHistoryRangeOptions = [
  { value: '7_DAYS', label: '7 days', days: 7 },
  { value: '30_DAYS', label: '30 days', days: 30 },
  { value: 'ALL_TIME', label: 'All time', days: null },
] as const;

export const GuardLogbookRangeOptions = [
  { value: 'TODAY', label: 'Today' },
  { value: 'MONTH', label: 'Month' },
  { value: '7_DAYS', label: '7 days' },
  { value: '30_DAYS', label: '30 days' },
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'ALL_TIME', label: 'All time' },
] as const;

export const GuardLogbookStateOptions = [
  { value: 'VISITS', label: 'All visits' },
  { value: 'INSIDE', label: 'Inside' },
  { value: 'EXITED', label: 'Exited' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Denied' },
  { value: 'ALL_REQUESTS', label: 'All requests' },
] as const;

export const ResidentHistoryRangeOptions = [
  { value: 'DAY', label: 'Selected day' },
  { value: '7_DAYS', label: 'Last 7 days' },
  { value: '30_DAYS', label: 'Last 30 days' },
  { value: 'MONTH', label: 'Month' },
  { value: 'CUSTOM', label: 'Custom dates' },
] as const;

export const ResidentHistoryStateOptions = [
  { value: 'VISITS', label: 'All visits' },
  { value: 'INSIDE', label: 'Inside now' },
  { value: 'EXITED', label: 'Exited' },
] as const;

export const CalendarMonthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const RESIDENT_HISTORY_QUICK_DAY_COUNT = 7;

export const DEFAULT_GUARD_LOGBOOK_FILTERS = {
  range: 'TODAY',
  state: 'VISITS',
  category: 'ALL',
  towerId: null,
  flatId: null,
  customFrom: '',
  customTo: '',
  month: '',
  locationLabel: 'Entire society',
} as const;

export const VisitorVehicleTypeOptions = [
  { value: 'CAR', label: 'Car' },
  { value: 'TWO_WHEELER', label: 'Two-wheeler' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type VisitorVehicleType = (typeof VisitorVehicleTypeOptions)[number]['value'];

export const VisitorCategoryFilterOptions = [
  { value: 'ALL', label: 'All types' },
  ...VisitorCategoryOptions,
] as const;

export const VISITOR_LOGBOOK_PAGE_SIZE = 25;
export const LOGBOOK_LOCATION_SEARCH_LIMIT = 20;
export const LOGBOOK_LOCATION_SEARCH_DEBOUNCE_MS = 300;

export const AUTH_RESEND_SECONDS = 30;
export const ONBOARDING_COMPLETE_STORAGE_KEY = 'agora:onboarding-complete';

export const AuthRoutes = {
  login: '/(auth)/login',
  onboarding: '/(auth)/onboarding',
} as const;

export const QueryKeyRoots = {
  amenities: 'amenities',
  auditEvents: 'audit-events',
  complaints: 'complaints',
  complaintAttachment: 'complaint-attachment',
  directory: 'directory',
  dues: 'dues',
  flats: 'flats',
  guardResidentSearch: 'guard-resident-search',
  notices: 'notices',
  polls: 'polls',
  profile: 'profile',
  resident: 'resident',
  residents: 'residents',
  towers: 'towers',
  visitorLogbook: 'visitor-logbook',
  visitorLogbookLocations: 'visitor-logbook-locations',
  visitorRequests: 'visitor-requests',
} as const;

export type QueryKeyRoot = (typeof QueryKeyRoots)[keyof typeof QueryKeyRoots];

export const FontFamily = {
  headingExtraLight: 'BricolageGrotesque_200ExtraLight',
  headingLight: 'BricolageGrotesque_300Light',
  headingRegular: 'BricolageGrotesque_400Regular',
  headingMedium: 'BricolageGrotesque_500Medium',
  headingSemiBold: 'BricolageGrotesque_600SemiBold',
  headingBold: 'BricolageGrotesque_700Bold',
  headingExtraBold: 'BricolageGrotesque_800ExtraBold',
  bodyRegular: 'SchibstedGrotesk_400Regular',
  bodyMedium: 'SchibstedGrotesk_500Medium',
  bodySemiBold: 'SchibstedGrotesk_600SemiBold',
  bodyBold: 'SchibstedGrotesk_700Bold',
} as const;

// Cards 16-24px, buttons/inputs 14-18px, pills/avatars 999px
export const Radius = {
  input: 14,
  button: 16,
  card: 20,
  cardLarge: 24,
  pill: 999,
} as const;

export const Easing = {
  standard: [0.2, 0.9, 0.3, 1.4] as const, // bounce, used for popIn/fadeUp
};

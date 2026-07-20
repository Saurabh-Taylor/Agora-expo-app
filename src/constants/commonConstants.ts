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

// Person-avatar background palette (residents/staff/bookings) — cycled
// deterministically by name, see commonFunctions#avatarColorForName.
export const AvatarPalette = ['#E7A33C', '#B9A7D6', '#8FB3C7', '#A7C4B5', '#D6C9A8', '#E0A9A0'] as const;

// complaints.category is freeform text (no DB enum) — this fixed set is the
// UI's own vocabulary, shared between the resident raise-complaint chips and
// the admin complaint list/triage labels.
export const ComplaintCategories = ['Plumbing', 'Electrical', 'Cleanliness', 'Security', 'Noise', 'Other'] as const;

export const AUTH_RESEND_SECONDS = 30;

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

// Overline labels: 10-12px, uppercase, letter-spacing 0.14-0.22em, weight 700
export const OverlineText = {
  fontSize: 11,
  letterSpacing: 2, // ~0.18em at 11px
  fontWeight: '700',
  textTransform: 'uppercase',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 40,
} as const;

// Cards 16-24px, buttons/inputs 14-18px, pills/avatars 999px
export const Radius = {
  input: 14,
  button: 16,
  card: 20,
  cardLarge: 24,
  pill: 999,
} as const;

export const AnimationDuration = {
  fast: 300,
  medium: 450,
  slow: 600,
} as const;

export const Easing = {
  standard: [0.2, 0.9, 0.3, 1.4] as const, // bounce, used for popIn/fadeUp
};

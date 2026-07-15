# Handoff: Agora Society Management App

## Overview
Agora is a society/apartment-complex management product with two apps: a **Resident app** (gate approvals, community feed, maintenance dues) and a **Society Admin app** (residents, notices, complaints, operations). This bundle contains HTML prototypes for both, built as interactive click-through mockups.

## About the design files
The files in `design-files/` are **HTML/CSS/JS design references** — high-fidelity prototypes showing exact look, copy, and behavior. They are NOT production code and are not React/React Native. Your job is to **recreate these designs natively in Expo SDK 57 / React Native**, using RN primitives and idiomatic patterns (not a WebView embed of the HTML).

Each `.dc.html` file is self-contained: every element is inline-styled with exact px/hex values, so treat them as the pixel-precise source of truth — open them in a browser or read the source for exact colors, spacing, and copy per screen rather than relying on this README's summaries alone.

## Fidelity
**High-fidelity.** Colors, type, spacing, copy, and states are final — recreate pixel-precisely, not just structurally.

## Suggested Expo SDK 57 stack
- **Navigation**: `expo-router` (file-based). Model each `sc-if` "screen" in the DC's state machine as a route; the tab bar in the main app screens (Home / Gate / Community / Pay for Resident, Home / Community / Operations / Communication / More for Admin) maps to a `(tabs)` layout group.
- **Icons**: every icon is inline SVG in the source — port with `react-native-svg` (`Svg`, `Path`, etc.), keeping the exact path data and stroke/fill values.
- **Fonts**: `Bricolage Grotesque` (weights 500/600/700/800, headings) and `Schibsted Grotesk` (weights 400–700, body/UI) via `expo-font` + `@expo-google-fonts/bricolage-grotesque` and `@expo-google-fonts/schibsted-grotesk`.
- **Animation**: `react-native-reanimated` for the pulse/fade/pop/slide-down keyframes (see Interactions below).
- **Persistence**: `@react-native-async-storage/async-storage` for session/login state; local `useState`/`useReducer` for everything else.
- **Images**: the 5 photos in `assets/` are `Image`/`expo-image` sources; the device frame (`ios-frame.jsx`) and image-slot placeholder component are prototype-only scaffolding — do not port them, they have no RN equivalent and no purpose in a native app.

## Files
| File | Contents |
|---|---|
| `design-files/Agora.dc.html` | **Primary Resident app** — full flow: splash → onboarding (4 slides) → login (password/OTP) → main app (home, gate log, community, notices, visitor approval, preapprove, gate pass, dues/payments). Most complete version — build from this one. |
| `design-files/Agora Admin.dc.html` | **Admin app** — home dashboard, community/towers/residents management, add resident, notices + compose, complaints + triage, more/modules. |
| `design-files/Agora Login.dc.html` | Standalone login screen (earlier iteration, subset of Agora.dc.html's login phase). |
| `design-files/Agora Onboarding.dc.html` | Standalone onboarding carousel (earlier iteration; slides 3–4 use card mockups instead of illustrations, unlike the version embedded in Agora.dc.html). |
| `design-files/Portl Visitor Approval.dc.html` | Standalone resident home + visitor-approval flow (earlier iteration, superseded by the app phase in Agora.dc.html). |
| `design-files/assets/*.png` | Onboarding/login illustrations. `approve-resident-night.png` is unused in all current screens — a spare/marketing illustration, not required for any screen. |

Build the **Resident app from `Agora.dc.html`** and the **Admin app from `Agora Admin.dc.html`**; treat the other three as reference only if a screen there differs from the merged version.

## Screen flow / state machine

### Resident app (`Agora.dc.html`)
Single top-level `phase` state: `splash → onboarding → login → app`.
- **Splash**: centered logo mark + wordmark, 3-dot loader, auto-advances after 2.3s or on tap.
- **Onboarding**: horizontal 4-slide carousel (`translateX` paging), skip link, progress dots, "Get started" on last slide. Slides: (1) Welcome/hero-gate-night.png, (2) "Approve visitors in a tap"/slide2-hologram.png with a live gate-request card mock, (3) "Your community, in one place"/slide3-community.png, (4) "Dues, minus the hassle"/slide4-dues.png.
- **Login**: toggle between **password** and **OTP** auth mode. Password mode: identifier + password fields, show/hide password, "Forgot password?". OTP mode: send code → 6-cell code input → resend timer (30s) → verify. Both show a busy/spinner state on submit.
- **App** (bottom tabs: Home, Gate, Community, Pay):
  - **Home**: incoming-visitor card (when a gate request is ringing) OR "all quiet" card OR last-decision summary; quick actions (pre-approve, gate log); dues-due banner; recent activity list (3 items).
  - **Gate log**: filter chips (All/Delivery/Guest/Service) + full activity list.
  - **Community**: segmented Notices/Polls. Notices: pinned notice + list → notice detail. Polls: active poll (tap to vote, animates result bars) + closed poll results.
  - **Visitor request**: full-screen incoming-visitor profile with Deny/Approve (+ "leave at gate" for deliveries) → **Decision** confirmation screen.
  - **Pre-approve**: guest name + type/when/time-window chips → creates a **Gate pass** (6-digit code) screen.
  - **Dues**: current quarter due card + breakup + payment history → **Payment** (method chips) → **Payment success** (receipt).
  - Shared: a slide-down "X is at the gate" banner appears over any app screen while a request is ringing; toast messages confirm actions (forgot password, OTP resent, vote recorded, pass copied, etc.).

### Admin app (`Agora Admin.dc.html`)
Single top-level `screen` state (no tab persistence beyond bottom nav):
- **Home**: header (logo, bell w/ unread badge, avatar), greeting, priority-actions card (verifications/complaints/approvals counts), 2×2 overview stat grid, quick-actions grid (Add resident, Publish notice, Create poll, Add complaint, Add staff, Manage amenity, View reports, More), today's operations, recent activity.
- **Community**: Towers/Flats/Residents tabs; tower list with occupancy ring → tower detail (stats + resident list) → **Add resident** form (photo, name, tower chips, flat/phone, occupancy type, "mark verified" toggle).
- **Notices**: list (category + published/scheduled state) + floating compose button → **Compose notice** (title, message, category chips, audience chips, now/schedule).
- **Complaints**: filter chips + list (priority dot, status pill) → **Triage detail** (priority, assignee, status, save).
- **More**: grid of admin modules.

## Interactions & animation reference
- `popIn`: scale 0.5→1 + fade, cubic-bezier bounce — splash logo, decision icon, gate-pass success icon.
- `fadeUp` / `agFade`: translateY(10–14px)→0 + fade — screen-enter transitions, toasts.
- `slideDown`: translateY(-90px)→0 — incoming-visitor banner.
- `ringPulse` / `agPulse`: box-shadow ring expanding and fading — live "waiting at gate" avatar.
- `dotPulse` / `agDot`: opacity 1↔0.4 loop — "live" status dots, splash loader.
- `spin` / `agSpin`: 360° rotation — button loading spinners.
All at 0.3–0.6s, ease/cubic-bezier(0.2,0.9,0.3,1.4) for bounces.

## Design tokens

**Colors**
- Backgrounds: `#EDE7DA` (page/app canvas), `#F4EFE3` (admin canvas/cards)
- Deep green (dark surfaces/headers): `#0F2C1F`, `#123528`, `#10261B`, `#0A1F16`, `#0B1C13`, `#091810`
- Accent gold (primary CTA/brand): `#E7A33C`, hover `#F0B04E`; logo gradient `#F3B75B → #D0871F`
- Success/CTA green: `#1D5C45`, `#1F9D5C`, `#4CC98A`
- Text: primary `#17251D` / `#F7F4EC` (on dark); muted `#75806F`, `#8A8470`, `#A9A794`
- Borders/dividers: `#E5E0D2`, `#E0DACA`
- Danger: `#C0392B`, `#D2483F`, `#FF9A8D`
- Category tags: Water `#2E6E8E` on `#E4EFF5` · Event `#7B5EA7` on `#EFEAF7` · Billing `#9A6B14` on `#F6ECD8` · Security `#1D5C45` on `#E9F1EC`

**Typography**
- Headings/numerals: Bricolage Grotesque, 700–800
- Body/UI/labels: Schibsted Grotesk, 400–700
- Overline labels: 10–12px, uppercase, letter-spacing 0.14–0.22em, weight 700

**Radius / shape**: cards 16–24px, buttons/inputs 14–18px, pills/avatars 999px.

## State management
Each DC is one component with local state (phase/screen enums, form field values, toggles, timers). Port 1:1 to RN: a root navigator holding `phase`, per-screen `useState` for form fields, and `setTimeout`/`setInterval`-driven demo behavior (auto-ring after N seconds, OTP resend countdown, payment processing delay) — replace these with real API calls in production but keep the same UI states (idle/busy/success/error).

## Assets
5 illustrations in `design-files/assets/` (see Files table). All icons are inline SVG in the HTML — no icon font/library dependency to install, just port the paths.

## Integrating via Claude Code CLI
1. Copy `design_handoff_agora_app/` into your Expo project's repo root.
2. From the project root, run `claude` to start Claude Code CLI.
3. Point it at this package and work **one screen/flow at a time** rather than the whole app in one shot, e.g.:
   > Read `design_handoff_agora_app/README.md`, then `design_handoff_agora_app/design-files/Agora.dc.html`. Set up expo-router with a splash → onboarding → login → (tabs) structure matching the phases described, using our existing project conventions. Start with the splash and onboarding screens only, pixel-matching the HTML's colors/type/spacing/copy.
4. Repeat per flow (login → home → gate/visitor-approval → community → dues/payments → admin app), asking Claude Code to reference the matching section of the HTML each time so it pulls exact values instead of approximating.

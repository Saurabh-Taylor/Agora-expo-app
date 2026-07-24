# Agora

Agora is a phone-first apartment society management app built for the ChaiCode and Masterji Mobile Dev Hackathon (July 12-26, 2026).

It replaces gate calls, paper registers, and fragmented WhatsApp coordination with three isolated mobile experiences:

- Resident: visitor approvals and pre-approvals, notices, polls, complaints, amenities, visitor history, maintenance dues, own vehicles/parking, society documents, and the active society directory.
- Security Guard: resident lookup, visitor registration, approval verification, QR scanning, entry/exit, a live digital logbook, parking lookup, society documents, and assigned operational tasks.
- Society Admin: towers, flats, household members, guard accounts, notices, polls, complaints, amenities, maintenance billing, parking/vehicle assignments, society documents, daily tasks, staff, providers, audit records, and read-only visitor history.

The hero journey is a tracked visitor lifecycle: Guard request -> Resident decision -> Guard verification -> Entry -> Exit.

## Stack

- Expo 57 and React Native 0.86
- Expo Router role groups and protected routes
- Supabase Auth, Postgres, RLS, Realtime, Storage, and Edge Functions
- TanStack Query for server state
- Zustand for client-only session/UI state
- Expo Notifications, Camera, SecureStore, and Image modules
- Sentry React Native integration
- pgTAP database security tests and GitHub Actions quality gates

See [Architecture](docs/ARCHITECTURE.md), [Feature and role tracker](docs/FEATURE_IMPLEMENTATION_TRACKER.md), [Judge demo script](docs/DEMO_SCRIPT.md), and [AGENTS.md](AGENTS.md).

## Local setup

Prerequisites:

- Node.js 20 or later
- Bun 1.3.8 or a compatible package manager
- Docker-compatible runtime for local Supabase
- Android/iOS device or emulator supported by Expo

```bash
cp .env.example .env
bun install --frozen-lockfile
./node_modules/.bin/supabase start
bun start
```

Required public client variables:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Optional Sentry runtime reporting:

```dotenv
EXPO_PUBLIC_SENTRY_DSN=
```

`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` are private build/CI values. Never prefix them with `EXPO_PUBLIC_` or commit real values.

## Quality gates

```bash
bun run typecheck
bun run lint
npx expo-doctor
./node_modules/.bin/supabase db reset --local
./node_modules/.bin/supabase test db
bun run export:android
```

Latest local verification on July 24, 2026:

- 21 database suites and 504 pgTAP assertions passed
- TypeScript passed
- full ESLint passed
- Expo Doctor passed 20/20 checks
- Android production export passed

CI repeats the app and database gates for feature branches, fixes, pull requests, and `main`.

## Demo payments

The resident payment flow uses Razorpay Standard Checkout in **Test Mode**. Agora creates the order in an authenticated Supabase Edge Function, opens a short-lived hosted checkout, verifies the returned HMAC signature and captured payment against Razorpay server-to-server, and only then records an idempotent `RAZORPAY_TEST` payment. No real money is transferred and the receipt is not proof of payment.

Configure only Test Mode credentials and enable automatic capture in the Razorpay Dashboard:

```bash
bunx supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx
bunx supabase functions deploy razorpay-create-order
bunx supabase functions deploy razorpay-checkout --no-verify-jwt
bunx supabase functions deploy razorpay-verify-payment
```

The Key Secret is server-only. Never put it in `EXPO_PUBLIC_*`, `.env` committed to Git, app code, or screenshots. A signed webhook for `order.paid`, `payment.captured`, and `payment.failed` remains the post-demo reliability step; a client callback is never authoritative.

## Demo accounts

Demo-only Resident, Guard, and Admin accounts must be created in the selected hosted Supabase project before submission. Working hosted credentials are not committed or invented in this repository.

| Role | Email | Password | Status |
| --- | --- | --- | --- |
| Resident | To be provisioned | To be provisioned | Required before submission |
| Guard | To be provisioned | To be provisioned | Required before submission |
| Admin | To be provisioned | To be provisioned | Required before submission |

After provisioning, replace only this table with the demo-only values. Never publish production credentials or a Supabase service-role key.

## Release dependencies

- Deploy all pending Supabase migrations and Edge Functions.
- Supply Razorpay Test Key ID/Secret, enable automatic capture, and run one sandbox payment.
- Configure EAS push credentials and test foreground/background/terminated delivery on physical phones.
- Supply Sentry DSN/build secrets and confirm source-map upload.
- Produce and install the preview APK.
- Capture final screenshots and the three-role demo video.
- Add the working demo-only credentials above.

## Submission checklist

- [ ] Public GitHub repository
- [ ] Installable preview APK
- [ ] Demo video
- [x] Setup and architecture documentation
- [ ] Final application screenshots
- [ ] Working Resident, Guard, and Admin demo credentials

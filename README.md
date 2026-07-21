# Agora

Agora is a mobile-first society (apartment community) management app being built for the **ChaiCode × Masterji Mobile Dev Hackathon**, running **July 12–26, 2026**.

> The conversations that used to happen at the society gate should now happen inside one community app.

## Product scope

Agora is designed around three strictly separated roles:

- **Resident:** approve or pre-approve visitors, view notices, vote in polls, raise complaints, book amenities, review visitor history, pay maintenance dues, and view the staff/service directory.
- **Security Guard:** register visitors, request and verify approvals, record entry and exit, search residents, and monitor society movement.
- **Society Admin:** manage towers, flats, residents, security-guard accounts, amenities, notices, polls, complaints, maintenance invoices, staff, and service providers, and view read-only society visitor history.

The primary workflow is fast visitor approval: a guard raises a request, the resident approves or rejects it in the app, and the guard records the visitor's entry and exit. Authorized push-notification paths are implemented for time-sensitive workflows and await final physical-device validation.

## Selected stack

- Expo and React Native
- Expo Router
- Supabase
- TanStack Query
- Zustand
- Expo Notifications

## Current status

Agora is in active feature implementation. Authentication/RBAC, society administration,
visitor workflows, community features, amenities, resident dues, and admin directories
now have real Supabase-backed paths. Device validation, final UX polish, demo credentials,
and submission artifacts remain in progress.

See the living [feature and role tracker](docs/FEATURE_IMPLEMENTATION_TRACKER.md) for
role permissions, implementation evidence, known limitations, and remaining work.

See [AGENTS.md](AGENTS.md) for the repository product/agent contract, including the intended scope, role rules, build order, and delivery criteria.

## Local setup

Prerequisites: Node.js, npm, and a phone or simulator supported by Expo.

```bash
npm install
npm start
```

Other available commands:

```bash
npm run android
npm run ios
npm run lint
```

## Submission checklist

- [ ] Public GitHub repository
- [ ] Expo project or APK
- [ ] Demo video
- [ ] Setup instructions finalized
- [ ] Application screenshots
- [ ] Demo credentials for resident, guard, and admin

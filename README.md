# Agora

Agora is a mobile-first society (apartment community) management app being built for the **ChaiCode × Masterji Mobile Dev Hackathon**, running **July 12–26, 2026**.

> The conversations that used to happen at the society gate should now happen inside one community app.

## Product scope

Agora is designed around three strictly separated roles:

- **Resident:** approve or pre-approve visitors, view notices, vote in polls, raise complaints, book amenities, review visitor history, and pay maintenance dues.
- **Security Guard:** register visitors, request and verify approvals, record entry and exit, search residents, and monitor society movement.
- **Society Admin:** manage towers, flats, residents, amenities, notices, polls, complaints, staff, and service providers.

The primary workflow is fast visitor approval: a guard raises a request, the resident approves or rejects it in the app, and the guard records the visitor's entry and exit. Push notifications are planned where they reduce delay in time-sensitive workflows.

## Selected stack

- Expo and React Native
- Expo Router
- Supabase
- TanStack Query
- Zustand
- Expo Notifications

## Current status

This repository is currently at the **project foundation / Expo starter** stage. The planned product features, backend integration, authentication and role-based access control, demo credentials, screenshots, and distributable builds are not yet available.

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

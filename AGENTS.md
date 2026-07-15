# AGENTS.md

Guidance for AI assistants and developers working in this repository. This file is the
single source of truth for product scope, role permissions, architecture, implementation
rules, build order, and acceptance criteria.

## Project Overview

**Agora** is a mobile-first society/apartment management app built with Expo and React Native.

### Problem

Apartment communities currently coordinate through gate calls, WhatsApp groups, paper
registers, and manual approvals. A delivery partner arrives, the guard calls the flat,
the resident misses the call, and the visitor waits — a pattern repeated across every
guest approval, complaint, notice, poll, and maintenance payment in the community. These
disconnected, manual workflows don't scale and create friction for residents, guards, and
admins alike.

### Solution

Agora consolidates the society gate, resident communication, and community operations
into a single app with three role-based experiences:

- **Resident** — approve/pre-approve visitors, raise and track helpdesk complaints,
  book amenities, view notices, vote in polls, pay maintenance dues
- **Security Guard** — register visitors, request approvals, verify approvals, log
  entry/exit in real time
- **Society Admin** — manage towers, flats, residents, staff, service providers,
  amenities, notices, polls, and complaints from a centralized dashboard

Core idea: the conversations that used to happen at the society gate now happen inside
the app — replacing manual, call-based coordination with fast, trackable, role-based
workflows.

## Mandatory Product Guardrails

| Concern | Required choice |
| --- | --- |
| Framework | Expo + React Native using the Expo-managed workflow |
| Primary platform | Phone-first mobile app, not a responsive web app |
| Navigation | expo-router with role-specific route groups and guards |
| Backend and database | Supabase only: Auth, Postgres, RLS, Realtime, and Edge Functions when server execution is needed |
| Server state | TanStack Query for remote data, caching, mutations, invalidation, and async states |
| Client state | Zustand for genuinely client-only app and shared UI state |
| Notifications | expo-notifications with securely authorized server-side sends |

- The product name is **Agora**. It is a solo ChaiCode × Masterji Mobile Dev Hackathon
  entry with a submission deadline of **July 26, 2026**.
- Do not introduce bare React Native CLI, Flutter, a web-first framework, or a competing
  backend. Tablet and landscape support are optional and must not drive phone layouts.
- Prefer Expo-managed modules such as expo-router, expo-notifications, and expo-image
  when applicable.
- Supabase remains the source of truth for authentication and domain data. TanStack Query
  owns server data; do not copy server collections into Zustand. Use Zustand only for
  small client concerns such as auth-derived app context, transient filters, and shared
  UI state.
- Prefer the implementation that makes resident approval or rejection faster and
  requires fewer taps.

## Authentication and Authorization

Secure authentication is required through Supabase Auth.

- The authenticated session must persist across app restarts using an Expo-compatible,
  protected persistence mechanism. No particular package, including expo-secure-store,
  is mandated.
- Never store passwords, access tokens, refresh tokens, or other credentials in
  plaintext.
- The backend-authoritative profile contains role, societyId, and flatId when applicable.
  Never trust role, society, flat ownership, or other authorization data supplied by the
  client.
- Expired or revoked sessions must clear protected state and return the user to sign-in
  with a useful message.
- Demo-only accounts for Resident, Guard, and Admin must exist and be documented in the
  README. Never expose production credentials.
- Enforce the same authorization model in navigation and on the backend. Hiding a route,
  screen, or button is not authorization; Supabase RLS plus checks in every Edge Function
  or database function must enforce access.

## Roles and Permission Boundaries

Agora has exactly three roles: RESIDENT, GUARD, and ADMIN. Each has a separate dashboard
and route tree and can enter only its own workflows. Every feature change must explicitly
account for all three roles.

| Capability | Resident (RESIDENT) | Security Guard (GUARD) | Society Admin (ADMIN) |
| --- | --- | --- | --- |
| Society structure | Uses own assigned flat context; cannot manage records | Searches only resident/flat data needed for visitor routing | Manages towers, flats, and residents in own society |
| Visitor approvals | Receives and approves/rejects own-flat requests; creates pre-approvals | Registers visitors, raises requests, verifies decisions, and marks entry/exit | No operational visitor workflow in current scope |
| Visitor records | Views own flat's visitor history | Views society visitor history and real-time movement log for guard duties | No visitor-log UI required in current scope |
| Notices | Views published notices | No notice workflow | Creates and manages notices |
| Polls | Views published polls and votes when eligible | No poll workflow | Creates and manages polls and results |
| Complaints | Raises complaints and tracks own timeline | No complaint workflow | Views, manages, and updates society complaints |
| Amenities | Views amenities, books them, and views own bookings | No amenity workflow | Manages amenities and society bookings |
| Maintenance dues | Views and pays own dues | No dues workflow | No dues-management UI required in current scope |
| Staff and service providers | No management workflow | No directory-management workflow; service visitors use visitor flows | Manages staff and service-provider records |

Residents are further restricted to records they own or are eligible to access, including
their own flatId, visitor requests, bookings, complaints, votes, and dues. Guards may
access only the society data needed for guard operations. Admins may manage only records
belonging to their society. Admin status does not grant resident approval or guard
entry/exit actions.

## Tenant Isolation: the societyId Invariant

Every application/domain record is scoped to a non-null societyId. **Never write a domain
query without a society filter.**

- Store societyId on every domain table, including child records even when it can be
  derived through a parent.
- Include the authenticated society scope in every select, insert, update, delete,
  Realtime subscription, storage path, server-side job, and notification audience.
- Derive or validate the permitted society, role, and ownership from the authenticated
  backend identity. Never authorize from client-provided identifiers alone.
- Enforce isolation with Supabase RLS on every client-accessible table and equivalent
  authorization in server operations.
- Validate that related records belong to the same society before creating or updating a
  relationship.
- Test denial of cross-society reads and writes for every new vertical slice.

Client-side filters improve query precision and provide defense in depth; they never
replace RLS.

## Required Feature Scope

### Visitor Management

Visitor approval is Agora's hero workflow and takes priority when implementation
tradeoffs arise.

- A guard registers a visitor and raises an entry request for a resident.
- The resident receives the request and approves or rejects it directly in the app.
- A resident can pre-approve a guest before arrival.
- Delivery partners, cabs, and service staff are supported visitor categories.
- A guard verifies the current approval and marks visitor entry and exit.
- Residents see visitor history for their own flat.
- Guards see society visitor history and a real-time movement log.
- The minimum lifecycle is PENDING -> APPROVED | REJECTED and
  APPROVED -> ENTERED -> EXITED. A pre-approval begins authorized but still requires
  guard verification plus explicit entry and exit timestamps.

Approval and rejection must be prominent, require the minimum reasonable taps, prevent
duplicate submission, and immediately show the resulting state. A notification tap must
deep-link to the relevant request when the current session and role permit access.

### Resident Community Management

The Resident dashboard includes:

- Published society notices
- Published polls and voting
- Helpdesk complaint creation
- Complaint status and timeline tracking
- Amenity discovery and booking
- Visitor history for the resident's own flat
- Maintenance dues and payment

Residents cannot access another flat's private data or society administration controls.

### Guard Operations

The Guard dashboard includes:

- Visitor registration
- Minimal resident search for routing an approval request
- Approval-request creation and verification
- Visitor entry and exit marking
- Visitor history
- A real-time society movement log

Guards cannot decide a resident's approval, manage community content, or enter another
role's dashboard.

### Society Admin Management

The Admin dashboard manages:

- Towers
- Flats
- Residents
- Amenities and society bookings
- Notices
- Polls and results
- Complaints
- Staff
- Service providers

Every admin action is restricted to the admin's society.

## Notifications and Real-time Behavior

Push notifications are required where they shorten a time-sensitive workflow. At
minimum:

- Notify the resident when a guard raises a visitor request.
- Notify the guard workflow when the resident approves or rejects that request.
- Notify a resident when a complaint status meaningfully changes.

Published notices may also notify eligible residents. Notifications must never reveal
data to a user who fails the current role, ownership, or society check. Treat a push
payload as a hint, not trusted state: opening it must refetch and reauthorize the record.

Denied permission, missing push tokens, and delivery failure must not block the core
workflow. In-app Realtime updates and a refreshable source-of-truth screen must remain
available. Realtime subscriptions enforce the same society and ownership boundaries as
normal queries.

## Mobile Experience Acceptance Criteria

These are graded functionality, not optional polish:

- Clean, phone-first navigation with a clear role-specific dashboard
- Prominent approve/deny actions requiring the minimum reasonable taps
- Layouts that work at common phone widths without clipped controls or horizontal
  scrolling
- A purposeful loading state for every asynchronous screen and list
- A truthful empty state for every list, with an appropriate next action when one exists
- Actionable handling for network/backend failures, expired sessions, invalid data, and
  denied device permissions
- Safe mutations that indicate in-flight state, prevent duplicate writes, and reconcile
  with the server result
- Accessible touch targets, readable text, and clear status feedback
- Real backend data or a truthful empty state; placeholder-only committed screens do not
  satisfy these instructions

## Data Model Baseline

The implementation may refine field names and supporting tables but must preserve these
relationships and tenancy boundaries:

    Society -> Towers -> Flats -> Residents
    Society -> Amenities -> Bookings
    Society -> Notices
    Society -> Polls -> Votes
    Society -> Complaints -> Status timeline
    Society -> Staff
    Society -> ServiceProviders
    Visitor -> VisitorRequest -> { status, approvedBy, entryAt, exitAt }
    User -> { role: RESIDENT | GUARD | ADMIN, societyId, flatId? }

All domain entities, including bookings, votes, complaint timeline entries, visitors,
and visitor requests, carry societyId. Resident-owned data also carries or resolves to
the authorized user and flat. Database constraints and RLS must preserve these
invariants.

## Vertical-slice Definition of Done

A feature is complete only when the entire slice exists and works together:

- Supabase schema/migration and a real data path
- Society-scoped query or mutation with backend role/ownership enforcement and RLS
- TanStack Query integration with correct mutation invalidation or refresh
- Zustand integration only when shared client/auth-derived UI state is actually needed
- Role-specific route and screen with navigation guards
- Phone-first interaction and real data rendering
- Loading, empty, success, and error states, including relevant session or permission
  failures
- Realtime and push behavior where useful, with an in-app fallback
- Verification of the allowed role, denied roles, ownership limits, and cross-society
  denial
- Applicable lint, format, build, and runtime checks

An endpoint without a usable screen, a screen backed by placeholders, or UI hiding
without backend authorization is not a completed feature.

## Required Build Order

Build vertical slices in this order unless a discovered dependency requires a small,
documented adjustment:

1. Auth, RBAC, and role-based routing shell
2. Admin management of towers, then flats, then residents
3. Guard visitor registration and approval-request creation
4. Resident request receipt, approve/deny, and push notification
5. Entry/exit marking, movement logs, and visitor history
6. Notices, then polls, then complaints
7. Amenity booking
8. Maintenance dues
9. Staff and service-provider directory
10. Polish pass for loading, empty, error, permission, and transition states
11. Submission artifacts: video, README, and screenshots

Prefer one complete, dependable slice over several incomplete slices.

## Coding Rules

These rules are mandatory when writing or modifying any code in this repository.

### Reusability & DRY (non-negotiable)

- **No code duplication anywhere in the codebase.** If the same logic exists in two
  places, it must be extracted. This is a hard rule, not a preference.
- Any function used in **2 or more places** must live in `commonFunctions.ts` and be
  imported where needed — never copy-pasted.
- Any fixed/hardcoded value (config, keys, labels, thresholds, enums, magic numbers/
  strings) used in more than one place must be defined in `commonConstants.ts` and
  referenced from there — no scattered literals.

### Simplicity

- Prefer the simplest solution that solves the problem. Readable, straightforward code
  beats clever or over-engineered code every time.
- Don't add abstraction, layers, or configuration for cases that don't exist yet.
- If a function is hard to name or understand at a glance, it's probably doing too much —
  split it.

### Naming & Structure

- Use clear, descriptive names for functions, variables, and files. Avoid abbreviations
  that aren't obvious.
- One responsibility per function; keep functions small and focused.
- Group related code together; keep the folder structure predictable so anyone can find
  things fast.

---

## Agent Preflight and Cross-Questions

Before implementation, explicitly answer:

1. Is the change inside the required scope and appropriate for the current build order?
2. What can each of RESIDENT, GUARD, and ADMIN view or do after the change?
3. Where do Supabase RLS/server checks enforce role, ownership, and societyId?
4. Does every record, query, mutation, subscription, storage path, and server job use the
   authenticated society scope?
5. Does the state belong in TanStack Query or is it genuinely client-only Zustand state?
6. Does the slice include backend, state, screen, navigation guard, and
   loading/empty/success/error behavior?
7. Can the resident approval path use fewer taps or reach the request more directly?
8. Is push or Realtime useful, and what is the in-app fallback when permission, delivery,
   or the network fails?
9. Does the layout work phone-first?
10. How will allowed access, denied roles, ownership, and cross-society isolation be
    verified?

Ask the repository owner before proceeding when:

- Role visibility, permission, ownership, or cross-society behavior is ambiguous or
  conflicts with these instructions.
- A change would add or prioritize out-of-scope product work, alter the selected
  architecture/backend, introduce a substantial dependency, or slow the approval flow.
- A schema or policy change is destructive or could expose existing data.
- Required secrets, external-service configuration, or submission facts cannot be
  discovered locally without inventing them.
- An acceptance criterion or submission requirement would change.

For low-risk implementation details that can be discovered from the repository, inspect
the code and make the smallest instruction-consistent assumption instead of blocking.

## Submission Deliverables

Track these throughout development:

- [ ] Public GitHub repository
- [ ] Expo project or installable APK
- [ ] Demo video
- [ ] README with setup instructions
- [ ] Application screenshots
- [ ] README demo credentials for Resident, Guard, and Admin

The submission is not complete until every item is checked and all three role journeys
can be demonstrated on a phone.

## Team & GitHub Conventions

### Branching

- Never commit directly to `main`. `main` must always be in a working, deployable state.
- Create a branch per feature/fix using a clear prefix:
  `feature/visitor-approval`, `fix/gate-log-crash`, `chore/deps-bump`.
- Keep branches short-lived — merge or close within a few days to avoid painful conflicts.

### Commits

- Write small, focused commits with meaningful messages (present tense):
  `add visitor pre-approval flow`, not `stuff` or `fixes`.
- Consider a light Conventional Commits style: `feat:`, `fix:`, `chore:`, `refactor:`,
  `docs:` — it makes history skimmable.

### Pull Requests

- All changes go through a PR — no direct merges, even for small fixes.
- External review is preferred when someone is available, but because this is a solo
  hackathon entry, reviewer approval must not block a merge or submission.
- Keep PRs small and single-purpose; a 200-line PR gets a real review, a 2,000-line one
  gets rubber-stamped.
- PR description should say **what** changed and **why**, and how to test it.
- Pull/rebase from `main` before opening a PR so it merges cleanly.

### Code Quality Gates

- Run the linter and formatter (e.g. ESLint + Prettier) before every commit — ideally
  automated with a pre-commit hook (Husky + lint-staged).
- Code must build and the app must run before a PR is opened. Don't push broken code to
  shared branches.
- No commented-out dead code and no leftover `console.log`s in merged code.

### Secrets & Config

- Never commit secrets, API keys, or `.env` files. Use `.env` locally and keep a
  committed `.env.example` documenting the required variables.
- Ensure `.gitignore` covers `node_modules/`, `.env`, build artifacts, and IDE files.

### Coordination

- Communicate before starting large or structural changes so two people don't rebuild
  the same thing (this directly supports the no-duplication rule).
- When you add something to `commonFunctions.ts` or `commonConstants.ts`, mention it in
  the PR so others reuse it instead of re-creating it.

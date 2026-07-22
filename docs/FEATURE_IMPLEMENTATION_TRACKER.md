# Agora Feature and Role Tracker

Last audited: July 22, 2026

This file tracks what each role may do and how far each vertical slice has been
implemented. `AGENTS.md` remains the product and authorization source of truth. Update
this tracker in the same change whenever a feature, permission, route, migration, test,
or known limitation changes.

## Status legend

| Status | Meaning |
| --- | --- |
| Complete | Backend enforcement, app data path, role UI, async states, and relevant automated checks exist. |
| Validate | The main implementation exists, but device/runtime validation or final polish remains. |
| In progress | Only part of the required vertical slice exists. |
| Planned | Required by scope but not implemented yet. |
| Not applicable | Intentionally unavailable to this role. |

`Complete` describes the repository implementation, not production deployment. A new
migration or Edge Function is not live until it has been deployed to the target Supabase
project.

## Role permission summary

### Resident

Residents may:

- use only their assigned society and flat context;
- receive, approve, reject, or mark `LEFT_AT_GATE` for their own-flat visitor requests;
- create visitor pre-approvals and view their own flat's visitor history;
- view published notices and eligible polls, and vote once per eligible poll;
- raise complaints and view their own complaint timeline;
- discover active amenities, book them, and view their own bookings;
- view and pay maintenance dues belonging to their own flat;
- view active own-society staff and service-provider directory entries read-only.

Residents may not:

- open guard or admin dashboards;
- view or act on another flat's private visitors, complaints, bookings, dues, or votes;
- register gate arrivals, verify approvals, or mark visitor entry and exit;
- manage towers, flats, residents, community content, amenities, staff, or providers;
- choose a client-supplied role, society, flat, decision actor, or payment owner.

### Security Guard

Guards may:

- use only their assigned society's guard dashboard;
- search a minimal resident directory containing active resident name and flat/tower IDs;
- register visitors and create pending requests for active residents in their society;
- verify the current resident decision and explicitly mark approved entry and entered exit;
- view society visitor history and the real-time movement log required for gate duties.

Guards may not:

- approve, reject, or otherwise decide a resident's visitor request;
- route a visitor to another society or create requests for inactive/unassigned residents;
- view full resident profiles or unrelated resident-private data;
- manage notices, polls, complaints, amenities, dues, staff, providers, towers, or flats;
- open resident or admin dashboards.

### Society Admin

Admins may manage, within their own society:

- towers, flats, and residents;
- security-guard accounts;
- read-only society visitor history;
- amenities and society amenity bookings;
- notices;
- polls and poll results;
- complaints and complaint status timelines;
- staff and service providers;
- maintenance invoices, payment tracking, reminders, and reports;
- authorized audit records exposed by the admin workflow.

Admins may not:

- open resident or guard dashboards;
- approve or reject resident visitor requests;
- register gate visitors or mark visitor entry and exit;
- use admin status to access another society;
- access another flat's private resident workflow merely because they are an admin;
- perform resident payment actions or access another society's maintenance records.

## Feature implementation matrix

| ID | Feature | Resident | Guard | Admin | Status | Implementation evidence | Remaining work |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Supabase authentication and persisted session | Sign in and recover own account | Sign in and recover own account | Sign in and recover own account | Complete | Auth routes, protected persistence, profile query, root routing shell, normalized email handling, keyboard-safe Login, and exact password preservation | Keep demo credentials out of production config |
| AUTH-02 | Backend-authoritative role routing | Resident routes only | Guard routes only | Admin routes only | Complete | Root layout plus role-specific layouts and backend profile role | Re-test all three journeys before submission |
| AUTH-03 | Forgot/reset/change password | Allowed for own account | Allowed for own account | Allowed for own account | Complete | Forgot-password, reset-password, and change-password routes | Validate email deep links in release build |
| AUTH-04 | Security-guard account management | No access | Use own account only | Create, view, activate, and deactivate own-society guard accounts | Planned | Scope approved on July 21, 2026 | Implement secure server provisioning, admin UI, RLS/server checks, and tests |
| STR-01 | Tower management | View own tower context only | No management | Create, view, edit, delete own-society towers | Complete | Admin tower routes, tower API, tower migration and pgTAP tests | None currently |
| STR-02 | Flat management | Use assigned flat only | Minimal routing lookup only | Create, view, edit, delete own-society flats | Complete | Admin flat routes, flat API, flat migration and pgTAP tests | None currently |
| STR-03 | Resident management | Own profile/flat context | Minimal projected search only | Create, view, activate/deactivate, and assign residents | Complete | Resident admin routes, resident API, resident migration and tests | None currently |
| VIS-01 | Guard resident search | No directory access | Search active residents in own society | No guard-directory access | Complete | `search_guard_residents` RPC returns only name/flat/tower projection; atomic visitor pgTAP tests | Deploy latest migration remotely |
| VIS-02 | Register visitor and request approval | Receive own-flat request | Create pending request | No operational visitor action | Complete | Guard registration screen and atomic `create_guard_visitor_request` RPC | Deploy latest migration remotely |
| VIS-03 | Resident approve/deny | Decide own pending request | Observe decision only | No operational visitor action | Complete | Resident request/detail/decision screens, checked decision RPC and visitor RBAC tests | Device-test notification deep link |
| VIS-04 | Resident pre-approval | Create, reopen, share, and revoke own-flat 24-hour passes | Verify an indexed active code in own society | No operational visitor action | Complete | Collision-safe six-digit code RPC, active-code unique index, cached guard lookup, expiry/revoke UI, and pgTAP tests | Deploy the two pending gate-pass migrations remotely |
| VIS-05 | Entry and exit | View resulting state/history | Mark approved entry and entered exit | No operational visitor action | Complete | Guard verification screen, movement log, checked entry/exit RPCs and tests | Device-test rapid repeated taps |
| VIS-06 | Visitor history and guard logbook | Searchable, paginated own-flat digital register with recent-day, month, custom-date, state, and type filters | Read-only own-society Live register plus searchable, paginated monthly Logbook | Read-only own-society history | Complete | Dedicated resident ownership-derived cursor RPC and Gate register; Guard Live/Logbook modes; server filters; existing indexed cursors; Realtime refresh; and pgTAP tests | Push the pending history migrations and complete final physical-device visual check |
| COM-01 | Notices | View published own-society notices | No notice workflow | Create, publish, view, archive/manage notices | Complete | Atomic notice publishing, screens/API, RLS tests, Realtime invalidation, and pull-to-refresh | Device-test published-notice push if enabled |
| COM-02 | Polls | View eligible polls, vote once, view permitted results | No poll workflow | Create, close/archive, and view society results | Complete | Poll screens/API, poll migration and pgTAP tests | Final empty-state copy review |
| COM-03 | Complaints | Create and track own complaint/timeline | No complaint workflow | View society complaints and update status/timeline | Complete | Complaint screens/API, complaint migration and tests | Device-test complaint-status notification |
| COM-04 | Complaint photo evidence | Optionally take or choose one image and view it securely | No complaint or attachment access | View same-society complaint evidence read-only | Validate | Private Storage bucket, scoped RLS, attachment RPC, picker and viewer | Push migration; device-test camera, gallery, upload and signed viewing |
| AMN-01 | Amenity management | View active amenities | No amenity workflow | Create, edit, activate/deactivate amenities | Complete | Admin amenity routes/API, amenity migration and tests | None currently |
| AMN-02 | Amenity booking | Create/cancel/view own bookings | No booking workflow | View and manage society bookings | Complete | Resident booking routes, admin detail, checked booking RPCs and tests | Validate concurrent-slot behavior on device |
| DUE-01 | Maintenance dues | View own-flat dues | No dues workflow | Manage own-society invoices and due records | In progress | Resident dues screen, society/flat RLS and dues pgTAP tests | Add admin invoice creation, paid/unpaid tracking, and management UI |
| DUE-02 | Maintenance payment | Record payment against own unpaid due | No payment workflow | Track own-society payments and reports | In progress | Payment screen/success route and checked payment RPC | Add admin payment reporting; production payment-gateway settlement remains optional |
| DUE-03 | Maintenance reminders and reports | Receive own-due reminders | No access | Send reminders and view/export own-society reports | Planned | Scope approved on July 21, 2026 | Implement authorized reminder audience, reporting UI, export, and tests |
| DUE-04 | Optional downloadable receipts | May download/share own receipt | No access | No resident payment action; reports remain admin-scoped | Optional | Explicitly classified optional on July 21, 2026 | Implement only after required scope and release gates |
| DIR-01 | Staff directory management | No directory-management workflow | No directory-management workflow | Create, view, edit, activate/deactivate staff | Complete | Staff routes/API, directory migration and tests | None currently |
| DIR-02 | Service-provider management | No directory-management workflow | Use providers only through visitor category flows | Create, view, edit, activate/deactivate providers | Complete | Provider routes/API, directory migration and tests | None currently |
| DIR-03 | Resident staff/service directory | Read-only active own-society directory | No directory access | Manage source records | Planned | Scope approved on July 21, 2026 | Add resident query/screen, RLS, loading/empty/error states, and isolation tests |
| VIS-07 | Optional vehicle metadata | Adds a vehicle type and registration number to a pre-approval | Captures optional vehicle details during registration and verifies them at entry | Read-only vehicle details in visitor history | Complete | Visit-scoped columns; normalized atomic RPC inputs; shared phone form; resident pass/request/history, guard verification/Logbook, and admin history rendering; pgTAP coverage | Push the vehicle migration and complete a physical-device form check; purpose and photos remain optional and out of this slice |
| AUD-01 | Audit trail | No access | No access | View authorized own-society audit records | Complete | Admin audit route, audit query and society-scoped RLS | Expand event coverage only when new mutations require it |
| NTF-01 | Visitor-request push | Receive own-flat notification | Trigger through authorized request | No notification action | Validate | Notification API and authorized Edge Function; request deep link refetches source data | Requires development/release build, device permission, push credentials, and device test |
| NTF-02 | Visitor-decision push | No guard notification action | Receive approval/rejection update | No notification action | Validate | Decision mutation and authorized notification send path | Device-test foreground/background delivery |
| NTF-03 | Complaint-status push | Receive own complaint update | No notification action | Trigger through authorized status change | Validate | Complaint mutation and notification Edge Function path | Device-test delivery and denied-permission fallback |
| RT-01 | Visitor Realtime fallback | Own-flat subscription | Own-society subscription | Not required | Validate | Society/flat-filtered Realtime invalidation and refreshable query screens | Verify subscriptions with two physical sessions |
| UX-01 | Role navigation and phone layouts | Resident navigation | Guard navigation | Admin navigation | Validate | Role tab bars, safe-area layouts, scrollable forms, guarded route groups | Final common-width and keyboard audit |
| UX-02 | Loading, empty, error, and mutation states | Required on every resident async screen | Required on every guard async screen | Required on every admin async screen | Validate | Shared async state, toast handling, pending-button disabling, query retries | Complete final screen-by-screen polish audit |
| SUB-01 | README setup and demo credentials | Demonstrable account required | Demonstrable account required | Demonstrable account required | In progress | Basic setup exists in README | Add non-production demo credentials and current setup/deployment steps |
| SUB-02 | Installable build/APK | Required journey | Required journey | Required journey | In progress | Android Expo export passes | Produce and test final installable build |
| SUB-03 | Screenshots and demo video | Show resident journey | Show guard journey | Show admin journey | Planned | No final submission artifacts tracked yet | Capture screenshots and record all three role journeys |

## Backend authorization checklist

Every completed or validating backend slice must retain all of these properties:

- Authenticated profile is the source of `role`, `society_id`, and resident `flat_id`.
- Every domain query and Realtime filter includes society scope.
- Resident-private mutations derive or verify ownership server-side.
- Guard operations validate the guard role and target society server-side.
- Admin mutations validate admin role and target society server-side.
- Client-accessible tables use RLS; Data API grants are explicit and separate from RLS.
- Privileged database functions use an empty `search_path`, check `auth.uid()`, and revoke
  default public/anonymous execution before granting the required role.
- Direct writes are revoked when a checked RPC is the only safe mutation path.
- Tests cover the allowed role, denied roles, inactive users where relevant, ownership,
  and cross-society denial.

## How to update this tracker

For each feature change:

1. Update the matching matrix row instead of adding a duplicate feature.
2. Change the status only when the status definition is satisfied.
3. Add or update the concrete route, API, migration/RPC, RLS policy, and test evidence.
4. State any honest limitation in `Remaining work`; do not call placeholder data complete.
5. Re-check all three role columns, even when the change targets only one role.
6. Append a short entry below.

## Change log

| Date | Change | Verification |
| --- | --- | --- |
| 2026-07-20 | Created role boundaries and implementation tracker from the current repository state. | Route/API/migration/test audit |
| 2026-07-20 | Recorded atomic guard visitor creation, atomic resident pre-approval, and minimal guard resident search. | 263 pgTAP assertions, TypeScript, ESLint, DB lint, Android export |
| 2026-07-21 | Added scalable read-only admin visitor history with server filters and cursor pagination. | 287 pgTAP assertions plus app/database quality gates |

| 2026-07-21 | Hardened notices with atomic publish, society-scoped Realtime refresh, and pull-to-refresh. | 289 pgTAP assertions plus app/database quality gates |
| 2026-07-21 | Froze expanded scope: Agora branding, read-only admin visitor history, admin guard accounts and dues management, resident read-only directory, and optional visitor metadata. | Product-owner decisions recorded in AGENTS.md and this tracker |
| 2026-07-21 | Revalidated the existing three-role baseline and aligned Expo SDK 57 patch dependencies. | 289 pgTAP assertions, schema lint, DB advisors, TypeScript, ESLint, Expo Doctor 20/20, and Android export |
| 2026-07-21 | Prevented Realtime callback collisions during fast route remounts by centralizing unique channel topics across all subscriptions. | TypeScript, ESLint, Android export, and reproduction-path review |

| 2026-07-21 | Fixed ambiguous visitor relationship embeds and replaced misleading connection-only async errors. | TypeScript, ESLint, diff check, and Android export |

| 2026-07-21 | Removed redundant logical foreign keys while retaining composite same-society integrity and simplified Data API embeds. | 291 pgTAP assertions, seven authenticated PostgREST embed probes, schema lint/advisors, TypeScript, ESLint, Expo Doctor 20/20, and Android export |
| 2026-07-21 | Made six-digit gate passes unique among active same-society passes, added one-call indexed guard verification, expiry/revocation states, and removed resident polling. | 316 pgTAP assertions, focused 25-assertion gate-pass suite, schema lint, TypeScript, ESLint, diff check, and Android export |
| 2026-07-22 | Added the guard digital Logbook with Live/history separation, exact summaries, server-side date/state/category/tower/flat filters, cursor pagination, and a non-disruptive Realtime refresh notice. Admin history now reuses the same authorized query core. | 358 pgTAP assertions, schema lint, TypeScript, ESLint, diff check, and Android export |
| 2026-07-22 | Replaced packed tower/flat chips with bounded server-side location search and redesigned Guard Logbook as an aligned monthly register with stable 001-based monthly numbering and expandable details. | 376 pgTAP assertions, 1,000-flat/5,000-visit query benchmark, schema lint, TypeScript, ESLint, Expo Doctor 20/20, and Android export |
| 2026-07-22 | Added optional visit-scoped vehicle type and registration number to guard registration and resident pre-approval without another network call, with read-only visibility across verification, passes, Logbook, and admin history. | 380 pgTAP assertions plus TypeScript and scoped ESLint |
| 2026-07-22 | Rebuilt Resident Gate as an own-flat digital register with seven-day navigation, month/custom date, state and visitor-type filters, expandable details, indexed cursor pagination, and active-pass access; normalized auth email while preserving passwords exactly. | 402 pgTAP assertions, indexed EXPLAIN plan, schema lint, TypeScript, ESLint, Expo Doctor 20/20, and Android export |

# Agora Feature and Role Tracker

Last audited: July 24, 2026

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
- manage multiple own-flat vehicles and view their active parking assignments;
- search and download documents published for residents or all members;
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
- look up current parking/vehicle assignments read-only;
- read documents published for guards or all members;
- start, complete, and comment on tasks directly assigned to their guard account.

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
- parking slots and resident vehicle assignments;
- categorized society documents with audience controls;
- daily operational tasks assigned to staff, committee members, or guards;
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
| AUTH-04 | Security-guard account management | No access | Use own account only | Create, view, activate, and deactivate own-society guard accounts | Complete | Checked account-provisioning Edge Function, admin routes/API, activation RPC, token cleanup, and pgTAP tests | Deploy and validate hosted account creation |
| STR-01 | Tower management | View own tower context only | No management | Create, view, edit, delete own-society towers | Complete | Admin tower routes, tower API, tower migration and pgTAP tests | None currently |
| STR-02 | Flat management | Use assigned flat only | Minimal routing lookup only | Create, view, edit, delete own-society flats | Complete | Admin flat routes, flat API, flat migration and pgTAP tests | None currently |
| STR-03 | Resident management | Own profile/flat context | Minimal projected search only | Create, view, activate/deactivate, and assign residents | Complete | Resident admin routes, resident API, resident migration and tests | None currently |
| VIS-01 | Guard resident search | No directory access | Search active residents in own society | No guard-directory access | Complete | `search_guard_residents` RPC returns only name/flat/tower projection; atomic visitor pgTAP tests | Hosted deployment complete |
| VIS-02 | Register visitor and request approval | Receive own-flat request | Create pending request | No operational visitor action | Complete | Guard registration screen and atomic `create_guard_visitor_request` RPC | Hosted deployment complete |
| VIS-03 | Resident approve/deny | Decide own pending request | Observe decision only | No operational visitor action | Complete | Resident request/detail/decision screens, checked decision RPC and visitor RBAC tests | Device-test notification deep link |
| VIS-04 | Resident pre-approval | Create, reopen, share, and revoke own-flat 24-hour passes | Verify an indexed active code in own society | No operational visitor action | Complete | Collision-safe six-digit code RPC, active-code unique index, cached guard lookup, expiry/revoke UI, and pgTAP tests | Deploy the two pending gate-pass migrations remotely |
| VIS-08 | QR gate-pass verification | Display own active pass QR and six-digit fallback | Scan QR and re-authorize through live guard lookup | No operational QR action | Validate | Expo Camera scanner, QR generation, permission/error states, role route, and source-of-truth server verification | Physical-device autofocus and low-light validation |
| VIS-05 | Entry and exit | View resulting state/history | Mark approved entry and entered exit | No operational visitor action | Complete | Guard verification screen, movement log, checked entry/exit RPCs and tests | Device-test rapid repeated taps |
| VIS-06 | Visitor history and guard logbook | Searchable, paginated own-flat digital register with recent-day, month, custom-date, state, and type filters | Read-only own-society Live register plus searchable, paginated monthly Logbook | Read-only own-society history | Complete | Dedicated resident ownership-derived cursor RPC and Gate register; Guard Live/Logbook modes; server filters; existing indexed cursors; Realtime refresh; and pgTAP tests | Push the pending history migrations and complete final physical-device visual check |
| COM-01 | Notices | View published own-society notices | No notice workflow | Create, publish, view, archive/manage notices | Complete | Atomic notice publishing, screens/API, RLS tests, Realtime invalidation, and pull-to-refresh | Device-test published-notice push if enabled |
| COM-02 | Polls | View eligible polls, vote once, view permitted results | No poll workflow | Create, close/archive, and view society results | Complete | Poll screens/API, poll migration and pgTAP tests | Final empty-state copy review |
| COM-03 | Complaints | Create and track own complaint/timeline | No complaint workflow | View society complaints and update status/timeline | Complete | Complaint screens/API, complaint migration and tests | Device-test complaint-status notification |
| COM-04 | Complaint photo evidence | Optionally take or choose one image and view it securely | No complaint or attachment access | View same-society complaint evidence read-only | Validate | Private Storage bucket, scoped RLS, attachment RPC, picker and viewer | Device-test camera, gallery, upload and signed viewing |
| AMN-01 | Amenity management | View active amenities and their tappable, zoomable photo galleries | No amenity workflow | Create, edit, activate/deactivate amenities and manage up to four ordered photos through a themed source chooser | Validate | Admin amenity routes/API, private amenity-image Storage bucket, staged client-side JPEG resizing/compression, ordered image paths, batch signed URLs, scoped RLS/RPC, camera/gallery source sheet, shared pinch-to-zoom viewer, resident/admin gallery UI, migration, and pgTAP tests | Push gallery migration; device-test camera, multi-select gallery, compression feedback, reordering, removal, upload, signed display, and pinch/drag gestures |
| AMN-02 | Amenity booking | Create/cancel/view own bookings | No booking workflow | View and manage society bookings | Complete | Resident booking routes, admin detail, checked booking RPCs and tests | Validate concurrent-slot behavior on device |
| DUE-01 | Maintenance dues | View own-flat active/history dues | No dues workflow | Create selected/all-flat invoices, track status, and cancel unpaid invoices with reason | Complete | Resident/admin screens, checked create/cancel RPCs, cancellation payment guard, audit events, Realtime, and pgTAP tests | Hosted deployment complete |
| DUE-02 | Maintenance payment | Pay own unpaid due through Razorpay Test Mode | No payment workflow | Track own-society verified test payments and totals | Validate | Server-created order, expiring hosted checkout, app deep link, server HMAC plus captured-payment verification, idempotent ledger RPC, RLS, and Test Mode receipt labels | Device-run sandbox checkout and add verified webhook afterward |
| DUE-03 | Maintenance reminders and reports | Receive generic own-due reminders and deep-link to Dues | No access | Send authorized unpaid-invoice reminders and view invoice/payment totals | Validate | Server-derived audience, contextual notification permission, admin reminder UI, reporting dashboard, and attached CSV share-sheet export | Physical-device push and share-sheet validation |
| DUE-04 | Optional downloadable receipts | May download/share own receipt | No access | No resident payment action; reports remain admin-scoped | Optional | Explicitly classified optional on July 21, 2026 | Implement only after required scope and release gates |
| DIR-01 | Staff directory management | No directory-management workflow | No directory-management workflow | Create, view, edit, activate/deactivate staff | Complete | Staff routes/API, directory migration and tests | None currently |
| DIR-02 | Service-provider management | No directory-management workflow | Use providers only through visitor category flows | Create, view, edit, activate/deactivate providers | Complete | Provider routes/API, directory migration and tests | None currently |
| DIR-03 | Resident staff/service directory | Search and call active own-society staff/providers read-only | No directory access | Manage source records | Complete | Resident directory route/API, active-only RLS, phone integration, async states, and isolation tests | Physical-device call-link check |
| PRK-01 | Parking slot management | View own assigned slots | Read-only own-society slot/vehicle lookup | Create, activate/deactivate, assign, reassign, and release slots through a visual occupancy layout | Validate | Society-scoped tables/composite FKs, checked RPCs, RLS, Realtime, TanStack Query, accessible visual grid, and role routes | Automated RBAC cases deferred; device-check dense parking layouts |
| VEH-01 | Resident vehicle management | Create, edit, deactivate multiple vehicles for own flat | Read-only assigned vehicle lookup | View vehicles while managing assignments | Validate | Own-flat RLS/RPCs, normalized registrations, same-society assignment constraints, resident CRUD UI, and parking integration | Automated RBAC cases deferred; device-check forms and reassignment |
| DOC-01 | Society documents | Search/download resident/all published documents | Search/download guard/all published documents | Upload, categorize, publish, edit metadata, audience-scope, and archive | Validate | Private Storage bucket, signed URLs, MIME/size limits, society-path RLS, metadata RPCs, TanStack Query, and role screens | Automated Storage/RBAC cases deferred; deploy and device-check upload/download/share |
| TSK-01 | Daily operational tasks | No access | View/start/complete/comment only on own directly assigned tasks | Create, assign to staff/committee/guards, reprioritize, reschedule, comment, remind, and track dashboards | Validate | Exactly-three-role model, assignee constraints, checked status/comment RPCs, RLS, Realtime, notification audience checks, and role screens | Automated RBAC cases deferred; deploy and device-check notification/reminder flow |
| VIS-07 | Optional vehicle metadata | Adds a vehicle type and registration number to a pre-approval | Captures optional vehicle details during registration and verifies them at entry | Read-only vehicle details in visitor history | Complete | Visit-scoped columns; normalized atomic RPC inputs; shared phone form; resident pass/request/history, guard verification/Logbook, and admin history rendering; pgTAP coverage | Push the vehicle migration and complete a physical-device form check; purpose and photos remain optional and out of this slice |
| AUD-01 | Audit trail | No access | No access | View authorized own-society audit records | Complete | Admin audit route, audit query and society-scoped RLS | Expand event coverage only when new mutations require it |
| NTF-01 | Visitor-request push | Receive own-flat notification | Trigger through authorized request | No notification action | Validate | Notification API and authorized Edge Function; request deep link refetches source data | Requires development/release build, device permission, push credentials, and device test |
| NTF-02 | Visitor-decision push | No guard notification action | Receive approval/rejection update | No notification action | Validate | Decision mutation and authorized notification send path | Device-test foreground/background delivery |
| NTF-03 | Complaint-status push | Receive own complaint update | No notification action | Trigger through authorized status change | Validate | Complaint mutation and notification Edge Function path | Device-test delivery and denied-permission fallback |
| NTF-04 | Push delivery reliability | Receives tracked own-scope pushes | Receives tracked guard-workflow pushes | Triggers only authorized own-society sends | Validate | 100-message batching, 429/5xx backoff, ticket ledger, delayed receipt checks, rejection counts, and DeviceNotRegistered cleanup | Deploy migration/function, add scheduled receipt drain, and device-test credentials |
| RT-01 | Visitor Realtime fallback | Own-flat subscription | Own-society subscription | Not required | Validate | Society/flat-filtered Realtime invalidation and refreshable query screens | Verify subscriptions with two physical sessions |
| UX-01 | Role navigation and phone layouts | Resident navigation | Guard navigation | Admin navigation | Validate | Role tab bars, safe-area layouts, scrollable forms, guarded route groups | Final common-width and keyboard audit |
| UX-02 | Loading, empty, error, and mutation states | Required on every resident async screen | Required on every guard async screen | Required on every admin async screen | Validate | Shared async state, toast handling, pending-button disabling, query retries, NetInfo offline banner, paused mutations, and reconnect refetch | Complete final screen-by-screen and physical-device offline audit |
| OPS-01 | Observability and CI | Recoverable errors | Recoverable errors | Recoverable errors and audit visibility | Validate | Sentry initialization, identity minimization, root error boundary, TanStack capture, and GitHub Actions app/database gates | Supply Sentry project secrets and confirm hosted CI run |
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
| 2026-07-23 | Removed distance-scaled multi-wave admin-tab animation that made long jumps traverse intermediate tabs; every switch now uses one shallow 14px arc with a fixed 240ms duration, so first-to-last navigation is direct and as fast as adjacent navigation. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Removed the visible orange curve rail from the admin bottom bar while retaining the invisible multi-curve selector trajectory and clean white navigation surface. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Replaced the rejected vertical effect with a visible shallow curved rail between admin tabs; the active selector now follows each U-shaped valley and rises at every tab center, including intermediate curves during multi-tab jumps. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Replaced visible horizontal admin-tab travel with a vertical submerge-and-emerge transition: the old selector sinks and fades, repositions while hidden, then the selected icon rises bottom-to-top with a dissolving vertical gold-green stream. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Enhanced the animated admin selector with a dissolving gold-to-green fluid trail, eased horizontal glide, subtle lift and scale, rapid-retarget support, and reduced-motion fallback without changing layout or touch targets. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Replaced the admin bar’s per-tab active switch with one measured Reanimated indicator that slides between routes, carries the active icon and complaint badge, initializes without an entrance sweep, and tightens icon-to-label spacing without shrinking touch targets. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Adapted the admin bottom navigation to the approved raised-tab reference with a stable floating circular selector, Agora gold-and-green active treatment, preserved numeric complaint badge, and no tab-switch layout shift. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Narrowed the configurable Community selector and redesigned the shared admin bottom navigation as a safe-area-aware raised card with a clear active-icon capsule, stable labels, touch feedback, and aligned complaint badge. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Added an optional responsive container width to the centralized admin tabbed-header wrapper and applied a narrower centered selector to Community while preserving the default width elsewhere. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Centralized the full admin tabbed-header wrapper—including header, overlap, outer margins, selector card, and centered equal padding—so Community and Operations now pass only their tab data and state. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Extracted the Operations filter into a reusable accessible admin selector and applied the identical floating-pill design to Community’s Towers, Flats, and Residents sections. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Standardized Community, Operations, Notices, and More around one reusable green admin-tab header with equal height, content overlap, adaptive subtitles, and matching status-bar contrast. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Disabled admin-home vertical bounce/stretch so the light canvas cannot appear as a strip above the dark-green header after returning to the top. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Added route-aware Expo status-bar contrast and corrected tower occupancy display to preserve one decimal when required (for example, 1/40 = 2.5%). | TypeScript, full ESLint, 414 pgTAP assertions, Android export, and exact formula check |
| 2026-07-23 | Replaced permanent amenity camera/gallery controls with a themed photo-source sheet and added tappable pinch-to-zoom viewing for staged and uploaded amenity photos using the shared complaint attachment viewer. | TypeScript, full ESLint, 414 pgTAP assertions, Android export, and diff check |
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
| 2026-07-23 | Redesigned amenity photo selection as a cover editor with thumbnails and added staged JPEG resize/compression with final-byte validation before upload. | TypeScript, full ESLint, 414 pgTAP assertions, and Android export |
| 2026-07-23 | Added optional four-photo amenity galleries with camera/gallery selection, cover ordering, private society-scoped Storage, one-call signed URL batches, and resident/admin display. | 414 pgTAP assertions, schema lint, TypeScript, and scoped ESLint |
| 2026-07-22 | Rebuilt Resident Gate as an own-flat digital register with seven-day navigation, month/custom date, state and visitor-type filters, expandable details, indexed cursor pagination, and active-pass access; normalized auth email while preserving passwords exactly. | 402 pgTAP assertions, indexed EXPLAIN plan, schema lint, TypeScript, ESLint, Expo Doctor 20/20, and Android export |

| 2026-07-23 | Started the admin tab indicator directly from the accepted tap instead of waiting for the navigation-state render, prevented the route-sync effect from replaying the animation, and shortened the direct curved transition to 180ms. | TypeScript, full ESLint, Android export, and diff check |

| 2026-07-23 | Removed the curved admin-tab trajectory, vertical dip, and scaling; the active indicator now uses one direct 180ms horizontal glide that starts on the accepted tap. | TypeScript, full ESLint, Android export, and diff check |

| 2026-07-23 | Removed admin-tab JS contention by retaining visited native tab screens, deferring inactive Community collections, replacing nested flat/resident lookups with indexed maps, and making tower statistics linear-time while preserving the 180ms indicator glide. | TypeScript, full ESLint, Android export, and diff check |

| 2026-07-23 | Redesigned Admin Home as a branded operational dashboard with a truthful action queue, live metric cards, distinct cross-platform Expo symbols, accessible two-column quick actions, and centralized section/card/panel/list-row primitives. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Redesigned the Admin More tab as a grouped administration hub with account context, semantic cross-platform icons, clearer module descriptions, separate records and security sections, and reused centralized dashboard primitives. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Removed the Admin More hero/header collision with an explicit non-overlapping shared-header mode and replaced the admin tab bar's exposed canvas-colored outer padding with one continuous white safe-area surface. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Removed the rejected Admin More profile hero and restored the previously accepted floating admin bottom-navigation card without changing the grouped module workflow. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Restored the centralized section's intended top margin on Admin More by removing the content offset that cancelled spacing below the header. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Removed Admin More's redundant 126px scroll tail and compacted the Admin Home hero with a single adaptive greeting line plus tighter vertical spacing while preserving the priority-card overlap. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Removed the remaining explicit bottom padding after Admin More sign out because the router tab bar already reserves its own layout space. | TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Diagnosed Admin Amenities as blocked by the unpushed gallery migration and made its async state truthful: schema mismatch is explicit, booking-count failure is non-blocking, retry state is visible, and the empty state only appears after a successful list query. | Remote migration history, TypeScript, full ESLint, Android export, and diff check |
| 2026-07-23 | Centralized pushed Admin screen framing in the role navigator with the real device top inset, a consistent 18px content gap, admin-canvas status-bar surface, and a full-bleed tab-route override; removed 21 duplicated 62/66px pseudo-safe-area declarations. | TypeScript, full ESLint, Android export, route audit, and diff check |
| 2026-07-23 | Replaced the theme-dependent Admin stack transition with one native iOS-style right push on Android and made status-bar visibility/style explicit in both Expo and native-stack layers: dark on pushed canvas screens, light on green tab screens. | TypeScript, full ESLint, Android export, installed-option audit, and diff check |
| 2026-07-23 | Removed conflicting nested native-stack status-bar ownership, made the root Expo status bar authoritative, and added one route-aware safe-area surface so Android edge-to-edge always has visible light icons on green Admin tabs and dark icons on pushed canvas screens. The native startup bar is also explicitly visible. | TypeScript, full ESLint, resolved Expo config, Android export, and diff check |
| 2026-07-23 | Corrected the root status-bar surface’s zero-height safe-area context by moving `SafeAreaProvider` above both Expo Router and the shared status-bar controller, seeded from native initial metrics to prevent a black first frame. | TypeScript, full ESLint, Android export, and provider hierarchy audit |
| 2026-07-23 | Replaced the ineffective in-app status-bar overlay with route-aware `expo-system-ui` decor-background control, the SDK 57-compatible mechanism beneath Android’s transparent edge-to-edge status bar; removed the temporary root safe-area wrapper and added a green native startup background. | TypeScript, full ESLint, resolved Expo config, Android export, and installed SDK source audit |

| 2026-07-24 | Added hardened session storage, push-token ownership RPCs, guard accounts, maintenance billing/reminders/cancellation, resident directory, multi-member flats, Sentry, QR verification, CI, and submission architecture/demo docs. | 513 pgTAP assertions, TypeScript, full ESLint, Expo Doctor 20/20, clean database reset, and Android export |

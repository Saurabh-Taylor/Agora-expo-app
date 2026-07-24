# Agora Hackathon Video Script

Target length: **5 minutes 30 seconds**. Record in landscape at 1080p. Use a Resident phone and Guard phone side by side where possible, with Admin on an emulator or third device. Add role labels whenever the active account changes.

## Recording preparation

Before recording:

- Install the latest development or preview build; do not use Expo Go for the Razorpay return deep link.
- Sign in to separate demo-only Resident, Guard, and Admin accounts in the same society.
- Preload one tower, flat, two household residents, guard, staff member, committee member, provider, amenity, notice, poll, complaint, unpaid invoice, parking slot, vehicle, document, and operational task.
- Keep one visitor unregistered so the Guard can demonstrate the complete request lifecycle.
- Confirm Realtime works between the Resident and Guard sessions.
- Confirm Razorpay is in Test Mode, automatic capture is enabled, and one sandbox payment has already succeeded before recording it.
- Use non-sensitive names, phone numbers, documents, vehicle numbers, and visitor details.
- Disable unrelated phone notifications and keep the six-digit gate-pass fallback ready.

## Timeline

| Time | Segment |
| --- | --- |
| 0:00-0:25 | Problem and product |
| 0:25-1:05 | Guard registers a visitor |
| 1:05-2:20 | Resident approves and explores resident features |
| 2:20-3:10 | Guard completes gate operations |
| 3:10-4:45 | Admin management walkthrough |
| 4:45-5:15 | Architecture and security proof |
| 5:15-5:30 | Closing pitch |

---

## 0:00-0:25 — Problem and product

### On screen

Show the Agora logo, then a quick montage of the three dashboards labelled **Resident**, **Security Guard**, and **Society Admin**.

### Narration

> Apartment communities still run critical daily operations through gate calls, WhatsApp groups, and paper registers. When a resident misses a call, visitors wait and guards repeat the same manual process.
>
> Agora replaces that fragmented workflow with one phone-first society management app and three strictly isolated experiences: Resident, Security Guard, and Society Admin.

## 0:25-1:05 — Guard registers a visitor

### On screen

1. Open the Guard dashboard.
2. Tap **Register visitor**.
3. Enter a guest name and category.
4. Search for the destination resident or flat.
5. Submit the approval request.
6. Pause on the pending state.

### Narration

> The guard starts with the fastest operational path: register the visitor, select the category, search only the minimum resident information needed for routing, and send an approval request.
>
> The guard cannot approve the visitor. That decision belongs exclusively to an eligible resident of the selected flat. The request is now pending, timestamped, and visible in real time.

## 1:05-2:20 — Resident experience

### On screen: approval hero journey

1. Switch to the Resident phone as the request appears through Realtime or a push notification.
2. Open the request directly.
3. Show visitor name, category, destination, and status.
4. Tap **Approve** once and show the immediate approved state.

### Narration

> The resident receives the request without another gate call and reaches the decision screen directly. Approval and rejection are prominent, duplicate submissions are blocked, and the server result appears immediately.

### On screen: resident feature montage

Move quickly through these screens, spending three to five seconds on each:

1. Create or open a **Pre-approved guest pass** and show its QR plus six-digit fallback.
2. Open **Community** and show published notices and an active poll.
3. Open a complaint and show its status timeline and optional photo evidence.
4. Open amenities and show discovery, photos, availability, and booking.
5. Open **My vehicles** and show multiple resident vehicles plus the assigned parking slot.
6. Open **Society documents**, search by title/category, and show a downloadable published document.
7. Open maintenance dues, start **Razorpay Test Mode**, then show the verified success receipt.
8. Open the active staff and service-provider directory.

### Narration

> Residents can also pre-approve guests with a QR gate pass, read notices, vote in polls, raise and track complaints, book amenities, manage multiple vehicles, view their parking assignment, access role-approved society documents, pay maintenance dues, and contact active society staff or service providers.
>
> Maintenance uses Razorpay Standard Checkout in Test Mode. Agora creates the order on the server and marks the invoice paid only after signature, order, amount, currency, and captured status are verified server-side. No real money moves in this demonstration.

## 2:20-3:10 — Guard operations

### On screen

1. Return to the Guard phone and show the approved request updating.
2. Open verification and tap **Mark entry**.
3. Show the visitor in the live movement log.
4. Open the same visitor and tap **Mark exit**.
5. Briefly show the searchable Logbook with entry and exit timestamps.
6. Open **Scan pass** and frame a resident QR, or show the scanner plus six-digit fallback.
7. Briefly show **Parking lookup**, assigned Guard tasks, and Guard-audience documents.

### Narration

> The guard sees the resident decision in real time, re-verifies the current server state, and explicitly records entry and exit. The live movement log answers who is currently inside, while the searchable Logbook preserves the operational history.
>
> QR scanning is a lookup shortcut, never an authority by itself. Every scan is re-authorized against the live pass before entry. Guards also receive read-only parking lookup, documents intended for security, and only the operational tasks assigned to their own account.

## 3:10-4:45 — Society Admin experience

### On screen: society structure and people

1. Switch to the Admin dashboard and show summary counts.
2. Open **Community management**.
3. Show towers, flats, and multiple residents assigned to one flat.
4. Open Security Guard accounts and show activation/deactivation controls.

### Narration

> The Society Admin gets a centralized management experience scoped to one society. Admins manage towers, flats, household members, and login-capable guard accounts without entering resident or guard operational workflows.

### On screen: operations montage

Move through these screens in order:

1. **Notices** — show draft, publish, and archive states.
2. **Polls** — show creation and results.
3. **Complaints** — open one complaint and update its status.
4. **Amenities** — show rules, photos, availability, and society bookings.
5. **Staff and providers** — show staff, committee classification, shifts, and service providers.
6. **Maintenance billing** — show invoice totals, payment totals, reminders, cancellation, and CSV export.
7. **Parking management** — show the visual occupied/vacant grid and assign or reassign a vehicle.
8. **Society documents** — show category, audience, draft/published state, and private upload.
9. **Daily operations** — create a priority task, assign it to staff, committee, or a guard, and show pending/in-progress/completed counts.
10. Briefly show read-only visitor history and the Admin audit trail.

### Narration

> Beyond community content, the admin manages complaints, amenities, staff, service providers, maintenance invoices and reports, parking occupancy and vehicle assignments, private society documents, and daily operational tasks.
>
> Documents can target residents, guards, or everyone. Tasks can be assigned to staff, committee members, or guard accounts, with priorities, due dates, comments, reminders, and completion tracking. Sensitive management actions are also recorded in the audit trail.

## 4:45-5:15 — Architecture and security proof

### On screen

Show `docs/ARCHITECTURE.md`, then briefly show the role matrix and a migration containing RLS or a checked RPC. Overlay these labels:

- Expo + React Native
- Expo Router role guards
- Supabase Auth, Postgres, RLS, Realtime, Storage, Edge Functions
- TanStack Query server state
- Zustand client-only state
- Sentry-ready observability

### Narration

> Agora uses Expo and React Native with role-specific Expo Router trees. Supabase is the only backend, with Auth, Postgres, Row Level Security, Realtime, private Storage, and Edge Functions.
>
> Navigation hiding is not treated as security. Every domain record carries a society identifier, and the database rechecks role, society, ownership, relationships, and lifecycle transitions. TanStack Query owns remote state, while Zustand is limited to client-only session and interface state.

## 5:15-5:30 — Closing pitch

### On screen

Return to a three-dashboard montage, then finish on the Agora logo and tagline:

**One society. Three focused roles. Every operation accounted for.**

### Narration

> Agora turns apartment management from disconnected conversations into fast, accountable workflows—from the gate to maintenance, parking, documents, and daily operations.
>
> One society, three focused roles, and every operation accounted for. This is Agora.

---

## Editing notes

- Use hard cuts during role changes and display the current role in the top-left corner.
- Keep taps visible with touch indicators and increase playback to 1.15x-1.25x for list navigation.
- Use captions throughout; many judges watch without audio.
- Zoom only when showing QR, payment verification, RLS, or role permissions.
- Do not show passwords, API keys, tokens, personal documents, or production resident data.
- Do not claim Razorpay Test Mode is a real settlement.
- If push delivery is not physically verified, narrate it as optional and show the Realtime fallback instead.
- If a live action is unreliable, record it separately and use a clean cut; do not waste demo time retrying.

## Final recording checklist

- [ ] Resident, Guard, and Admin demo accounts work in the same society.
- [ ] Visitor request → approval → entry → exit succeeds before recording.
- [ ] QR scanner and six-digit fallback both work.
- [ ] Razorpay sandbox payment returns to the installed Agora build and records a verified payment.
- [ ] Parking, document, and task sample data is present.
- [ ] No secrets or private data appear anywhere in the recording.
- [ ] Voice-over, captions, and role labels are synchronized.
- [ ] Final video stays within the submission time limit.

-- Agora core schema + RLS.
-- Tenancy invariant: every domain row carries society_id, and every RLS policy
-- filters on it. See AGENTS.md "Tenant Isolation: the societyId Invariant".

create extension if not exists "pgcrypto";

create type user_role as enum ('RESIDENT', 'GUARD', 'ADMIN');
create type occupancy_type as enum ('OWNER', 'TENANT');
create type visitor_category as enum ('DELIVERY', 'GUEST', 'SERVICE', 'CAB');
create type visitor_request_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'ENTERED', 'EXITED');
create type notice_category as enum ('GENERAL', 'WATER', 'EVENT', 'BILLING', 'SECURITY');
create type notice_state as enum ('SCHEDULED', 'PUBLISHED');
create type poll_state as enum ('ACTIVE', 'CLOSED');
create type complaint_priority as enum ('LOW', 'MEDIUM', 'HIGH');
create type complaint_status as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED');
create type booking_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED');
create type dues_status as enum ('UNPAID', 'PAID');
create type staff_status as enum ('ON_DUTY', 'OFF_DUTY');

-- ══════════════════════════ core tenancy ══════════════════════════

create table societies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table towers (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  name text not null,
  code text not null,
  floors int not null default 0,
  units_per_floor int not null default 0,
  created_at timestamptz not null default now(),
  unique (society_id, code)
);

create table flats (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  tower_id uuid not null references towers(id) on delete cascade,
  number text not null,
  floor int not null default 0,
  created_at timestamptz not null default now(),
  unique (tower_id, number)
);

-- Extends auth.users. One row per authenticated person; the backend-authoritative
-- source of role/society/flat (AGENTS.md "Never trust ... supplied by the client").
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  society_id uuid not null references societies(id) on delete cascade,
  role user_role not null,
  flat_id uuid references flats(id) on delete set null,
  occupancy_type occupancy_type,
  full_name text not null,
  phone text,
  avatar_url text,
  is_verified boolean not null default false,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  constraint resident_requires_flat check (role <> 'RESIDENT' or flat_id is not null)
);

create index profiles_society_idx on profiles(society_id);
create index flats_society_idx on flats(society_id);
create index towers_society_idx on towers(society_id);

-- ══════════════════════ RLS helper functions ══════════════════════
-- security definer: read profiles once, bypassing RLS recursion, then every
-- table policy below calls these instead of re-querying profiles directly.

create function current_society_id() returns uuid
  language sql stable security definer set search_path = public as
$$ select society_id from profiles where id = auth.uid() $$;

create function current_user_role() returns user_role
  language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create function current_flat_id() returns uuid
  language sql stable security definer set search_path = public as
$$ select flat_id from profiles where id = auth.uid() $$;

-- ══════════════════════════ visitors ══════════════════════════

create table visitors (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  name text not null,
  phone text,
  category visitor_category not null,
  photo_url text,
  created_at timestamptz not null default now()
);

create table visitor_requests (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  visitor_id uuid not null references visitors(id) on delete cascade,
  flat_id uuid not null references flats(id) on delete cascade,
  raised_by uuid references profiles(id) on delete set null, -- guard; null when resident pre-approves
  decision_by uuid references profiles(id) on delete set null,
  status visitor_request_status not null default 'PENDING',
  is_pre_approved boolean not null default false,
  gate_pass_code text,
  decision_at timestamptz,
  entry_at timestamptz,
  exit_at timestamptz,
  created_at timestamptz not null default now()
);

create index visitor_requests_society_idx on visitor_requests(society_id);
create index visitor_requests_flat_idx on visitor_requests(flat_id);

-- ══════════════════════════ notices ══════════════════════════

create table notices (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  title text not null,
  body text not null,
  category notice_category not null default 'GENERAL',
  state notice_state not null default 'PUBLISHED',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index notices_society_idx on notices(society_id);

-- ══════════════════════════ polls ══════════════════════════

create table polls (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  question text not null,
  state poll_state not null default 'ACTIVE',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closes_at timestamptz
);

create table poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  society_id uuid not null references societies(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references polls(id) on delete cascade,
  option_id uuid not null references poll_options(id) on delete cascade,
  society_id uuid not null references societies(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (poll_id, profile_id)
);

create index polls_society_idx on polls(society_id);
create index poll_options_poll_idx on poll_options(poll_id);
create index poll_votes_poll_idx on poll_votes(poll_id);

-- ══════════════════════════ complaints ══════════════════════════

create table complaints (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  flat_id uuid not null references flats(id) on delete cascade,
  raised_by uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null default 'GENERAL',
  priority complaint_priority not null default 'MEDIUM',
  status complaint_status not null default 'OPEN',
  assignee uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references complaints(id) on delete cascade,
  society_id uuid not null references societies(id) on delete cascade,
  status complaint_status not null,
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index complaints_society_idx on complaints(society_id);
create index complaints_flat_idx on complaints(flat_id);
create index complaint_events_complaint_idx on complaint_events(complaint_id);

-- ══════════════════════════ amenities ══════════════════════════

create table amenities (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  open_time time,
  close_time time,
  created_at timestamptz not null default now()
);

create table amenity_bookings (
  id uuid primary key default gen_random_uuid(),
  amenity_id uuid not null references amenities(id) on delete cascade,
  society_id uuid not null references societies(id) on delete cascade,
  flat_id uuid not null references flats(id) on delete cascade,
  booked_by uuid not null references profiles(id) on delete cascade,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  status booking_status not null default 'PENDING',
  created_at timestamptz not null default now()
);

create index amenities_society_idx on amenities(society_id);
create index amenity_bookings_amenity_idx on amenity_bookings(amenity_id);
create index amenity_bookings_flat_idx on amenity_bookings(flat_id);

-- ══════════════════════════ dues & payments ══════════════════════════

create table maintenance_dues (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  flat_id uuid not null references flats(id) on delete cascade,
  quarter_label text not null,
  amount numeric(10, 2) not null,
  due_date date not null,
  status dues_status not null default 'UNPAID',
  created_at timestamptz not null default now(),
  unique (flat_id, quarter_label)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  due_id uuid not null references maintenance_dues(id) on delete cascade,
  society_id uuid not null references societies(id) on delete cascade,
  flat_id uuid not null references flats(id) on delete cascade,
  paid_by uuid references profiles(id) on delete set null,
  amount numeric(10, 2) not null,
  method text not null,
  receipt_no text not null,
  paid_at timestamptz not null default now()
);

create index dues_society_idx on maintenance_dues(society_id);
create index dues_flat_idx on maintenance_dues(flat_id);
create index payments_due_idx on payments(due_id);

-- ══════════════════════════ staff & service providers ══════════════════════════

create table staff (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  name text not null,
  role text not null,
  shift text,
  phone text,
  status staff_status not null default 'ON_DUTY',
  created_at timestamptz not null default now()
);

create table service_providers (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  name text not null,
  category text not null,
  phone text,
  status staff_status not null default 'ON_DUTY',
  created_at timestamptz not null default now()
);

create index staff_society_idx on staff(society_id);
create index service_providers_society_idx on service_providers(society_id);

-- ══════════════════════════ push tokens ══════════════════════════

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  society_id uuid not null references societies(id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, token)
);

-- ══════════════════════════ audit trail (admin actions) ══════════════════════════

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references societies(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index audit_events_society_idx on audit_events(society_id);

-- ══════════════════════════════════ RLS ══════════════════════════════════

alter table societies enable row level security;
alter table towers enable row level security;
alter table flats enable row level security;
alter table profiles enable row level security;
alter table visitors enable row level security;
alter table visitor_requests enable row level security;
alter table notices enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table poll_votes enable row level security;
alter table complaints enable row level security;
alter table complaint_events enable row level security;
alter table amenities enable row level security;
alter table amenity_bookings enable row level security;
alter table maintenance_dues enable row level security;
alter table payments enable row level security;
alter table staff enable row level security;
alter table service_providers enable row level security;
alter table push_tokens enable row level security;
alter table audit_events enable row level security;

-- societies: readable only by members of that society
create policy societies_select on societies for select
  using (id = current_society_id());

-- profiles: self read/update; admin/guard read all profiles in their society
-- (guard needs resident directory search to route visitor requests); residents
-- see only their own row, never another resident's profile
create policy profiles_select_self on profiles for select
  using (
    id = auth.uid()
    or (society_id = current_society_id() and current_user_role() in ('ADMIN', 'GUARD'))
  );
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_admin_write on profiles for insert
  with check (current_user_role() = 'ADMIN' and society_id = current_society_id());
create policy profiles_admin_update on profiles for update
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

-- towers / flats: society members read; admin writes
create policy towers_select on towers for select
  using (society_id = current_society_id());
create policy towers_admin_write on towers for all
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

create policy flats_select on flats for select
  using (society_id = current_society_id());
create policy flats_admin_write on flats for all
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

-- visitors: guards create; society members (guard/admin) can read; residents
-- read only visitors tied to their own flat's requests
create policy visitors_select on visitors for select
  using (
    society_id = current_society_id()
    and (
      current_user_role() in ('GUARD', 'ADMIN')
      or exists (
        select 1 from visitor_requests vr
        where vr.visitor_id = visitors.id and vr.flat_id = current_flat_id()
      )
    )
  );
create policy visitors_guard_write on visitors for insert
  with check (current_user_role() = 'GUARD' and society_id = current_society_id());

-- visitor_requests: guard creates/updates entry-exit; resident reads/decides own
-- flat's requests; admin has no operational visitor workflow (read-only, none granted)
create policy visitor_requests_select on visitor_requests for select
  using (
    society_id = current_society_id()
    and (current_user_role() = 'GUARD' or flat_id = current_flat_id())
  );
create policy visitor_requests_guard_insert on visitor_requests for insert
  with check (
    society_id = current_society_id()
    and (
      (current_user_role() = 'GUARD' and raised_by = auth.uid())
      or (current_user_role() = 'RESIDENT' and is_pre_approved and flat_id = current_flat_id())
    )
  );
create policy visitor_requests_update on visitor_requests for update
  using (
    society_id = current_society_id()
    and (current_user_role() = 'GUARD' or flat_id = current_flat_id())
  )
  with check (society_id = current_society_id());

-- notices: published notices readable by all society members; scheduled only by admin;
-- only admin writes
create policy notices_select on notices for select
  using (
    society_id = current_society_id()
    and (state = 'PUBLISHED' or current_user_role() = 'ADMIN')
  );
create policy notices_admin_write on notices for all
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

-- polls: readable by society members; admin manages; residents vote (insert only)
create policy polls_select on polls for select
  using (society_id = current_society_id());
create policy polls_admin_write on polls for all
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

create policy poll_options_select on poll_options for select
  using (society_id = current_society_id());
create policy poll_options_admin_write on poll_options for all
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

create policy poll_votes_select on poll_votes for select
  using (society_id = current_society_id());
create policy poll_votes_resident_insert on poll_votes for insert
  with check (
    current_user_role() = 'RESIDENT'
    and society_id = current_society_id()
    and profile_id = auth.uid()
  );

-- complaints: resident reads/creates own flat's complaints; admin reads/manages all
create policy complaints_select on complaints for select
  using (
    society_id = current_society_id()
    and (current_user_role() = 'ADMIN' or flat_id = current_flat_id())
  );
create policy complaints_resident_insert on complaints for insert
  with check (
    current_user_role() = 'RESIDENT'
    and society_id = current_society_id()
    and flat_id = current_flat_id()
    and raised_by = auth.uid()
  );
create policy complaints_admin_update on complaints for update
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

create policy complaint_events_select on complaint_events for select
  using (
    society_id = current_society_id()
    and (
      current_user_role() = 'ADMIN'
      or exists (
        select 1 from complaints c
        where c.id = complaint_events.complaint_id and c.flat_id = current_flat_id()
      )
    )
  );
create policy complaint_events_admin_insert on complaint_events for insert
  with check (current_user_role() = 'ADMIN' and society_id = current_society_id());

-- amenities: readable by society members; admin manages
create policy amenities_select on amenities for select
  using (society_id = current_society_id());
create policy amenities_admin_write on amenities for all
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

create policy amenity_bookings_select on amenity_bookings for select
  using (
    society_id = current_society_id()
    and (current_user_role() = 'ADMIN' or flat_id = current_flat_id())
  );
create policy amenity_bookings_resident_insert on amenity_bookings for insert
  with check (
    current_user_role() = 'RESIDENT'
    and society_id = current_society_id()
    and flat_id = current_flat_id()
    and booked_by = auth.uid()
  );
create policy amenity_bookings_admin_update on amenity_bookings for update
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

-- dues & payments: resident reads/pays own flat's dues; admin reads all (no
-- dues-management UI required, but data stays society-scoped and readable)
create policy dues_select on maintenance_dues for select
  using (
    society_id = current_society_id()
    and (current_user_role() = 'ADMIN' or flat_id = current_flat_id())
  );

create policy payments_select on payments for select
  using (
    society_id = current_society_id()
    and (current_user_role() = 'ADMIN' or flat_id = current_flat_id())
  );
create policy payments_resident_insert on payments for insert
  with check (
    current_user_role() = 'RESIDENT'
    and society_id = current_society_id()
    and flat_id = current_flat_id()
    and paid_by = auth.uid()
  );

-- staff / service providers: admin manages; guards can read for visitor routing context
create policy staff_select on staff for select
  using (society_id = current_society_id() and current_user_role() in ('ADMIN', 'GUARD'));
create policy staff_admin_write on staff for all
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

create policy service_providers_select on service_providers for select
  using (society_id = current_society_id() and current_user_role() in ('ADMIN', 'GUARD'));
create policy service_providers_admin_write on service_providers for all
  using (current_user_role() = 'ADMIN' and society_id = current_society_id())
  with check (society_id = current_society_id());

-- push tokens: a user manages only their own token
create policy push_tokens_own on push_tokens for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and society_id = current_society_id());

-- audit trail: admin only
create policy audit_events_admin_select on audit_events for select
  using (current_user_role() = 'ADMIN' and society_id = current_society_id());
create policy audit_events_admin_insert on audit_events for insert
  with check (current_user_role() = 'ADMIN' and society_id = current_society_id());

-- ══════════════════════════════════ grants ══════════════════════════════════
-- Table-level grants just unlock access; RLS policies above are what actually
-- decide row visibility and writes for `authenticated`. `service_role` bypasses
-- RLS (BYPASSRLS) but still needs the same base grants — used by Edge Functions
-- (e.g. create-user-with-temp-password) for privileged, admin-scoped operations.

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  societies, towers, flats, profiles, visitors, visitor_requests, notices,
  polls, poll_options, poll_votes, complaints, complaint_events, amenities,
  amenity_bookings, maintenance_dues, payments, staff, service_providers,
  push_tokens, audit_events
  to authenticated, service_role;

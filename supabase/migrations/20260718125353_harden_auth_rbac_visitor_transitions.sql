-- Backend-authoritative helpers, tenant constraints, and visitor transitions.

create or replace function public.current_society_id() returns uuid language sql stable security definer set search_path = ''
as $$ select society_id from public.profiles where id = (select auth.uid()) $$;
create or replace function public.current_user_role() returns public.user_role language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;
create or replace function public.current_flat_id() returns uuid language sql stable security definer set search_path = ''
as $$ select flat_id from public.profiles where id = (select auth.uid()) $$;
revoke all on function public.current_society_id() from public, anon;
revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_flat_id() from public, anon;
grant execute on function public.current_society_id() to authenticated, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.current_flat_id() to authenticated, service_role;

create or replace function public.prevent_self_privilege_escalation() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if public.current_user_role() <> 'ADMIN' and (
    new.role <> old.role or new.society_id <> old.society_id
    or new.flat_id is distinct from old.flat_id
    or new.occupancy_type is distinct from old.occupancy_type
    or new.is_verified <> old.is_verified
    or new.must_change_password <> old.must_change_password
  ) then
    raise exception using errcode = '42501', message = 'Profile authorization fields cannot be changed by this account';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_self_privilege_escalation() from public, anon, authenticated;

-- Related rows must belong to the same society.
alter table public.towers add constraint towers_id_society_unique unique (id, society_id);
alter table public.flats add constraint flats_id_society_unique unique (id, society_id);
alter table public.profiles add constraint profiles_id_society_unique unique (id, society_id);
alter table public.visitors add constraint visitors_id_society_unique unique (id, society_id);
alter table public.polls add constraint polls_id_society_unique unique (id, society_id);
alter table public.poll_options add constraint poll_options_id_society_unique unique (id, society_id);
alter table public.complaints add constraint complaints_id_society_unique unique (id, society_id);
alter table public.amenities add constraint amenities_id_society_unique unique (id, society_id);
alter table public.maintenance_dues add constraint maintenance_dues_id_society_unique unique (id, society_id);

alter table public.flats add constraint flats_tower_id_same_society_fkey foreign key (tower_id, society_id) references public.towers (id, society_id) on delete cascade;
alter table public.profiles add constraint profiles_flat_id_same_society_fkey foreign key (flat_id, society_id) references public.flats (id, society_id) on delete set null (flat_id);
alter table public.visitor_requests add constraint visitor_requests_visitor_id_same_society_fkey foreign key (visitor_id, society_id) references public.visitors (id, society_id) on delete cascade;
alter table public.visitor_requests add constraint visitor_requests_flat_id_same_society_fkey foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade;
alter table public.visitor_requests add constraint visitor_requests_raised_by_same_society_fkey foreign key (raised_by, society_id) references public.profiles (id, society_id) on delete set null (raised_by);
alter table public.visitor_requests add constraint visitor_requests_decision_by_same_society_fkey foreign key (decision_by, society_id) references public.profiles (id, society_id) on delete set null (decision_by);
alter table public.notices add constraint notices_created_by_same_society_fkey foreign key (created_by, society_id) references public.profiles (id, society_id) on delete set null (created_by);
alter table public.polls add constraint polls_created_by_same_society_fkey foreign key (created_by, society_id) references public.profiles (id, society_id) on delete set null (created_by);
alter table public.poll_options add constraint poll_options_poll_id_same_society_fkey foreign key (poll_id, society_id) references public.polls (id, society_id) on delete cascade;
alter table public.poll_votes add constraint poll_votes_poll_id_same_society_fkey foreign key (poll_id, society_id) references public.polls (id, society_id) on delete cascade;
alter table public.poll_votes add constraint poll_votes_option_id_same_society_fkey foreign key (option_id, society_id) references public.poll_options (id, society_id) on delete cascade;
alter table public.poll_votes add constraint poll_votes_profile_id_same_society_fkey foreign key (profile_id, society_id) references public.profiles (id, society_id) on delete cascade;
alter table public.complaints add constraint complaints_flat_id_same_society_fkey foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade;
alter table public.complaints add constraint complaints_raised_by_same_society_fkey foreign key (raised_by, society_id) references public.profiles (id, society_id) on delete cascade;
alter table public.complaints add constraint complaints_assignee_same_society_fkey foreign key (assignee, society_id) references public.profiles (id, society_id) on delete set null (assignee);
alter table public.complaint_events add constraint complaint_events_complaint_id_same_society_fkey foreign key (complaint_id, society_id) references public.complaints (id, society_id) on delete cascade;
alter table public.complaint_events add constraint complaint_events_created_by_same_society_fkey foreign key (created_by, society_id) references public.profiles (id, society_id) on delete set null (created_by);
alter table public.amenity_bookings add constraint amenity_bookings_amenity_id_same_society_fkey foreign key (amenity_id, society_id) references public.amenities (id, society_id) on delete cascade;
alter table public.amenity_bookings add constraint amenity_bookings_flat_id_same_society_fkey foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade;
alter table public.amenity_bookings add constraint amenity_bookings_booked_by_same_society_fkey foreign key (booked_by, society_id) references public.profiles (id, society_id) on delete cascade;
alter table public.maintenance_dues add constraint maintenance_dues_flat_id_same_society_fkey foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade;
alter table public.payments add constraint payments_due_id_same_society_fkey foreign key (due_id, society_id) references public.maintenance_dues (id, society_id) on delete cascade;
alter table public.payments add constraint payments_flat_id_same_society_fkey foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade;
alter table public.payments add constraint payments_paid_by_same_society_fkey foreign key (paid_by, society_id) references public.profiles (id, society_id) on delete set null (paid_by);
alter table public.push_tokens add constraint push_tokens_profile_id_same_society_fkey foreign key (profile_id, society_id) references public.profiles (id, society_id) on delete cascade;
alter table public.audit_events add constraint audit_events_actor_id_same_society_fkey foreign key (actor_id, society_id) references public.profiles (id, society_id) on delete set null (actor_id);

-- Direct UPDATE policies cannot restrict which columns a client changes.
drop policy if exists visitor_requests_resident_decide on public.visitor_requests;
drop policy if exists visitor_requests_guard_update on public.visitor_requests;
revoke update on public.visitor_requests from authenticated;

create or replace function public.decide_visitor_request(request_id uuid, decision public.visitor_request_status)
returns public.visitor_requests language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles%rowtype; request public.visitor_requests%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.role <> 'RESIDENT' or actor.flat_id is null then
    raise exception using errcode = '42501', message = 'Only residents can decide visitor requests';
  end if;
  if decision is null or decision not in ('APPROVED', 'REJECTED', 'LEFT_AT_GATE') then
    raise exception using errcode = '22023', message = 'Invalid visitor decision';
  end if;
  select * into request from public.visitor_requests where id = request_id for update;
  if request.id is null or request.society_id <> actor.society_id or request.flat_id <> actor.flat_id then
    raise exception using errcode = '42501', message = 'Visitor request is not available to this resident';
  end if;
  if request.status <> 'PENDING' then raise exception using errcode = '22023', message = 'Visitor request has already been decided'; end if;
  update public.visitor_requests set status = decision, decision_by = actor.id, decision_at = statement_timestamp()
  where id = request.id returning * into request;
  return request;
end;
$$;

create or replace function public.mark_visitor_entry(request_id uuid)
returns public.visitor_requests language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles%rowtype; request public.visitor_requests%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.role <> 'GUARD' then raise exception using errcode = '42501', message = 'Only guards can mark visitor entry'; end if;
  select * into request from public.visitor_requests where id = request_id for update;
  if request.id is null or request.society_id <> actor.society_id then raise exception using errcode = '42501', message = 'Visitor request is not available to this guard'; end if;
  if request.status <> 'APPROVED' or request.entry_at is not null then raise exception using errcode = '22023', message = 'Only an approved visitor can enter'; end if;
  update public.visitor_requests set status = 'ENTERED', entry_at = statement_timestamp()
  where id = request.id returning * into request;
  return request;
end;
$$;

create or replace function public.mark_visitor_exit(request_id uuid)
returns public.visitor_requests language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles%rowtype; request public.visitor_requests%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.role <> 'GUARD' then raise exception using errcode = '42501', message = 'Only guards can mark visitor exit'; end if;
  select * into request from public.visitor_requests where id = request_id for update;
  if request.id is null or request.society_id <> actor.society_id then raise exception using errcode = '42501', message = 'Visitor request is not available to this guard'; end if;
  if request.status <> 'ENTERED' or request.entry_at is null or request.exit_at is not null then raise exception using errcode = '22023', message = 'Only an entered visitor can exit'; end if;
  update public.visitor_requests set status = 'EXITED', exit_at = statement_timestamp()
  where id = request.id returning * into request;
  return request;
end;
$$;

revoke all on function public.decide_visitor_request(uuid, public.visitor_request_status) from public, anon;
revoke all on function public.mark_visitor_entry(uuid) from public, anon;
revoke all on function public.mark_visitor_exit(uuid) from public, anon;
grant execute on function public.decide_visitor_request(uuid, public.visitor_request_status) to authenticated;
grant execute on function public.mark_visitor_entry(uuid) to authenticated;
grant execute on function public.mark_visitor_exit(uuid) to authenticated;

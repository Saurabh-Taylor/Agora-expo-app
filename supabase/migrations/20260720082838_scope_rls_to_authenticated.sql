-- App tables are exposed only to signed-in users; ownership remains in USING/WITH CHECK.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

alter policy profiles_select_self on public.profiles
  using (
    id = (select auth.uid())
    or (society_id = public.current_society_id() and public.current_user_role() in ('ADMIN', 'GUARD'))
  );
alter policy profiles_update_self on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
alter policy visitor_requests_guard_insert on public.visitor_requests
  with check (
    society_id = public.current_society_id()
    and (
      (public.current_user_role() = 'GUARD' and raised_by = (select auth.uid()))
      or (
        public.current_user_role() = 'RESIDENT'
        and is_pre_approved
        and flat_id = public.current_flat_id()
      )
    )
  );
alter policy poll_votes_resident_insert on public.poll_votes
  with check (
    public.current_user_role() = 'RESIDENT'
    and society_id = public.current_society_id()
    and profile_id = (select auth.uid())
  );
alter policy complaints_resident_insert on public.complaints
  with check (
    public.current_user_role() = 'RESIDENT'
    and society_id = public.current_society_id()
    and flat_id = public.current_flat_id()
    and raised_by = (select auth.uid())
  );
alter policy amenity_bookings_resident_insert on public.amenity_bookings
  with check (
    public.current_user_role() = 'RESIDENT'
    and society_id = public.current_society_id()
    and flat_id = public.current_flat_id()
    and booked_by = (select auth.uid())
  );
alter policy payments_resident_insert on public.payments
  with check (
    public.current_user_role() = 'RESIDENT'
    and society_id = public.current_society_id()
    and flat_id = public.current_flat_id()
    and paid_by = (select auth.uid())
    and exists (
      select 1
      from public.maintenance_dues d
      where d.id = payments.due_id
        and d.status = 'UNPAID'
        and d.flat_id = public.current_flat_id()
    )
  );
alter policy push_tokens_own on public.push_tokens
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and society_id = public.current_society_id()
  );

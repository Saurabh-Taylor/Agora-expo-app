alter policy visitor_requests_guard_insert on public.visitor_requests
  to authenticated
  with check (
    society_id = public.current_society_id()
    and (
      (
        public.current_user_role() = 'GUARD'
        and raised_by = (select auth.uid())
        and status = 'PENDING'
        and not is_pre_approved
        and decision_by is null
        and decision_at is null
        and entry_at is null
        and exit_at is null
        and gate_pass_code is null
      )
      or (
        public.current_user_role() = 'RESIDENT'
        and flat_id = public.current_flat_id()
        and raised_by is null
        and status = 'APPROVED'
        and is_pre_approved
        and decision_by = (select auth.uid())
        and decision_at is not null
        and entry_at is null
        and exit_at is null
        and gate_pass_code is not null
      )
    )
  );

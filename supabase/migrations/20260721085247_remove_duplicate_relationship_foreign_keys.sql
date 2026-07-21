-- Keep one canonical relationship per logical link. Composite foreign keys
-- retain same-society integrity while avoiding ambiguous PostgREST embeds.
set lock_timeout = '5s';

alter table public.flats drop constraint flats_tower_id_fkey;
alter table public.profiles drop constraint profiles_flat_id_fkey;
alter table public.visitor_requests drop constraint visitor_requests_visitor_id_fkey;
alter table public.visitor_requests drop constraint visitor_requests_flat_id_fkey;
alter table public.visitor_requests drop constraint visitor_requests_raised_by_fkey;
alter table public.visitor_requests drop constraint visitor_requests_decision_by_fkey;
alter table public.notices drop constraint notices_created_by_fkey;
alter table public.polls drop constraint polls_created_by_fkey;
alter table public.poll_options drop constraint poll_options_poll_id_fkey;
alter table public.poll_votes drop constraint poll_votes_poll_id_fkey;
alter table public.poll_votes drop constraint poll_votes_option_id_fkey;
alter table public.poll_votes drop constraint poll_votes_profile_id_fkey;
alter table public.complaints drop constraint complaints_flat_id_fkey;
alter table public.complaints drop constraint complaints_raised_by_fkey;
alter table public.complaints drop constraint complaints_assignee_fkey;
alter table public.complaint_events drop constraint complaint_events_complaint_id_fkey;
alter table public.complaint_events drop constraint complaint_events_created_by_fkey;
alter table public.amenity_bookings drop constraint amenity_bookings_amenity_id_fkey;
alter table public.amenity_bookings drop constraint amenity_bookings_flat_id_fkey;
alter table public.amenity_bookings drop constraint amenity_bookings_booked_by_fkey;
alter table public.maintenance_dues drop constraint maintenance_dues_flat_id_fkey;
alter table public.payments drop constraint payments_due_id_fkey;
alter table public.payments drop constraint payments_flat_id_fkey;
alter table public.payments drop constraint payments_paid_by_fkey;
alter table public.push_tokens drop constraint push_tokens_profile_id_fkey;
alter table public.audit_events drop constraint audit_events_actor_id_fkey;

reset lock_timeout;

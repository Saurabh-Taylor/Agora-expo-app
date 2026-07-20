import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { titleCase } from '@/commonFunctions';
import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export type VisitorCategory = 'DELIVERY' | 'GUEST' | 'SERVICE' | 'CAB';
export type VisitorRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEFT_AT_GATE' | 'ENTERED' | 'EXITED';

export type VisitorRequestWithVisitor = {
  id: string;
  status: VisitorRequestStatus;
  created_at: string;
  flat_id: string;
  visitor: { name: string; category: VisitorCategory } | null;
  flat: { number: string; tower: { code: string } | null } | null;
};

export function usePendingVisitorRequests(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['visitor-requests', 'pending', societyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select('id, status, created_at, flat_id, visitor:visitors(name, category), flat:flats(number, tower:towers(code))')
        .eq('society_id', societyId as string)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as VisitorRequestWithVisitor[];
    },
    enabled: !!societyId,
  });
}

export function useTodaysVisitorRequestsCount(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['visitor-requests', 'today-count', societyId],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from('visitor_requests')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId as string)
        .gte('created_at', startOfDay.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!societyId,
  });
}

export type GuardResidentSearchResult = {
  id: string;
  society_id: string;
  full_name: string;
  flat_id: string;
  flat_number: string;
  tower_id: string;
  tower_code: string;
};

export function useGuardResidentSearch(search: string, societyId: string | null | undefined) {
  const normalizedSearch = search.trim();
  return useQuery({
    queryKey: ['guard-resident-search', societyId, normalizedSearch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_guard_residents', {
        requested_search: normalizedSearch,
      });
      if (error) throw error;

      const residents = (data ?? []) as GuardResidentSearchResult[];
      if (residents.some((resident) => resident.society_id !== societyId)) {
        throw new Error('Resident search returned an invalid society scope');
      }
      return residents;
    },
    enabled: !!societyId,
    staleTime: 15_000,
  });
}

type CreateVisitorRequestInput = {
  societyId: string;
  flatId: string;
  visitorName: string;
  visitorPhone?: string;
  category: VisitorCategory;
};

type CreatedVisitorRequest = {
  id: string;
  society_id: string;
  visitor_id: string;
  flat_id: string;
  raised_by: string | null;
  status: VisitorRequestStatus;
  gate_pass_code: string | null;
};

export function useCreateVisitorRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateVisitorRequestInput) => {
      const { data, error } = await supabase.rpc('create_guard_visitor_request', {
        requested_flat_id: input.flatId,
        requested_name: input.visitorName,
        requested_phone: input.visitorPhone ?? null,
        requested_category: input.category,
      });
      if (error) throw error;

      const request = data as CreatedVisitorRequest | null;
      if (
        !request ||
        request.society_id !== input.societyId ||
        request.flat_id !== input.flatId ||
        request.status !== 'PENDING'
      ) {
        throw new Error('Visitor request returned an invalid authorization scope');
      }

      return {
        visitor: { name: input.visitorName, category: input.category },
        request,
      };
    },
    onSuccess: ({ visitor, request }) => {
      queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
      sendPushNotification({
        flatId: request.flat_id,
        title: `${visitor.name} is at the gate`,
        body: `${titleCase(visitor.category)} - Tap to respond`,
        data: { type: 'VISITOR_REQUEST', requestId: request.id },
      });
    },
  });
}

// ══════════════════════════ resident side ══════════════════════════

export type VisitorRequestForFlat = {
  id: string;
  status: VisitorRequestStatus;
  is_pre_approved: boolean;
  created_at: string;
  decision_at: string | null;
  entry_at: string | null;
  exit_at: string | null;
  gate_pass_code: string | null;
  flat_id: string;
  raised_by: string | null;
  visitor: { name: string; category: VisitorCategory; phone: string | null } | null;
};

const FLAT_REQUEST_SELECT =
  'id, status, is_pre_approved, created_at, decision_at, entry_at, exit_at, gate_pass_code, flat_id, raised_by, visitor:visitors(name, category, phone)';

export function useFlatVisitorRequests(
  flatId: string | null | undefined,
  societyId: string | null | undefined,
  limit = 10,
) {
  return useQuery({
    queryKey: ['visitor-requests', 'flat', societyId, flatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select(FLAT_REQUEST_SELECT)
        .eq('flat_id', flatId as string)
        .eq('society_id', societyId as string)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as VisitorRequestForFlat[];
    },
    enabled: !!flatId && !!societyId,
  });
}

export type VisitorRequestDetail = VisitorRequestForFlat & {
  flat: { number: string; tower: { code: string; name: string } | null } | null;
};

export function useVisitorRequestDetail(id: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['visitor-requests', 'detail', societyId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select(`${FLAT_REQUEST_SELECT}, flat:flats(number, tower:towers(code, name))`)
        .eq('id', id as string)
        .eq('society_id', societyId as string)
        .single();
      if (error) throw error;
      return data as unknown as VisitorRequestDetail;
    },
    enabled: !!id && !!societyId,
  });
}

export function useAwaitingEntryCount(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['visitor-requests', 'awaiting-entry-count', societyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('visitor_requests')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId as string)
        .eq('status', 'APPROVED')
        .is('entry_at', null);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!societyId,
  });
}

// ══════════════════════════ guard: movement log ══════════════════════════

// Society-wide feed — doubles as both the "live movement log" and "visitor
// history" AGENTS.md calls for, rather than building two near-duplicate
// screens. Ordered by created_at, so a just-exited visitor doesn't jump back
// to the top on exit; acceptable for a hackathon-scale demo.
export function useSocietyVisitorRequests(societyId: string | null | undefined, limit = 50) {
  return useQuery({
    queryKey: ['visitor-requests', 'society', societyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select(`${FLAT_REQUEST_SELECT}, flat:flats(number, tower:towers(code, name))`)
        .eq('society_id', societyId as string)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as VisitorRequestDetail[];
    },
    enabled: !!societyId,
  });
}

type MarkEntryInput = { id: string };

export function useMarkEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: MarkEntryInput) => {
      const { data, error } = await supabase.rpc('mark_visitor_entry', { request_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
    },
  });
}

type MarkExitInput = { id: string };

export function useMarkExit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: MarkExitInput) => {
      const { data, error } = await supabase.rpc('mark_visitor_exit', { request_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
    },
  });
}

// Subscribes to visitor_requests changes for a flat (resident) or a whole
// society (guard) and invalidates every visitor-requests query on any change —
// the in-app Realtime fallback AGENTS.md requires push to degrade to.
let realtimeChannelSequence = 0;

export function useVisitorRequestsRealtimeSync(
  filterColumn: 'flat_id' | 'society_id',
  filterValue: string | null | undefined,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!filterValue) return;

    // supabase.channel(topic) returns the existing channel if one with the
    // same topic is still registered — e.g. a fast unmount/remount (a Home
    // screen replaced by router.replace while its own removeChannel is still
    // in flight) would otherwise hand back an already-subscribed channel and
    // .on(...).subscribe() throws. A sequence suffix guarantees a fresh topic
    // per mount so two instances never collide.
    realtimeChannelSequence += 1;
    const channel = supabase
      .channel(`visitor_requests:${filterColumn}:${filterValue}:${realtimeChannelSequence}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitor_requests', filter: `${filterColumn}=eq.${filterValue}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterColumn, filterValue, queryClient]);
}

type DecideVisitorRequestInput = {
  id: string;
  decision: 'APPROVED' | 'REJECTED' | 'LEFT_AT_GATE';
  raisedBy: string | null;
  visitorName: string;
};

export function useDecideVisitorRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: DecideVisitorRequestInput) => {
      const { data, error } = await supabase.rpc('decide_visitor_request', {
        request_id: id,
        decision,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
      if (!variables.raisedBy) return;
      const decisionLabel =
        variables.decision === 'APPROVED'
          ? 'approved'
          : variables.decision === 'REJECTED'
            ? 'denied'
            : 'asked to leave it at the gate';
      sendPushNotification({
        profileIds: [variables.raisedBy],
        title: `${variables.visitorName} — ${decisionLabel}`,
        body: `The resident ${decisionLabel} this visitor request.`,
        data: { type: 'VISITOR_DECISION', requestId: variables.id },
      });
    },
  });
}

type CreatePreApprovalInput = {
  societyId: string;
  visitorName: string;
  visitorPhone?: string;
  category: VisitorCategory;
};

export function useCreatePreApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePreApprovalInput) => {
      const { data, error } = await supabase.rpc('create_resident_visitor_preapproval', {
        requested_name: input.visitorName,
        requested_phone: input.visitorPhone ?? null,
        requested_category: input.category,
      });
      if (error) throw error;

      const request = data as CreatedVisitorRequest | null;
      if (
        !request ||
        request.society_id !== input.societyId ||
        request.status !== 'APPROVED' ||
        !request.gate_pass_code
      ) {
        throw new Error('Pre-approval returned an invalid authorization scope');
      }

      return { request, gatePassCode: request.gate_pass_code };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
    },
  });
}

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  getEffectiveVisitorRequestStatus,
  getUniqueRealtimeChannelTopic,
  isVisitorReadyForEntry,
  titleCase,
} from '@/commonFunctions';
import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export type VisitorCategory = 'DELIVERY' | 'GUEST' | 'SERVICE' | 'CAB';
export type VisitorRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'LEFT_AT_GATE'
  | 'ENTERED'
  | 'EXITED'
  | 'CANCELLED'
  | 'EXPIRED';

export type AdminVisitorHistoryFilters = {
  since: string | null;
  status: VisitorRequestStatus | 'ALL';
  category: VisitorCategory | 'ALL';
  towerId: string | null;
  flatNumber: string | null;
};

export type AdminVisitorHistoryItem = {
  request_id: string;
  society_id: string;
  status: VisitorRequestStatus;
  is_pre_approved: boolean;
  created_at: string;
  decision_at: string | null;
  entry_at: string | null;
  exit_at: string | null;
  visitor_name: string;
  visitor_category: VisitorCategory;
  flat_id: string;
  flat_number: string;
  tower_id: string;
  tower_code: string;
  tower_name: string;
};

type AdminVisitorHistoryCursor = { createdAt: string; id: string };

const ADMIN_VISITOR_HISTORY_PAGE_SIZE = 25;

export function useAdminVisitorHistory(
  societyId: string | null | undefined,
  filters: AdminVisitorHistoryFilters,
) {
  return useInfiniteQuery({
    queryKey: ['visitor-requests', 'admin-history', societyId, filters],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as AdminVisitorHistoryCursor | null;
      const { data, error } = await supabase.rpc('list_admin_visitor_history', {
        requested_limit: ADMIN_VISITOR_HISTORY_PAGE_SIZE + 1,
        cursor_created_at: cursor?.createdAt ?? null,
        cursor_id: cursor?.id ?? null,
        requested_since: filters.since,
        requested_status: filters.status === 'ALL' ? null : filters.status,
        requested_category: filters.category === 'ALL' ? null : filters.category,
        requested_tower_id: filters.towerId,
        requested_flat_number: filters.flatNumber,
      });
      if (error) throw error;

      const rows = (data ?? []) as AdminVisitorHistoryItem[];
      if (rows.some((row) => row.society_id !== societyId)) {
        throw new Error('Visitor history returned an invalid society scope');
      }

      const items = rows.slice(0, ADMIN_VISITOR_HISTORY_PAGE_SIZE);
      const lastItem = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > ADMIN_VISITOR_HISTORY_PAGE_SIZE && lastItem
            ? { createdAt: lastItem.created_at, id: lastItem.request_id }
            : null,
      };
    },
    initialPageParam: null as AdminVisitorHistoryCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!societyId,
  });
}

export type VisitorRequestWithVisitor = {
  id: string;
  status: VisitorRequestStatus;
  created_at: string;
  flat_id: string;
  visitor: { name: string; category: VisitorCategory } | null;
  flat: { number: string; tower: { code: string } | null } | null;
};

const VISITOR_REQUEST_SELECT =
  'id, society_id, status, is_pre_approved, created_at, decision_at, entry_at, exit_at, gate_pass_code, valid_until, flat_id, raised_by, visitor:visitors(name, category, phone)';
const VISITOR_REQUEST_WITH_FLAT_SELECT =
  VISITOR_REQUEST_SELECT +
  ', flat:flats(number, tower:towers(code, name))';

export function usePendingVisitorRequests(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['visitor-requests', 'pending', societyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select(VISITOR_REQUEST_WITH_FLAT_SELECT)
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
  valid_until: string | null;
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
  society_id: string;
  status: VisitorRequestStatus;
  is_pre_approved: boolean;
  created_at: string;
  decision_at: string | null;
  entry_at: string | null;
  exit_at: string | null;
  gate_pass_code: string | null;
  valid_until: string | null;
  flat_id: string;
  raised_by: string | null;
  visitor: { name: string; category: VisitorCategory; phone: string | null } | null;
};

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
        .select(VISITOR_REQUEST_SELECT)
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

export function useActiveGatePasses(
  flatId: string | null | undefined,
  societyId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['visitor-requests', 'active-gate-passes', societyId, flatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select(VISITOR_REQUEST_SELECT)
        .eq('flat_id', flatId as string)
        .eq('society_id', societyId as string)
        .eq('is_pre_approved', true)
        .eq('status', 'APPROVED')
        .is('entry_at', null)
        .gt('valid_until', new Date().toISOString())
        .order('valid_until', { ascending: true });
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
        .select(VISITOR_REQUEST_WITH_FLAT_SELECT)
        .eq('id', id as string)
        .eq('society_id', societyId as string)
        .single();
      if (error) throw error;
      return data as unknown as VisitorRequestDetail;
    },
    enabled: !!id && !!societyId,
    staleTime: 10_000,
  });
}

export function useVerifyGatePassCode(societyId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      const { data, error } = await supabase.rpc('lookup_guard_gate_pass', {
        requested_code: code,
      });
      if (error) throw error;

      const request = ((data ?? []) as VisitorRequestDetail[])[0];
      if (!request || request.society_id !== societyId) {
        throw new Error('Gate-pass verification returned an invalid authorization scope');
      }
      if (!isVisitorReadyForEntry(request)) {
        const effectiveStatus = getEffectiveVisitorRequestStatus(request);
        if (effectiveStatus === 'EXPIRED') throw new Error('This gate pass has expired');
        if (effectiveStatus === 'CANCELLED') throw new Error('This gate pass was revoked');
        if (request.entry_at || ['ENTERED', 'EXITED'].includes(effectiveStatus)) {
          throw new Error('This gate pass has already been used');
        }
        throw new Error('This gate pass is not active');
      }

      return request;
    },
    onSuccess: (request) => {
      queryClient.setQueryData(
        ['visitor-requests', 'detail', societyId, request.id],
        request,
      );
    },
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
        .is('entry_at', null)
        .or(`is_pre_approved.eq.false,valid_until.gt.${new Date().toISOString()}`);
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
        .select(VISITOR_REQUEST_WITH_FLAT_SELECT)
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
export function useVisitorRequestsRealtimeSync(
  filterColumn: 'flat_id' | 'society_id',
  filterValue: string | null | undefined,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!filterValue) return;

    const channel = supabase
      .channel(getUniqueRealtimeChannelTopic('visitor_requests:' + filterColumn + ':' + filterValue))
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

export function useRevokePreApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data, error } = await supabase.rpc('revoke_resident_visitor_preapproval', {
        request_id: id,
      });
      if (error) throw error;
      return data as VisitorRequestForFlat;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
    },
  });
}

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
        !request.gate_pass_code ||
        !request.valid_until
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

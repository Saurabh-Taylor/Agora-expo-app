import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
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

export function usePendingVisitorRequests() {
  return useQuery({
    queryKey: ['visitor-requests', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select('id, status, created_at, flat_id, visitor:visitors(name, category), flat:flats(number, tower:towers(code))')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as VisitorRequestWithVisitor[];
    },
  });
}

export function useTodaysVisitorRequestsCount() {
  return useQuery({
    queryKey: ['visitor-requests', 'today-count'],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from('visitor_requests')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });
}

type CreateVisitorRequestInput = {
  societyId: string;
  raisedBy: string;
  flatId: string;
  visitorName: string;
  visitorPhone?: string;
  category: VisitorCategory;
};

export function useCreateVisitorRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateVisitorRequestInput) => {
      const { data: visitor, error: visitorError } = await supabase
        .from('visitors')
        .insert({
          society_id: input.societyId,
          name: input.visitorName,
          phone: input.visitorPhone || null,
          category: input.category,
        })
        .select()
        .single();
      if (visitorError) throw visitorError;

      const { data: request, error: requestError } = await supabase
        .from('visitor_requests')
        .insert({
          society_id: input.societyId,
          visitor_id: visitor.id,
          flat_id: input.flatId,
          raised_by: input.raisedBy,
          status: 'PENDING',
        })
        .select()
        .single();
      if (requestError) throw requestError;

      return { visitor, request };
    },
    onSuccess: ({ visitor, request }) => {
      queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
      sendPushNotification({
        flatId: request.flat_id,
        title: `${visitor.name} is at the gate`,
        body: `${titleCase(visitor.category)} · Tap to respond`,
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

export function useFlatVisitorRequests(flatId: string | null | undefined, limit = 10) {
  return useQuery({
    queryKey: ['visitor-requests', 'flat', flatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select(FLAT_REQUEST_SELECT)
        .eq('flat_id', flatId as string)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as VisitorRequestForFlat[];
    },
    enabled: !!flatId,
  });
}

export type VisitorRequestDetail = VisitorRequestForFlat & {
  flat: { number: string; tower: { code: string; name: string } | null } | null;
};

export function useVisitorRequestDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['visitor-requests', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select(`${FLAT_REQUEST_SELECT}, flat:flats(number, tower:towers(code, name))`)
        .eq('id', id as string)
        .single();
      if (error) throw error;
      return data as unknown as VisitorRequestDetail;
    },
    enabled: !!id,
  });
}

export function useAwaitingEntryCount() {
  return useQuery({
    queryKey: ['visitor-requests', 'awaiting-entry-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('visitor_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'APPROVED')
        .is('entry_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

// ══════════════════════════ guard: movement log ══════════════════════════

// Society-wide feed — doubles as both the "live movement log" and "visitor
// history" AGENTS.md calls for, rather than building two near-duplicate
// screens. Ordered by created_at, so a just-exited visitor doesn't jump back
// to the top on exit; acceptable for a hackathon-scale demo.
export function useSocietyVisitorRequests(limit = 50) {
  return useQuery({
    queryKey: ['visitor-requests', 'society'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visitor_requests')
        .select(`${FLAT_REQUEST_SELECT}, flat:flats(number, tower:towers(code, name))`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as VisitorRequestDetail[];
    },
  });
}

type MarkEntryInput = { id: string };

export function useMarkEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: MarkEntryInput) => {
      // Mirrors the resident decide guard: matches zero rows (already
      // entered, or not actually approved) and .single() throws instead of
      // silently re-marking.
      const { data, error } = await supabase
        .from('visitor_requests')
        .update({ status: 'ENTERED', entry_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'APPROVED')
        .is('entry_at', null)
        .select('id, status')
        .single();
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
      const { data, error } = await supabase
        .from('visitor_requests')
        .update({ status: 'EXITED', exit_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'ENTERED')
        .is('exit_at', null)
        .select('id, status')
        .single();
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // .eq('status', 'PENDING') is the duplicate-submission guard: a request
      // already decided (by this resident's other device, or stale UI) simply
      // matches zero rows and .single() throws instead of silently re-deciding.
      const { data, error } = await supabase
        .from('visitor_requests')
        .update({ status: decision, decision_by: user?.id, decision_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'PENDING')
        .select('id, status')
        .single();
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

function generateGatePassCode() {
  const part = () => Math.floor(100 + Math.random() * 900);
  return `${part()} ${part()}`;
}

type CreatePreApprovalInput = {
  societyId: string;
  flatId: string;
  visitorName: string;
  category: VisitorCategory;
};

export function useCreatePreApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePreApprovalInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // A resident can only ever *see* a visitors row once a visitor_requests
      // row links it to their own flat_id (visitors_select RLS) — so asking
      // Postgres to return this insert (Prefer: return=representation) fails
      // RLS before that link exists. Generate the id client-side and skip
      // .select() here; the visitor becomes readable once the request below
      // is created.
      const visitorId = Crypto.randomUUID();
      const { error: visitorError } = await supabase
        .from('visitors')
        .insert({ id: visitorId, society_id: input.societyId, name: input.visitorName, category: input.category });
      if (visitorError) throw visitorError;

      const gatePassCode = generateGatePassCode();
      const { data: request, error: requestError } = await supabase
        .from('visitor_requests')
        .insert({
          society_id: input.societyId,
          visitor_id: visitorId,
          flat_id: input.flatId,
          raised_by: null,
          decision_by: user?.id,
          decision_at: new Date().toISOString(),
          status: 'APPROVED',
          is_pre_approved: true,
          gate_pass_code: gatePassCode,
        })
        .select()
        .single();
      if (requestError) throw requestError;

      return { request, gatePassCode };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
    },
  });
}

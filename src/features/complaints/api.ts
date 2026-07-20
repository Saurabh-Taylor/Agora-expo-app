import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { invalidateSocietyComplaints } from '@/commonFunctions';
import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export type Complaint = {
  id: string;
  society_id: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  flat_id: string;
  raised_by: string;
  flat: { number: string; tower: { code: string } | null } | null;
  raised_by_profile: { full_name: string } | null;
};

const COMPLAINT_SELECT =
  'id, society_id, title, description, category, priority, status, created_at, updated_at, resolved_at, flat_id, raised_by, flat:flats(number, tower:towers(code)), raised_by_profile:profiles!complaints_raised_by_fkey(full_name)';

export function useOpenComplaintsCount(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['complaints', societyId, 'open-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId as string)
        .neq('status', 'RESOLVED');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!societyId,
  });
}

export function useAdminComplaints(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['complaints', societyId, 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('complaints')
        .select(COMPLAINT_SELECT)
        .eq('society_id', societyId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Complaint[];
    },
    enabled: !!societyId,
  });
}

export type ComplaintEvent = {
  id: string;
  status: ComplaintStatus;
  note: string | null;
  created_at: string;
  created_by_profile: { full_name: string } | null;
};

export function useComplaintDetail(id: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['complaints', societyId, 'detail', id],
    queryFn: async () => {
      const [complaintResult, eventsResult] = await Promise.all([
        supabase
          .from('complaints')
          .select(COMPLAINT_SELECT)
          .eq('id', id as string)
          .eq('society_id', societyId as string)
          .single(),
        supabase
          .from('complaint_events')
          .select('id, status, note, created_at, created_by_profile:profiles(full_name)')
          .eq('complaint_id', id as string)
          .eq('society_id', societyId as string)
          .order('created_at', { ascending: true }),
      ]);
      if (complaintResult.error) throw complaintResult.error;
      if (eventsResult.error) throw eventsResult.error;
      return {
        complaint: complaintResult.data as unknown as Complaint,
        events: (eventsResult.data ?? []) as unknown as ComplaintEvent[],
      };
    },
    enabled: !!id && !!societyId,
  });
}

type UpdateComplaintInput = {
  id: string;
  societyId: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  previousStatus: ComplaintStatus;
  note?: string;
};

export function useUpdateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateComplaintInput) => {
      const { data, error } = await supabase
        .rpc('update_admin_complaint', {
          target_complaint_id: input.id,
          requested_priority: input.priority,
          requested_status: input.status,
          requested_note: input.note?.trim() || null,
        })
        .single();
      if (error) throw error;
      const result = data as Complaint | null;
      if (!result || result.society_id !== input.societyId) {
        throw new Error('Updated complaint returned an invalid society scope');
      }
      return result;
    },
    onSuccess: (complaint, input) => {
      invalidateSocietyComplaints(queryClient, input.societyId);
      if (complaint.status !== input.previousStatus) {
        void sendPushNotification({
          title: 'Complaint status updated',
          body: `Your complaint is now ${complaint.status.toLowerCase().replace('_', ' ')}.`,
          data: { type: 'COMPLAINT_STATUS', complaintId: complaint.id },
        });
      }
    },
  });
}

export function useFlatComplaints(flatId: string | null | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['complaints', societyId, 'flat', flatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('complaints')
        .select(COMPLAINT_SELECT)
        .eq('flat_id', flatId as string)
        .eq('society_id', societyId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Complaint[];
    },
    enabled: !!flatId && !!societyId,
  });
}

type CreateComplaintInput = {
  societyId: string;
  flatId: string;
  title: string;
  description: string;
  category: string;
};

export function useCreateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateComplaintInput) => {
      const { data, error } = await supabase
        .rpc('create_resident_complaint', {
          requested_title: input.title,
          requested_description: input.description,
          requested_category: input.category,
        })
        .single();
      if (error) throw error;
      const result = data as Complaint | null;
      if (!result || result.society_id !== input.societyId || result.flat_id !== input.flatId) {
        throw new Error('Created complaint returned an invalid ownership scope');
      }
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyComplaints(queryClient, input.societyId),
  });
}

let complaintRealtimeSequence = 0;

export function useComplaintRealtimeSync(societyId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!societyId) return;
    complaintRealtimeSequence += 1;
    const refreshComplaints = () => {
      invalidateSocietyComplaints(queryClient, societyId);
    };
    const channel = supabase
      .channel(`complaints:${societyId}:${complaintRealtimeSequence}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints', filter: `society_id=eq.${societyId}` },
        refreshComplaints,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaint_events', filter: `society_id=eq.${societyId}` },
        refreshComplaints,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, societyId]);
}

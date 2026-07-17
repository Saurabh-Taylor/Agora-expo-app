import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export type Complaint = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  created_at: string;
  flat_id: string;
  raised_by: string;
  flat: { number: string; tower: { code: string } | null } | null;
  raised_by_profile: { full_name: string } | null;
};

const COMPLAINT_SELECT =
  'id, title, description, category, priority, status, created_at, flat_id, raised_by, flat:flats(number, tower:towers(code)), raised_by_profile:profiles!complaints_raised_by_fkey(full_name)';

export function useOpenComplaintsCount() {
  return useQuery({
    queryKey: ['open-complaints-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'RESOLVED');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

// ══════════════════════════ admin ══════════════════════════

export function useAdminComplaints() {
  return useQuery({
    queryKey: ['complaints', 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('complaints').select(COMPLAINT_SELECT).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Complaint[];
    },
  });
}

export type ComplaintEvent = {
  id: string;
  status: ComplaintStatus;
  note: string | null;
  created_at: string;
  created_by_profile: { full_name: string } | null;
};

export function useComplaintDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['complaints', 'detail', id],
    queryFn: async () => {
      const [complaintResult, eventsResult] = await Promise.all([
        supabase.from('complaints').select(COMPLAINT_SELECT).eq('id', id as string).single(),
        supabase
          .from('complaint_events')
          .select('id, status, note, created_at, created_by_profile:profiles(full_name)')
          .eq('complaint_id', id as string)
          .order('created_at', { ascending: true }),
      ]);
      if (complaintResult.error) throw complaintResult.error;
      if (eventsResult.error) throw eventsResult.error;
      return {
        complaint: complaintResult.data as unknown as Complaint,
        events: (eventsResult.data ?? []) as unknown as ComplaintEvent[],
      };
    },
    enabled: !!id,
  });
}

type UpdateComplaintInput = {
  id: string;
  societyId: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  note?: string;
};

export function useUpdateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateComplaintInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from('complaints')
        .update({ priority: input.priority, status: input.status })
        .eq('id', input.id);
      if (updateError) throw updateError;

      const { error: eventError } = await supabase.from('complaint_events').insert({
        complaint_id: input.id,
        society_id: input.societyId,
        status: input.status,
        note: input.note?.trim() || null,
        created_by: user?.id,
      });
      if (eventError) throw eventError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['open-complaints-count'] });
    },
  });
}

// ══════════════════════════ resident ══════════════════════════

export function useFlatComplaints(flatId: string | null | undefined) {
  return useQuery({
    queryKey: ['complaints', 'flat', flatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('complaints')
        .select(COMPLAINT_SELECT)
        .eq('flat_id', flatId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Complaint[];
    },
    enabled: !!flatId,
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('complaints')
        .insert({
          society_id: input.societyId,
          flat_id: input.flatId,
          raised_by: user?.id,
          title: input.title,
          description: input.description,
          category: input.category,
        })
        .select(COMPLAINT_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as Complaint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      queryClient.invalidateQueries({ queryKey: ['open-complaints-count'] });
    },
  });
}

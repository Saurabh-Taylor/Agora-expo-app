import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type VisitorCategory = 'DELIVERY' | 'GUEST' | 'SERVICE' | 'CAB';
export type VisitorRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ENTERED' | 'EXITED';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-requests'] });
    },
  });
}

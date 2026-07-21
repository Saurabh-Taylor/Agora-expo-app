import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getUniqueRealtimeChannelTopic } from '@/commonFunctions';
import { supabase } from '@/lib/supabase';

export type DuesStatus = 'UNPAID' | 'PAID';

export type MaintenanceDue = {
  id: string;
  society_id: string;
  flat_id: string;
  quarter_label: string;
  amount: number;
  due_date: string;
  status: DuesStatus;
  created_at: string;
};

export type MaintenancePayment = {
  id: string;
  due_id: string;
  society_id: string;
  flat_id: string;
  paid_by: string;
  amount: number;
  method: string;
  receipt_no: string;
  paid_at: string;
};

const duesKey = (societyId: string | null | undefined, flatId: string | null | undefined) =>
  ['dues', societyId, flatId] as const;

function assertDueScope(due: MaintenanceDue, societyId: string, flatId: string) {
  if (due.society_id !== societyId || due.flat_id !== flatId) {
    throw new Error('The server returned a maintenance due outside your flat');
  }
  return due;
}

export function useFlatDues(flatId: string | null | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: duesKey(societyId, flatId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_dues')
        .select('*')
        .eq('society_id', societyId as string)
        .eq('flat_id', flatId as string)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((due) => assertDueScope(due as MaintenanceDue, societyId as string, flatId as string));
    },
    enabled: !!flatId && !!societyId,
  });
}

export function useDueDetail(
  id: string | undefined,
  flatId: string | null | undefined,
  societyId: string | null | undefined,
) {
  return useQuery({
    queryKey: [...duesKey(societyId, flatId), id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_dues')
        .select('*')
        .eq('id', id as string)
        .eq('society_id', societyId as string)
        .eq('flat_id', flatId as string)
        .single();
      if (error) throw error;
      return assertDueScope(data as MaintenanceDue, societyId as string, flatId as string);
    },
    enabled: !!id && !!flatId && !!societyId,
  });
}

type PayDueInput = {
  dueId: string;
  societyId: string;
  flatId: string;
  method: string;
};

export function usePayMaintenanceDue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PayDueInput) => {
      const { data, error } = await supabase.rpc('pay_resident_maintenance_due', {
        target_due_id: input.dueId,
        requested_method: input.method,
      });
      if (error) throw error;
      const payment = data as MaintenancePayment;
      if (payment.society_id !== input.societyId || payment.flat_id !== input.flatId || payment.due_id !== input.dueId) {
        throw new Error('The server returned a payment outside your flat');
      }
      return payment;
    },
    onSuccess: (_data, input) => queryClient.invalidateQueries({ queryKey: duesKey(input.societyId, input.flatId) }),
  });
}

export function useDuesRealtimeSync(
  flatId: string | null | undefined,
  societyId: string | null | undefined,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!flatId || !societyId) return;
    const channel = supabase
      .channel(getUniqueRealtimeChannelTopic('dues:' + societyId + ':' + flatId))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_dues',
          filter: `society_id=eq.${societyId}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: duesKey(societyId, flatId) }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [flatId, queryClient, societyId]);
}

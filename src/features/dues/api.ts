import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type DuesStatus = 'UNPAID' | 'PAID';

export type MaintenanceDue = {
  id: string;
  quarter_label: string;
  amount: number;
  due_date: string;
  status: DuesStatus;
  created_at: string;
};

export function useFlatDues(flatId: string | null | undefined) {
  return useQuery({
    queryKey: ['dues', 'flat', flatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_dues')
        .select('*')
        .eq('flat_id', flatId as string)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MaintenanceDue[];
    },
    enabled: !!flatId,
  });
}

export function useDueDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['dues', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('maintenance_dues').select('*').eq('id', id as string).single();
      if (error) throw error;
      return data as MaintenanceDue;
    },
    enabled: !!id,
  });
}

function generateReceiptNumber() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `RCT-${random}`;
}

type CreatePaymentInput = {
  dueId: string;
  societyId: string;
  flatId: string;
  amount: number;
  method: string;
};

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // Demo-scale simulated payment — AGENTS.md doesn't require a real
      // payment gateway integration, so this records the payment directly;
      // the payments_mark_due_paid trigger flips the due to PAID server-side.
      const { data, error } = await supabase
        .from('payments')
        .insert({
          due_id: input.dueId,
          society_id: input.societyId,
          flat_id: input.flatId,
          paid_by: user?.id,
          amount: input.amount,
          method: input.method,
          receipt_no: generateReceiptNumber(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dues'] });
    },
  });
}

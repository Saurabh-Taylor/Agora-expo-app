import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assertFlatRecord,
  assertFlatRecords,
  getEdgeFunctionErrorMessage,
  getQueryKey,
  removeRealtimeSubscription,
  subscribeToRealtimeTables,
} from '@/commonFunctions';
import { QueryKeyRoots } from '@/constants/commonConstants';
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
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
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
  gateway: string | null;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  is_test: boolean;
};

const duesKey = (societyId: string | null | undefined, flatId: string | null | undefined) =>
  getQueryKey(QueryKeyRoots.dues, societyId, flatId);

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
      return assertFlatRecords(
        (data ?? []) as MaintenanceDue[],
        societyId as string,
        flatId as string,
        'The server returned maintenance dues outside your flat',
      );
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
      return assertFlatRecord(
        data as MaintenanceDue,
        societyId as string,
        flatId as string,
        'The server returned a maintenance due outside your flat',
      );
    },
    enabled: !!id && !!flatId && !!societyId,
  });
}

type CreateRazorpayOrderInput = {
  dueId: string;
  societyId: string;
  flatId: string;
};

export type RazorpayCheckoutSession = {
  attemptId: string;
  checkoutUrl: string;
  amountPaise: number;
  quarterLabel: string;
};

export function useCreateRazorpayOrder() {
  return useMutation({
    mutationFn: async (input: CreateRazorpayOrderInput) => {
      const { data, error } = await supabase.functions.invoke<RazorpayCheckoutSession>(
        'razorpay-create-order',
        { body: { dueId: input.dueId } },
      );
      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, 'Could not initialize Razorpay'));
      if (
        !data?.attemptId ||
        !data.checkoutUrl ||
        !Number.isSafeInteger(data.amountPaise) ||
        data.amountPaise < 1
      ) {
        throw new Error('Razorpay returned an invalid checkout session');
      }
      return data;
    },
  });
}

type VerifyRazorpayPaymentInput = CreateRazorpayOrderInput & {
  attemptId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export function useVerifyRazorpayPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: VerifyRazorpayPaymentInput) => {
      const { data, error } = await supabase.functions.invoke<{ payment: MaintenancePayment }>(
        'razorpay-verify-payment',
        {
          body: {
            attemptId: input.attemptId,
            razorpayOrderId: input.razorpayOrderId,
            razorpayPaymentId: input.razorpayPaymentId,
            razorpaySignature: input.razorpaySignature,
          },
        },
      );
      if (error) throw new Error(await getEdgeFunctionErrorMessage(error, 'Could not verify Razorpay payment'));
      const payment = data?.payment;
      if (!payment) throw new Error('Verified payment was not returned');
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
    const channel = subscribeToRealtimeTables(
      'dues:' + societyId + ':' + flatId,
      [{ table: 'maintenance_dues', filter: 'society_id=eq.' + societyId }],
      () => void queryClient.invalidateQueries({ queryKey: duesKey(societyId, flatId) }),
    );
    return () => {
      void removeRealtimeSubscription(channel);
    };
  }, [flatId, queryClient, societyId]);
}

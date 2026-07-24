import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assertSocietyRecords, getQueryKey, invalidateAuditEvents } from '@/commonFunctions';
import { QueryKeyRoots } from '@/constants/commonConstants';
import type { MaintenanceDue, MaintenancePayment } from '@/features/dues/api';
import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export type AdminMaintenanceInvoice = MaintenanceDue & {
  flat: {
    id: string;
    number: string;
    tower: { id: string; name: string; code: string } | null;
  } | null;
};

export type AdminMaintenancePayment = MaintenancePayment & {
  flat: { id: string; number: string; tower: { id: string; code: string } | null } | null;
  due: { id: string; quarter_label: string } | null;
  payer: { id: string; full_name: string } | null;
};

const maintenanceKey = (societyId: string | null | undefined, segment: string) =>
  getQueryKey(QueryKeyRoots.maintenance, societyId, segment);

export function useAdminMaintenanceInvoices(societyId: string | null | undefined) {
  return useQuery({
    queryKey: maintenanceKey(societyId, 'invoices'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_dues')
        .select('*, flat:flats(id, number, tower:towers(id, name, code))')
        .eq('society_id', societyId as string)
        .order('due_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return assertSocietyRecords(
        (data ?? []) as unknown as AdminMaintenanceInvoice[],
        societyId as string,
        'The server returned maintenance invoices outside this society',
      );
    },
    enabled: !!societyId,
  });
}

export function useAdminMaintenancePayments(societyId: string | null | undefined) {
  return useQuery({
    queryKey: maintenanceKey(societyId, 'payments'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(
          '*, flat:flats(id, number, tower:towers(id, code)), due:maintenance_dues(id, quarter_label), payer:profiles(id, full_name)',
        )
        .eq('society_id', societyId as string)
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return assertSocietyRecords(
        (data ?? []) as unknown as AdminMaintenancePayment[],
        societyId as string,
        'The server returned maintenance payments outside this society',
      );
    },
    enabled: !!societyId,
  });
}

type CreateMaintenanceInvoicesInput = {
  societyId: string;
  flatIds: string[];
  periodLabel: string;
  amount: number;
  dueDate: string;
};

export function useSendMaintenanceReminder() {
  return useMutation({
    mutationFn: async ({ dueId }: { dueId: string }) => {
      const sent = await sendPushNotification({
        title: 'Maintenance payment reminder',
        body: 'Open Agora to review your outstanding society dues.',
        data: { type: 'MAINTENANCE_REMINDER', dueId },
      });
      if (sent === null) throw new Error('Could not request the maintenance reminder');
      return sent;
    },
  });
}

export function useCancelMaintenanceInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dueId, societyId, reason }: { dueId: string; societyId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('cancel_admin_maintenance_due', {
        target_due_id: dueId,
        requested_reason: reason.trim(),
      });
      if (error) throw error;
      const invoice = data as MaintenanceDue;
      if (invoice.id !== dueId || invoice.society_id !== societyId) {
        throw new Error('The server returned a maintenance invoice outside this society');
      }
      return invoice;
    },
    onSuccess: (_invoice, input) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKey(input.societyId, 'invoices') });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.dues, input.societyId) });
      invalidateAuditEvents(queryClient, input.societyId);
    },
  });
}

export function useCreateMaintenanceInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMaintenanceInvoicesInput) => {
      const { data, error } = await supabase.rpc('create_admin_maintenance_dues', {
        requested_flat_ids: input.flatIds,
        requested_period_label: input.periodLabel.trim(),
        requested_amount: input.amount,
        requested_due_date: input.dueDate,
      });
      if (error) throw error;
      return assertSocietyRecords(
        (data ?? []) as MaintenanceDue[],
        input.societyId,
        'The server returned maintenance invoices outside this society',
      );
    },
    onSuccess: (_invoices, input) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKey(input.societyId, 'invoices') });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.dues, input.societyId) });
      invalidateAuditEvents(queryClient, input.societyId);
    },
  });
}

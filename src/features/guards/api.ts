import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assertSocietyRecord, getQueryKey, invalidateAuditEvents } from '@/commonFunctions';
import { QueryKeyRoots } from '@/constants/commonConstants';
import type { Profile } from '@/features/profile/api';
import { supabase } from '@/lib/supabase';

export type GuardProfile = Profile & {
  role: 'GUARD';
};

export function useGuards(societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.guards, societyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, society_id, role, full_name, phone, is_active, must_change_password, created_at')
        .eq('society_id', societyId as string)
        .eq('role', 'GUARD')
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as GuardProfile[];
    },
    enabled: !!societyId,
  });
}

export function useSetGuardActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      guardId,
      societyId,
      active,
    }: {
      guardId: string;
      societyId: string;
      active: boolean;
    }) => {
      const { data, error } = await supabase.rpc('set_admin_guard_active', {
        target_guard_id: guardId,
        requested_active: active,
      });
      if (error) throw error;
      return assertSocietyRecord(data as GuardProfile | null, societyId, 'The guard account could not be updated');
    },
    onSuccess: (guard) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.guards, guard.society_id) });
      invalidateAuditEvents(queryClient, guard.society_id);
    },
  });
}

type CreateGuardInput = {
  fullName: string;
  email: string;
  phone?: string;
  societyId: string;
};

export function useCreateGuard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGuardInput) => {
      const { data, error } = await supabase.functions.invoke<{
        userId: string;
        email: string;
        tempPassword: string;
      }>('create-user-with-temp-password', {
        body: {
          fullName: input.fullName.trim(),
          role: 'GUARD',
          email: input.email.trim().toLowerCase(),
          phone: input.phone?.trim() || undefined,
        },
      });
      if (error) throw error;
      if (!data) throw new Error('No response from server');
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.guards, input.societyId) });
      invalidateAuditEvents(queryClient, input.societyId);
    },
  });
}

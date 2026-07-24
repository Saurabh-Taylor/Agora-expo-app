import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assertSocietyRecord,
  getQueryKey,
  invalidateSocietyDirectory,
  removeRealtimeSubscription,
  subscribeToRealtimeTables,
} from '@/commonFunctions';
import { QueryKeyRoots } from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';

export type StaffStatus = 'ON_DUTY' | 'OFF_DUTY';

export type StaffMember = {
  id: string;
  society_id: string;
  name: string;
  role: string;
  shift: string | null;
  phone: string | null;
  status: StaffStatus;
  created_at: string;
  updated_at: string;
};

export type ServiceProvider = {
  id: string;
  society_id: string;
  name: string;
  category: string;
  phone: string | null;
  status: StaffStatus;
  created_at: string;
  updated_at: string;
};

const directoryKey = (societyId: string | null | undefined) => getQueryKey(QueryKeyRoots.directory, societyId);

export function useStaff(societyId: string | null | undefined) {
  return useQuery({
    queryKey: [...directoryKey(societyId), 'staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('society_id', societyId as string)
        .order('name');
      if (error) throw error;
      return (data ?? []) as StaffMember[];
    },
    enabled: !!societyId,
  });
}

export function useStaffDetail(id: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: [...directoryKey(societyId), 'staff', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', id as string)
        .eq('society_id', societyId as string)
        .single();
      if (error) throw error;
      return assertSocietyRecord(data as StaffMember, societyId as string);
    },
    enabled: !!id && !!societyId,
  });
}

type SaveStaffInput = {
  id?: string;
  societyId: string;
  name: string;
  role: string;
  shift: string;
  phone: string;
};

export function useSaveStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveStaffInput) => {
      const { data, error } = await supabase.rpc('save_admin_staff', {
        target_staff_id: input.id ?? null,
        requested_name: input.name,
        requested_role: input.role,
        requested_shift: input.shift,
        requested_phone: input.phone,
      });
      if (error) throw error;
      return assertSocietyRecord(data as StaffMember, input.societyId);
    },
    onSuccess: (_data, input) => invalidateSocietyDirectory(queryClient, input.societyId),
  });
}

type SetStaffStatusInput = { id: string; societyId: string; status: StaffStatus };

export function useSetStaffStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetStaffStatusInput) => {
      const { data, error } = await supabase.rpc('set_admin_staff_status', {
        target_staff_id: input.id,
        requested_status: input.status,
      });
      if (error) throw error;
      return assertSocietyRecord(data as StaffMember, input.societyId);
    },
    onSuccess: (_data, input) => invalidateSocietyDirectory(queryClient, input.societyId),
  });
}

export function useServiceProviders(societyId: string | null | undefined) {
  return useQuery({
    queryKey: [...directoryKey(societyId), 'service-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_providers')
        .select('*')
        .eq('society_id', societyId as string)
        .order('name');
      if (error) throw error;
      return (data ?? []) as ServiceProvider[];
    },
    enabled: !!societyId,
  });
}

export function useServiceProviderDetail(id: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: [...directoryKey(societyId), 'service-providers', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_providers')
        .select('*')
        .eq('id', id as string)
        .eq('society_id', societyId as string)
        .single();
      if (error) throw error;
      return assertSocietyRecord(data as ServiceProvider, societyId as string);
    },
    enabled: !!id && !!societyId,
  });
}

type SaveServiceProviderInput = {
  id?: string;
  societyId: string;
  name: string;
  category: string;
  phone: string;
};

export function useSaveServiceProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveServiceProviderInput) => {
      const { data, error } = await supabase.rpc('save_admin_service_provider', {
        target_provider_id: input.id ?? null,
        requested_name: input.name,
        requested_category: input.category,
        requested_phone: input.phone,
      });
      if (error) throw error;
      return assertSocietyRecord(data as ServiceProvider, input.societyId);
    },
    onSuccess: (_data, input) => invalidateSocietyDirectory(queryClient, input.societyId),
  });
}

type SetServiceProviderStatusInput = { id: string; societyId: string; status: StaffStatus };

export function useSetServiceProviderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetServiceProviderStatusInput) => {
      const { data, error } = await supabase.rpc('set_admin_service_provider_status', {
        target_provider_id: input.id,
        requested_status: input.status,
      });
      if (error) throw error;
      return assertSocietyRecord(data as ServiceProvider, input.societyId);
    },
    onSuccess: (_data, input) => invalidateSocietyDirectory(queryClient, input.societyId),
  });
}

export function useDirectoryRealtimeSync(societyId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!societyId) return;
    const channel = subscribeToRealtimeTables(
      'directory:' + societyId,
      [
        { table: 'staff', filter: 'society_id=eq.' + societyId },
        { table: 'service_providers', filter: 'society_id=eq.' + societyId },
      ],
      () => void invalidateSocietyDirectory(queryClient, societyId),
    );

    return () => {
      void removeRealtimeSubscription(channel);
    };
  }, [queryClient, societyId]);
}

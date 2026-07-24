import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assertSocietyRecord, getQueryKey, invalidateAuditEvents } from '@/commonFunctions';
import { QueryKeyRoots } from '@/constants/commonConstants';
import type { Profile } from '@/features/profile/api';
import { supabase } from '@/lib/supabase';

export type ResidentProfile = Profile & {
  flat: { id: string; number: string; floor: number; tower_id: string } | null;
};

const RESIDENT_SELECT = '*, flat:flats(id, number, floor, tower_id)';

export function useResidents(
  societyId: string | null | undefined,
  options: { activeOnly?: boolean; enabled?: boolean } = {},
) {
  const activeOnly = options.activeOnly ?? false;
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.residents, societyId, activeOnly ? 'active' : 'all'),
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(RESIDENT_SELECT)
        .eq('society_id', societyId as string)
        .eq('role', 'RESIDENT');
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query.order('full_name');
      if (error) throw error;
      return data as unknown as ResidentProfile[];
    },
    enabled: !!societyId && (options.enabled ?? true),
  });
}

export function useResident(id: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.resident, societyId, id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(RESIDENT_SELECT)
        .eq('id', id)
        .eq('society_id', societyId as string)
        .eq('role', 'RESIDENT')
        .single();
      if (error) throw error;
      return data as unknown as ResidentProfile;
    },
    enabled: !!id && !!societyId,
  });
}

export function useSetResidentVerified() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      residentId,
      societyId,
      verified,
    }: {
      residentId: string;
      societyId: string;
      verified: boolean;
    }) => {
      const { data, error } = await supabase.rpc('set_admin_resident_verified', {
        target_resident_id: residentId,
        requested_verified: verified,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ResidentProfile | null,
        societyId,
        'The resident could not be updated',
      );
    },
    onSuccess: (resident) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.residents, resident.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.resident, resident.society_id, resident.id) });
      invalidateAuditEvents(queryClient, resident.society_id);
    },
  });
}

type UpdateResidentInput = {
  residentId: string;
  societyId: string;
  fullName: string;
  phone: string;
  flatId: string;
  occupancyType: 'OWNER' | 'TENANT';
  isVerified: boolean;
};

export function useUpdateResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateResidentInput) => {
      const { data, error } = await supabase.rpc('update_admin_resident', {
        target_resident_id: input.residentId,
        requested_full_name: input.fullName.trim(),
        requested_phone: input.phone.trim(),
        requested_flat_id: input.flatId,
        requested_occupancy: input.occupancyType,
        requested_verified: input.isVerified,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ResidentProfile | null,
        input.societyId,
        'The resident could not be updated',
      );
    },
    onSuccess: (resident) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.residents, resident.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.resident, resident.society_id, resident.id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.flats, resident.society_id) });
      invalidateAuditEvents(queryClient, resident.society_id);
    },
  });
}

export function useSetResidentActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      residentId,
      societyId,
      active,
    }: {
      residentId: string;
      societyId: string;
      active: boolean;
    }) => {
      const { data, error } = await supabase.rpc('set_admin_resident_active', {
        target_resident_id: residentId,
        requested_active: active,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ResidentProfile | null,
        societyId,
        'The resident access could not be updated',
      );
    },
    onSuccess: (resident) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.residents, resident.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.resident, resident.society_id, resident.id) });
      invalidateAuditEvents(queryClient, resident.society_id);
    },
  });
}

type CreateResidentInput = {
  fullName: string;
  email: string;
  phone?: string;
  flatId: string;
  occupancyType: 'OWNER' | 'TENANT';
  isVerified: boolean;
  societyId: string;
};

export function useCreateResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateResidentInput) => {
      const { data, error } = await supabase.functions.invoke<{ userId: string; email: string; tempPassword: string }>(
        'create-user-with-temp-password',
        {
          body: {
            fullName: input.fullName,
            role: 'RESIDENT',
            email: input.email,
            phone: input.phone,
            flatId: input.flatId,
            occupancyType: input.occupancyType,
          },
        },
      );
      if (error) throw error;
      if (!data) throw new Error('No response from server');

      if (input.isVerified) {
        const { error: verifyError } = await supabase.rpc('set_admin_resident_verified', {
          target_resident_id: data.userId,
          requested_verified: true,
        });
        if (verifyError) throw verifyError;
      }
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.residents, input.societyId) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.flats, input.societyId) });
      invalidateAuditEvents(queryClient, input.societyId);
    },
  });
}

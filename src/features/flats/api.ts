import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assertSocietyRecord, getQueryKey, invalidateAuditEvents } from '@/commonFunctions';
import { QueryKeyRoots } from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';

export type Flat = {
  id: string;
  society_id: string;
  tower_id: string;
  number: string;
  floor: number;
  created_at: string;
};

export function useFlats(
  societyId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.flats, societyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flats')
        .select('*')
        .eq('society_id', societyId as string)
        .order('floor')
        .order('number');
      if (error) throw error;
      return data as Flat[];
    },
    enabled: !!societyId && (options.enabled ?? true),
  });
}

export type FlatWithTower = Flat & {
  tower: { id: string; name: string; code: string; floors: number } | null;
};

export function useFlatWithTower(flatId: string | null | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.flats, societyId, flatId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flats')
        .select('*, tower:towers(id, name, code, floors)')
        .eq('id', flatId as string)
        .eq('society_id', societyId as string)
        .single();
      if (error) throw error;
      return data as unknown as FlatWithTower;
    },
    enabled: !!flatId && !!societyId,
  });
}

type CreateFlatInput = {
  societyId: string;
  towerId: string;
  number: string;
  floor: number;
};

export function useCreateFlat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFlatInput) => {
      const { data, error } = await supabase.rpc('create_admin_flat', {
        target_tower_id: input.towerId,
        requested_number: input.number.trim(),
        requested_floor: input.floor,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as Flat | null,
        input.societyId,
        'The flat could not be created in this society',
      );
    },
    onSuccess: (flat) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.flats, flat.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.towers, flat.society_id) });
      invalidateAuditEvents(queryClient, flat.society_id);
    },
  });
}

type UpdateFlatInput = {
  id: string;
  societyId: string;
  number: string;
  floor: number;
};

export function useUpdateFlat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateFlatInput) => {
      const { data, error } = await supabase.rpc('update_admin_flat', {
        target_flat_id: input.id,
        requested_number: input.number.trim(),
        requested_floor: input.floor,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as Flat | null,
        input.societyId,
        'The flat could not be updated in this society',
      );
    },
    onSuccess: (flat) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.flats, flat.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.flats, flat.society_id, flat.id) });
      invalidateAuditEvents(queryClient, flat.society_id);
    },
  });
}

export function useDeleteEmptyFlat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; societyId: string }) => {
      const { data, error } = await supabase.rpc('delete_empty_admin_flat', { target_flat_id: id });
      if (error) throw error;
      if (data !== true) throw new Error('The flat could not be deleted');
      return true;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.flats, input.societyId) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.towers, input.societyId) });
      invalidateAuditEvents(queryClient, input.societyId);
    },
  });
}

export async function findOrCreateFlat(params: { societyId: string; towerId: string; number: string; floor: number }) {
  const { societyId, towerId, number, floor } = params;
  const { data: existing, error: findError } = await supabase
    .from('flats')
    .select('*')
    .eq('society_id', societyId)
    .eq('tower_id', towerId)
    .eq('number', number.trim().toUpperCase())
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing as Flat;

  const { data, error } = await supabase.rpc('create_admin_flat', {
    target_tower_id: towerId,
    requested_number: number.trim(),
    requested_floor: floor,
  });
  if (error) throw error;
  return assertSocietyRecord(
    data as Flat | null,
    societyId,
    'The flat could not be created in this society',
  );
}

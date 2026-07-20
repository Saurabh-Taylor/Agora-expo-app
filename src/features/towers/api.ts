import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useFlats } from '@/features/flats/api';
import { useResidents } from '@/features/residents/api';
import { supabase } from '@/lib/supabase';

export type Tower = {
  id: string;
  society_id: string;
  name: string;
  code: string;
  floors: number;
  units_per_floor: number;
  created_at: string;
};

export function useTowers(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['towers', societyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('towers')
        .select('*')
        .eq('society_id', societyId as string)
        .order('name');
      if (error) throw error;
      return data as Tower[];
    },
    enabled: !!societyId,
  });
}

type CreateTowerInput = {
  name: string;
  floors: number;
  unitsPerFloor: number;
  societyId: string;
};

export function useCreateTower() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, floors, unitsPerFloor, societyId }: CreateTowerInput) => {
      const { data, error } = await supabase.rpc('create_admin_tower', {
        requested_name: name.trim(),
        requested_floors: floors,
        requested_units_per_floor: unitsPerFloor,
      });
      if (error) throw error;
      const tower = data as Tower;
      if (!tower || tower.society_id !== societyId) throw new Error('The tower could not be created in this society');
      return tower;
    },
    onSuccess: (tower) => {
      queryClient.invalidateQueries({ queryKey: ['towers', tower.society_id] });
      queryClient.invalidateQueries({ queryKey: ['flats', tower.society_id] });
      queryClient.invalidateQueries({ queryKey: ['audit-events', tower.society_id] });
    },
  });
}

type UpdateTowerInput = {
  id: string;
  societyId: string;
  name: string;
  code: string;
};

export function useUpdateTower() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTowerInput) => {
      const { data, error } = await supabase.rpc('update_admin_tower', {
        target_tower_id: input.id,
        requested_name: input.name.trim(),
        requested_code: input.code.trim(),
      });
      if (error) throw error;
      const tower = data as Tower;
      if (!tower || tower.society_id !== input.societyId) throw new Error('The tower could not be updated in this society');
      return tower;
    },
    onSuccess: (tower) => {
      queryClient.invalidateQueries({ queryKey: ['towers', tower.society_id] });
      queryClient.invalidateQueries({ queryKey: ['audit-events', tower.society_id] });
    },
  });
}

export function useDeleteEmptyTower() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; societyId: string }) => {
      const { data, error } = await supabase.rpc('delete_empty_admin_tower', { target_tower_id: id });
      if (error) throw error;
      if (data !== true) throw new Error('The tower could not be deleted');
      return true;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['towers', input.societyId] });
      queryClient.invalidateQueries({ queryKey: ['flats', input.societyId] });
      queryClient.invalidateQueries({ queryKey: ['audit-events', input.societyId] });
    },
  });
}

export type TowerStats = Tower & {
  totalFlats: number;
  occupiedFlats: number;
  vacantFlats: number;
  owners: number;
  tenants: number;
};

// Combines towers + flats + residents into per-tower occupancy rollups.
// Shared by Home, Community, and Tower detail.
export function useTowerStats(societyId: string | null | undefined) {
  const towers = useTowers(societyId);
  const flats = useFlats(societyId);
  const residents = useResidents(societyId);

  const data = useMemo<TowerStats[] | undefined>(() => {
    if (!towers.data || !flats.data || !residents.data) return undefined;
    return towers.data.map((tower) => {
      const towerFlats = flats.data.filter((flat) => flat.tower_id === tower.id);
      const flatIds = new Set(towerFlats.map((flat) => flat.id));
      const towerResidents = residents.data.filter((resident) => resident.flat_id && flatIds.has(resident.flat_id));
      const occupiedFlatIds = new Set(towerResidents.map((resident) => resident.flat_id));
      return {
        ...tower,
        totalFlats: towerFlats.length,
        occupiedFlats: occupiedFlatIds.size,
        vacantFlats: towerFlats.length - occupiedFlatIds.size,
        owners: towerResidents.filter((resident) => resident.occupancy_type === 'OWNER').length,
        tenants: towerResidents.filter((resident) => resident.occupancy_type === 'TENANT').length,
      };
    });
  }, [towers.data, flats.data, residents.data]);

  return {
    data,
    isLoading: towers.isLoading || flats.isLoading || residents.isLoading,
    isError: towers.isError || flats.isError || residents.isError,
    refetch: () => {
      towers.refetch();
      flats.refetch();
      residents.refetch();
    },
  };
}

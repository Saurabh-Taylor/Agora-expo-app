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

export function useTowers(
  societyId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
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
    enabled: !!societyId && (options.enabled ?? true),
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
export function useTowerStats(
  societyId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const towers = useTowers(societyId, { enabled });
  const flats = useFlats(societyId, { enabled });
  const residents = useResidents(societyId, { enabled });

  const data = useMemo<TowerStats[] | undefined>(() => {
    if (!towers.data || !flats.data || !residents.data) return undefined;

    const flatTowerById = new Map<string, string>();
    const totalsByTower = new Map<string, number>();
    for (const flat of flats.data) {
      flatTowerById.set(flat.id, flat.tower_id);
      totalsByTower.set(flat.tower_id, (totalsByTower.get(flat.tower_id) ?? 0) + 1);
    }

    const occupiedByTower = new Map<string, Set<string>>();
    const ownersByTower = new Map<string, number>();
    const tenantsByTower = new Map<string, number>();
    for (const resident of residents.data) {
      if (!resident.flat_id) continue;
      const towerId = flatTowerById.get(resident.flat_id);
      if (!towerId) continue;

      const occupiedFlatIds = occupiedByTower.get(towerId) ?? new Set<string>();
      occupiedFlatIds.add(resident.flat_id);
      occupiedByTower.set(towerId, occupiedFlatIds);

      if (resident.occupancy_type === 'OWNER') {
        ownersByTower.set(towerId, (ownersByTower.get(towerId) ?? 0) + 1);
      } else if (resident.occupancy_type === 'TENANT') {
        tenantsByTower.set(towerId, (tenantsByTower.get(towerId) ?? 0) + 1);
      }
    }

    return towers.data.map((tower) => {
      const totalFlats = totalsByTower.get(tower.id) ?? 0;
      const occupiedFlats = occupiedByTower.get(tower.id)?.size ?? 0;
      return {
        ...tower,
        totalFlats,
        occupiedFlats,
        vacantFlats: totalFlats - occupiedFlats,
        owners: ownersByTower.get(tower.id) ?? 0,
        tenants: tenantsByTower.get(tower.id) ?? 0,
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

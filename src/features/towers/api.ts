import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { logAuditEvent } from '@/features/audit/api';
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

export function useTowers() {
  return useQuery({
    queryKey: ['towers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('towers').select('*').order('name');
      if (error) throw error;
      return data as Tower[];
    },
  });
}

function generateFlatNumbers(floors: number, unitsPerFloor: number) {
  const numbers: { number: string; floor: number }[] = [];
  for (let floor = 1; floor <= floors; floor++) {
    for (let unit = 1; unit <= unitsPerFloor; unit++) {
      numbers.push({ number: `${floor}${String(unit).padStart(2, '0')}`, floor });
    }
  }
  return numbers;
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
      const code = name.trim().replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || 'TW';
      const { data: tower, error: towerError } = await supabase
        .from('towers')
        .insert({ name: name.trim(), code, floors, units_per_floor: unitsPerFloor, society_id: societyId })
        .select()
        .single();
      if (towerError) throw towerError;

      const flats = generateFlatNumbers(floors, unitsPerFloor);
      const { error: flatsError } = await supabase.from('flats').insert(
        flats.map((flat) => ({
          society_id: societyId,
          tower_id: tower.id,
          number: flat.number,
          floor: flat.floor,
        })),
      );
      if (flatsError) throw flatsError;

      const { data: session } = await supabase.auth.getSession();
      if (session.session) {
        await logAuditEvent({
          societyId,
          actorId: session.session.user.id,
          action: `Added ${tower.name}`,
          detail: `${flats.length} flats created`,
        });
      }

      return tower as Tower;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['towers'] });
      queryClient.invalidateQueries({ queryKey: ['flats'] });
      queryClient.invalidateQueries({ queryKey: ['audit-events'] });
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

// Combines towers + flats + residents into per-tower occupancy rollups —
// shared by the Home overview, Community Towers/Flats tabs, and Tower detail.
export function useTowerStats() {
  const towers = useTowers();
  const flats = useFlats();
  const residents = useResidents();

  const data = useMemo<TowerStats[] | undefined>(() => {
    if (!towers.data || !flats.data || !residents.data) return undefined;
    return towers.data.map((tower) => {
      const towerFlats = flats.data.filter((f) => f.tower_id === tower.id);
      const flatIds = new Set(towerFlats.map((f) => f.id));
      const towerResidents = residents.data.filter((r) => r.flat_id && flatIds.has(r.flat_id));
      const occupiedFlatIds = new Set(towerResidents.map((r) => r.flat_id));
      return {
        ...tower,
        totalFlats: towerFlats.length,
        occupiedFlats: occupiedFlatIds.size,
        vacantFlats: towerFlats.length - occupiedFlatIds.size,
        owners: towerResidents.filter((r) => r.occupancy_type === 'OWNER').length,
        tenants: towerResidents.filter((r) => r.occupancy_type === 'TENANT').length,
      };
    });
  }, [towers.data, flats.data, residents.data]);

  return {
    data,
    isLoading: towers.isLoading || flats.isLoading || residents.isLoading,
    isError: towers.isError || flats.isError || residents.isError,
  };
}

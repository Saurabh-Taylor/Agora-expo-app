import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type Flat = {
  id: string;
  society_id: string;
  tower_id: string;
  number: string;
  floor: number;
  created_at: string;
};

export function useFlats() {
  return useQuery({
    queryKey: ['flats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('flats').select('*');
      if (error) throw error;
      return data as Flat[];
    },
  });
}

export async function findOrCreateFlat(params: { societyId: string; towerId: string; number: string; floor: number }) {
  const { societyId, towerId, number, floor } = params;
  const { data: existing, error: findError } = await supabase
    .from('flats')
    .select('*')
    .eq('tower_id', towerId)
    .eq('number', number)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing as Flat;

  const { data: created, error: createError } = await supabase
    .from('flats')
    .insert({ society_id: societyId, tower_id: towerId, number, floor })
    .select()
    .single();
  if (createError) throw createError;
  return created as Flat;
}

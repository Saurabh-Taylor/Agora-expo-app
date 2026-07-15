import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type AmenityBooking = {
  id: string;
  amenity_id: string;
  flat_id: string;
  slot_start: string;
  slot_end: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  amenity: { name: string } | null;
};

export function usePendingBookingsCount() {
  return useQuery({
    queryKey: ['pending-bookings-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('amenity_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useTodaysBookings() {
  return useQuery({
    queryKey: ['todays-bookings'],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('amenity_bookings')
        .select('*, amenity:amenities(name)')
        .eq('status', 'CONFIRMED')
        .gte('slot_start', startOfDay.toISOString())
        .lte('slot_start', endOfDay.toISOString())
        .order('slot_start');
      if (error) throw error;
      return data as unknown as AmenityBooking[];
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type AmenityBooking = {
  id: string;
  amenity_id: string;
  flat_id: string;
  slot_start: string;
  slot_end: string;
  status: BookingStatus;
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

// ══════════════════════════ amenities (shared: admin manages, resident browses) ══════════════════════════

export type Amenity = {
  id: string;
  society_id: string;
  name: string;
  description: string | null;
  open_time: string | null;
  close_time: string | null;
  created_at: string;
};

export function useAmenities() {
  return useQuery({
    queryKey: ['amenities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('amenities').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as Amenity[];
    },
  });
}

export function useAmenityDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['amenities', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('amenities').select('*').eq('id', id as string).single();
      if (error) throw error;
      return data as Amenity;
    },
    enabled: !!id,
  });
}

type CreateAmenityInput = {
  societyId: string;
  name: string;
  description: string;
  openTime: string;
  closeTime: string;
};

export function useCreateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAmenityInput) => {
      const { data, error } = await supabase
        .from('amenities')
        .insert({
          society_id: input.societyId,
          name: input.name,
          description: input.description || null,
          open_time: input.openTime,
          close_time: input.closeTime,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Amenity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['amenities'] });
    },
  });
}

// ══════════════════════════ admin: bookings on one amenity ══════════════════════════

export type AmenityBookingWithFlat = {
  id: string;
  slot_start: string;
  slot_end: string;
  status: BookingStatus;
  booked_by: string;
  flat: { number: string; tower: { code: string } | null } | null;
  booked_by_profile: { full_name: string } | null;
};

const BOOKING_SELECT =
  'id, slot_start, slot_end, status, booked_by, flat:flats(number, tower:towers(code)), booked_by_profile:profiles!amenity_bookings_booked_by_fkey(full_name)';

export function useAmenityBookings(amenityId: string | undefined) {
  return useQuery({
    queryKey: ['amenity-bookings', amenityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenity_bookings')
        .select(BOOKING_SELECT)
        .eq('amenity_id', amenityId as string)
        .order('slot_start', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AmenityBookingWithFlat[];
    },
    enabled: !!amenityId,
  });
}

type DecideBookingInput = {
  id: string;
  decision: 'CONFIRMED' | 'CANCELLED';
  bookedBy: string;
  amenityName: string;
  slotStart: string;
};

export function useDecideBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: DecideBookingInput) => {
      const { data, error } = await supabase
        .from('amenity_bookings')
        .update({ status: decision })
        .eq('id', id)
        .eq('status', 'PENDING')
        .select('id, status')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['amenity-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['pending-bookings-count'] });
      queryClient.invalidateQueries({ queryKey: ['todays-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['flat-bookings'] });
      const decisionLabel = variables.decision === 'CONFIRMED' ? 'confirmed' : 'declined';
      sendPushNotification({
        profileIds: [variables.bookedBy],
        title: `${variables.amenityName} booking ${decisionLabel}`,
        body: `Your slot on ${new Date(variables.slotStart).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} was ${decisionLabel}.`,
        data: { type: 'BOOKING_DECISION', bookingId: variables.id },
      });
    },
  });
}

// ══════════════════════════ resident: browse + book + own bookings ══════════════════════════

export type FlatBooking = {
  id: string;
  slot_start: string;
  slot_end: string;
  status: BookingStatus;
  amenity: { name: string } | null;
};

export function useFlatBookings(flatId: string | null | undefined) {
  return useQuery({
    queryKey: ['flat-bookings', flatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenity_bookings')
        .select('id, slot_start, slot_end, status, amenity:amenities(name)')
        .eq('flat_id', flatId as string)
        .order('slot_start', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FlatBooking[];
    },
    enabled: !!flatId,
  });
}

type CreateBookingInput = {
  societyId: string;
  flatId: string;
  amenityId: string;
  slotStart: string;
  slotEnd: string;
};

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('amenity_bookings')
        .insert({
          society_id: input.societyId,
          flat_id: input.flatId,
          amenity_id: input.amenityId,
          booked_by: user?.id,
          slot_start: input.slotStart,
          slot_end: input.slotEnd,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flat-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['pending-bookings-count'] });
    },
  });
}

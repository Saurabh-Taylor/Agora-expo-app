import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getUniqueRealtimeChannelTopic, invalidateSocietyAmenities } from '@/commonFunctions';
import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type Amenity = {
  id: string;
  society_id: string;
  name: string;
  description: string | null;
  open_time: string | null;
  close_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AmenityBooking = {
  id: string;
  society_id: string;
  amenity_id: string;
  flat_id: string;
  booked_by: string;
  slot_start: string;
  slot_end: string;
  status: BookingStatus;
  decided_by: string | null;
  decided_at: string | null;
  updated_at: string;
  amenity: { name: string } | null;
};

export function usePendingBookingsCount(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['amenities', societyId, 'pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('amenity_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId as string)
        .eq('status', 'PENDING');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!societyId,
  });
}

export function useTodaysBookings(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['amenities', societyId, 'today'],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('amenity_bookings')
        .select('id, society_id, amenity_id, flat_id, booked_by, slot_start, slot_end, status, decided_by, decided_at, updated_at, amenity:amenities(name)')
        .eq('society_id', societyId as string)
        .eq('status', 'CONFIRMED')
        .gte('slot_start', startOfDay.toISOString())
        .lte('slot_start', endOfDay.toISOString())
        .order('slot_start');
      if (error) throw error;
      return (data ?? []) as unknown as AmenityBooking[];
    },
    enabled: !!societyId,
  });
}

export function useAmenities(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['amenities', societyId, 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenities')
        .select('id, society_id, name, description, open_time, close_time, is_active, created_at, updated_at')
        .eq('society_id', societyId as string)
        .order('is_active', { ascending: false })
        .order('name');
      if (error) throw error;
      return (data ?? []) as Amenity[];
    },
    enabled: !!societyId,
  });
}

export function useAmenityDetail(id: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['amenities', societyId, 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenities')
        .select('id, society_id, name, description, open_time, close_time, is_active, created_at, updated_at')
        .eq('id', id as string)
        .eq('society_id', societyId as string)
        .single();
      if (error) throw error;
      return data as Amenity;
    },
    enabled: !!id && !!societyId,
  });
}

type AmenityFormInput = {
  societyId: string;
  name: string;
  description: string;
  openTime: string;
  closeTime: string;
};

export function useCreateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AmenityFormInput) => {
      const { data, error } = await supabase
        .rpc('create_admin_amenity', {
          requested_name: input.name,
          requested_description: input.description,
          requested_open_time: input.openTime,
          requested_close_time: input.closeTime,
        })
        .single();
      if (error) throw error;
      const result = data as Amenity | null;
      if (!result || result.society_id !== input.societyId) throw new Error('Created amenity returned an invalid society scope');
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyAmenities(queryClient, input.societyId),
  });
}

export function useUpdateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AmenityFormInput & { id: string }) => {
      const { data, error } = await supabase
        .rpc('update_admin_amenity', {
          target_amenity_id: input.id,
          requested_name: input.name,
          requested_description: input.description,
          requested_open_time: input.openTime,
          requested_close_time: input.closeTime,
        })
        .single();
      if (error) throw error;
      const result = data as Amenity | null;
      if (!result || result.society_id !== input.societyId) throw new Error('Updated amenity returned an invalid society scope');
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyAmenities(queryClient, input.societyId),
  });
}

export function useSetAmenityActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, societyId, isActive }: { id: string; societyId: string; isActive: boolean }) => {
      const { data, error } = await supabase
        .rpc('set_admin_amenity_active', { target_amenity_id: id, requested_active: isActive })
        .single();
      if (error) throw error;
      const result = data as Amenity | null;
      if (!result || result.society_id !== societyId) throw new Error('Amenity availability returned an invalid society scope');
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyAmenities(queryClient, input.societyId),
  });
}

export type AmenityBookingWithFlat = {
  id: string;
  society_id: string;
  amenity_id: string;
  slot_start: string;
  slot_end: string;
  status: BookingStatus;
  booked_by: string;
  decided_by: string | null;
  decided_at: string | null;
  flat: { number: string; tower: { code: string } | null } | null;
  booked_by_profile: { full_name: string } | null;
};

const BOOKING_SELECT =
  'id, society_id, amenity_id, slot_start, slot_end, status, booked_by, decided_by, decided_at, flat:flats(number, tower:towers(code)), booked_by_profile:profiles!amenity_bookings_booked_by_same_society_fkey(full_name)';

export function useAmenityBookings(amenityId: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['amenities', societyId, 'bookings', amenityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenity_bookings')
        .select(BOOKING_SELECT)
        .eq('amenity_id', amenityId as string)
        .eq('society_id', societyId as string)
        .order('slot_start', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AmenityBookingWithFlat[];
    },
    enabled: !!amenityId && !!societyId,
  });
}

type DecideBookingInput = {
  id: string;
  decision: 'CONFIRMED' | 'CANCELLED';
  societyId: string;
};

export function useDecideBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DecideBookingInput) => {
      const { data, error } = await supabase
        .rpc('decide_admin_amenity_booking', {
          target_booking_id: input.id,
          requested_decision: input.decision,
        })
        .single();
      if (error) throw error;
      const result = data as AmenityBooking | null;
      if (!result || result.society_id !== input.societyId) throw new Error('Booking decision returned an invalid society scope');
      return result;
    },
    onSuccess: (booking, input) => {
      invalidateSocietyAmenities(queryClient, input.societyId);
      void sendPushNotification({
        title: 'Amenity booking updated',
        body: `Your booking was ${booking.status === 'CONFIRMED' ? 'confirmed' : 'declined'}.`,
        data: { type: 'BOOKING_DECISION', bookingId: booking.id },
      });
    },
  });
}

export type FlatBooking = {
  id: string;
  society_id: string;
  amenity_id: string;
  slot_start: string;
  slot_end: string;
  status: BookingStatus;
  amenity: { name: string } | null;
};

export function useFlatBookings(flatId: string | null | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['amenities', societyId, 'my-bookings', flatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenity_bookings')
        .select('id, society_id, amenity_id, slot_start, slot_end, status, amenity:amenities(name)')
        .eq('flat_id', flatId as string)
        .eq('society_id', societyId as string)
        .order('slot_start', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FlatBooking[];
    },
    enabled: !!flatId && !!societyId,
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
      const { data, error } = await supabase
        .rpc('create_resident_amenity_booking', {
          target_amenity_id: input.amenityId,
          requested_slot_start: input.slotStart,
          requested_slot_end: input.slotEnd,
        })
        .single();
      if (error) throw error;
      const result = data as AmenityBooking | null;
      if (!result || result.society_id !== input.societyId || result.flat_id !== input.flatId) {
        throw new Error('Created booking returned an invalid ownership scope');
      }
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyAmenities(queryClient, input.societyId),
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, societyId }: { id: string; societyId: string }) => {
      const { data, error } = await supabase.rpc('cancel_resident_amenity_booking', { target_booking_id: id }).single();
      if (error) throw error;
      const result = data as AmenityBooking | null;
      if (!result || result.society_id !== societyId) throw new Error('Cancelled booking returned an invalid society scope');
      return result;
    },
    onSuccess: (_data, input) => invalidateSocietyAmenities(queryClient, input.societyId),
  });
}

export type UnavailableSlot = { slot_start: string; slot_end: string };

export function useAmenityUnavailableSlots(
  amenityId: string | undefined,
  societyId: string | null | undefined,
  rangeStart: string | undefined,
  rangeEnd: string | undefined,
) {
  return useQuery({
    queryKey: ['amenities', societyId, 'availability', amenityId, rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_amenity_unavailable_slots', {
        target_amenity_id: amenityId,
        range_start: rangeStart,
        range_end: rangeEnd,
      });
      if (error) throw error;
      return (data ?? []) as UnavailableSlot[];
    },
    enabled: !!amenityId && !!societyId && !!rangeStart && !!rangeEnd,
  });
}

export function useAmenityRealtimeSync(societyId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!societyId) return;
    const refreshAmenities = () => {
      invalidateSocietyAmenities(queryClient, societyId);
    };
    const channel = supabase
      .channel(getUniqueRealtimeChannelTopic('amenities:' + societyId))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'amenities', filter: `society_id=eq.${societyId}` },
        refreshAmenities,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'amenity_bookings', filter: `society_id=eq.${societyId}` },
        refreshAmenities,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, societyId]);
}

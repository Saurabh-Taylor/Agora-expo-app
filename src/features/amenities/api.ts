import { decode } from 'base64-arraybuffer';
import * as Crypto from 'expo-crypto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { assertFlatRecord, assertSocietyRecord, getAmenityRpcConfiguration, getQueryKey, invalidateSocietyAmenities, removeRealtimeSubscription, subscribeToRealtimeTables } from '@/commonFunctions';
import { AMENITY_IMAGES_BUCKET, AMENITY_IMAGE_MAX_BYTES, AMENITY_IMAGE_MAX_COUNT, AMENITY_IMAGE_SIGNED_URL_SECONDS, AmenityNotificationTypes, QueryKeyRoots } from '@/constants/commonConstants';
import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';


export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type AmenityBookingType = 'EXCLUSIVE' | 'SHARED';

export type Amenity = {
  id: string;
  society_id: string;
  name: string;
  description: string | null;
  image_paths: string[];
  open_time: string | null;
  close_time: string | null;
  booking_type: AmenityBookingType;
  slot_duration_minutes: number;
  max_bookings_per_slot: number;
  advance_booking_days: number;
  max_bookings_per_resident_per_day: number;
  requires_admin_approval: boolean;
  rules_and_regulations: string | null;
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
  slot_id: string | null;
  slot_start: string;
  slot_end: string;
  status: BookingStatus;
  status_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  updated_at: string;
  amenity: { name: string } | null;
};
export function usePendingBookingsCount(societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'pending-count'),
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
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'today'),
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('amenity_bookings')
        .select('id, society_id, amenity_id, flat_id, booked_by, slot_id, slot_start, slot_end, status, status_reason, decided_by, decided_at, updated_at, amenity:amenities(name)')
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
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'list'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenities')
        .select('id, society_id, name, description, image_paths, open_time, close_time, booking_type, slot_duration_minutes, max_bookings_per_slot, advance_booking_days, max_bookings_per_resident_per_day, requires_admin_approval, rules_and_regulations, is_active, created_at, updated_at')
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
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'detail', id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenities')
        .select('id, society_id, name, description, image_paths, open_time, close_time, booking_type, slot_duration_minutes, max_bookings_per_slot, advance_booking_days, max_bookings_per_resident_per_day, requires_admin_approval, rules_and_regulations, is_active, created_at, updated_at')
        .eq('id', id as string)
        .eq('society_id', societyId as string)
        .single();
      if (error) throw error;
      return data as Amenity;
    },
    enabled: !!id && !!societyId,
  });
}

export type AmenityFormInput = {
  societyId: string;
  name: string;
  description: string;
  openTime: string;
  closeTime: string;
  bookingType: 'EXCLUSIVE' | 'SHARED';
  slotDurationMinutes: number;
  maxBookingsPerSlot: number;
  advanceBookingDays: number;
  maxBookingsPerResidentPerDay: number;
  requiresAdminApproval: boolean;
  rulesAndRegulations: string;
};


export function useCreateAmenity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AmenityFormInput) => {
      const { data, error } = await supabase
        .rpc('create_admin_amenity', getAmenityRpcConfiguration(input))
        .single();
      if (error) throw error;
      return assertSocietyRecord(
        data as Amenity | null,
        input.societyId,
        'Created amenity returned an invalid society scope',
      );
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
          ...getAmenityRpcConfiguration(input),
        })
        .single();
      if (error) throw error;
      return assertSocietyRecord(
        data as Amenity | null,
        input.societyId,
        'Updated amenity returned an invalid society scope',
      );
    },
    onSuccess: (_data, input) => invalidateSocietyAmenities(queryClient, input.societyId),
  });
}

export type AmenityPhotoInput = {
  uri: string;
  base64: string | null;
  fileSize: number | null;
  storagePath: string | null;
};

export function useAmenityImageUrls(
  imagePaths: string[],
  societyId: string | null | undefined,
) {
  const stablePaths = [...imagePaths].sort();
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'image-urls', stablePaths),
    queryFn: async () => {
      if (stablePaths.some((path) => !path.startsWith((societyId as string) + '/'))) {
        throw new Error('Amenity photo has an invalid society scope');
      }
      if (stablePaths.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase.storage
        .from(AMENITY_IMAGES_BUCKET)
        .createSignedUrls(stablePaths, AMENITY_IMAGE_SIGNED_URL_SECONDS);
      if (error) throw error;
      return Object.fromEntries(
        (data ?? [])
          .filter((item) => !!item.signedUrl)
          .map((item) => [item.path, item.signedUrl]),
      ) as Record<string, string>;
    },
    enabled: !!societyId && stablePaths.length > 0,
    staleTime: (AMENITY_IMAGE_SIGNED_URL_SECONDS - 300) * 1000,
  });
}

export function useSetAmenityImages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      amenityId: string;
      societyId: string;
      photos: AmenityPhotoInput[];
      previousPaths: string[];
    }) => {
      const uploadedPaths: string[] = [];
      try {
        if (input.photos.length > AMENITY_IMAGE_MAX_COUNT) {
          throw new Error('An amenity can have at most 4 photos');
        }

        const uploadResults = await Promise.allSettled(
          input.photos.map(async (photo) => {
            if (photo.storagePath) return photo.storagePath;
            if (!photo.base64) throw new Error('A selected amenity photo could not be read');
            const fileBody = decode(photo.base64);
            if (
              (photo.fileSize && photo.fileSize > AMENITY_IMAGE_MAX_BYTES) ||
              fileBody.byteLength > AMENITY_IMAGE_MAX_BYTES
            ) {
              throw new Error('Each amenity photo must be smaller than 4 MB');
            }
            const path =
              input.societyId + '/' + input.amenityId + '/' + Crypto.randomUUID() + '.jpg';
            const { error } = await supabase.storage
              .from(AMENITY_IMAGES_BUCKET)
              .upload(path, fileBody, { contentType: 'image/jpeg', upsert: false });
            if (error) throw error;
            uploadedPaths.push(path);
            return path;
          }),
        );
        const failedUpload = uploadResults.find((result) => result.status === 'rejected');
        if (failedUpload?.status === 'rejected') throw failedUpload.reason;
        const imagePaths = uploadResults.map((result) =>
          result.status === 'fulfilled' ? result.value : '',
        );

        const { data, error } = await supabase
          .rpc('set_admin_amenity_images', {
            target_amenity_id: input.amenityId,
            requested_image_paths: imagePaths,
          })
          .single();
        if (error) throw error;
        const result = data as Amenity | null;
        if (!result || result.society_id !== input.societyId) {
          throw new Error('Updated amenity photos returned an invalid society scope');
        }

        const removedPaths = input.previousPaths.filter((path) => !imagePaths.includes(path));
        if (removedPaths.length > 0) {
          const { error: removeError } = await supabase.storage
            .from(AMENITY_IMAGES_BUCKET)
            .remove(removedPaths);
          if (removeError) console.warn('Could not remove superseded amenity photos', removeError);
        }
        return result;
      } catch (error) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(AMENITY_IMAGES_BUCKET).remove(uploadedPaths);
        }
        throw error;
      }
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
      return assertSocietyRecord(
        data as Amenity | null,
        societyId,
        'Amenity availability returned an invalid society scope',
      );
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
  status_reason: string | null;
  booked_by: string;
  decided_by: string | null;
  decided_at: string | null;
  flat: { number: string; tower: { code: string } | null } | null;
  booked_by_profile: { full_name: string } | null;
};

const BOOKING_SELECT =
  'id, society_id, amenity_id, slot_start, slot_end, status, status_reason, booked_by, decided_by, decided_at, flat:flats(number, tower:towers(code)), booked_by_profile:profiles!amenity_bookings_booked_by_same_society_fkey(full_name)';

export function useAmenityBookings(amenityId: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'bookings', amenityId),
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
      return assertSocietyRecord(
        data as AmenityBooking | null,
        input.societyId,
        'Booking decision returned an invalid society scope',
      );
    },
    onSuccess: (booking, input) => {
      invalidateSocietyAmenities(queryClient, input.societyId);
      void sendPushNotification({
        title: 'Amenity booking updated',
        body: `Your booking was ${booking.status === 'CONFIRMED' ? 'confirmed' : 'declined'}.`,
        data: { type: AmenityNotificationTypes.decision, bookingId: booking.id },
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
  status_reason: string | null;
  status: BookingStatus;
  amenity: { name: string } | null;
};

export function useFlatBookings(flatId: string | null | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'my-bookings', flatId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenity_bookings')
        .select('id, society_id, amenity_id, slot_start, slot_end, status, status_reason, amenity:amenities(name)')
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
  slotId: string;
  bookingDate: string;
};

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBookingInput) => {
      const { data, error } = await supabase
        .rpc('create_resident_amenity_booking', {
          target_amenity_id: input.amenityId,
          target_slot_id: input.slotId,
          requested_date: input.bookingDate,
        })
        .single();
      if (error) throw error;
      return assertFlatRecord(
        data as AmenityBooking | null,
        input.societyId,
        input.flatId,
        'Created booking returned an invalid ownership scope',
      );
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
      return assertSocietyRecord(
        data as AmenityBooking | null,
        societyId,
        'Cancelled booking returned an invalid society scope',
      );
    },
    onSuccess: (_data, input) => invalidateSocietyAmenities(queryClient, input.societyId),
  });
}

export type AmenitySlotStatus = 'AVAILABLE' | 'FULL' | 'BLOCKED' | 'PAST';

export type AmenitySlot = {
  id: string;
  society_id: string;
  amenity_id: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type AmenitySlotAvailability = {
  slot_id: string;
  slot_start: string;
  slot_end: string;
  status: AmenitySlotStatus;
  active_bookings: number;
  remaining_capacity: number;
};

export type AmenityBlock = {
  id: string;
  society_id: string;
  amenity_id: string;
  block_date: string;
  slot_id: string | null;
  reason: string;
  is_active: boolean;
  slot: { start_time: string; end_time: string } | null;
};

export function useAmenitySlots(amenityId: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'slots', amenityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenity_slots')
        .select('id, society_id, amenity_id, start_time, end_time, is_active')
        .eq('amenity_id', amenityId as string)
        .eq('society_id', societyId as string)
        .eq('is_active', true)
        .order('start_time');
      if (error) throw error;
      return (data ?? []) as AmenitySlot[];
    },
    enabled: !!amenityId && !!societyId,
  });
}

export function useAmenitySlotAvailability(
  amenityId: string | undefined,
  societyId: string | null | undefined,
  bookingDate: string | undefined,
) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'availability', amenityId, bookingDate),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_amenity_slot_availability', {
        target_amenity_id: amenityId,
        requested_date: bookingDate,
      });
      if (error) throw error;
      return (data ?? []) as AmenitySlotAvailability[];
    },
    enabled: !!amenityId && !!societyId && !!bookingDate,
  });
}

export function useAmenityBlocks(amenityId: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.amenities, societyId, 'blocks', amenityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenity_blocks')
        .select('id, society_id, amenity_id, block_date, slot_id, reason, is_active, slot:amenity_slots(start_time, end_time)')
        .eq('amenity_id', amenityId as string)
        .eq('society_id', societyId as string)
        .eq('is_active', true)
        .order('block_date');
      if (error) throw error;
      return (data ?? []) as unknown as AmenityBlock[];
    },
    enabled: !!amenityId && !!societyId,
  });
}

type CreateAmenityBlockInput = {
  amenityId: string;
  societyId: string;
  blockDate: string;
  slotId: string | null;
  reason: string;
  cancelExistingBookings: boolean;
};

export function useCreateAmenityBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAmenityBlockInput) => {
      const { data, error } = await supabase.rpc('create_admin_amenity_block', {
        target_amenity_id: input.amenityId,
        requested_block_date: input.blockDate,
        target_slot_id: input.slotId,
        requested_reason: input.reason,
        cancel_existing_bookings: input.cancelExistingBookings,
      }).single();
      if (error) throw error;
      return data as { block_id: string; cancelled_booking_ids: string[] };
    },
    onSuccess: (result, input) => {
      invalidateSocietyAmenities(queryClient, input.societyId);
      result.cancelled_booking_ids.forEach((bookingId) => {
        void sendPushNotification({
          title: 'Amenity booking cancelled',
          body: 'Your booking was cancelled because the amenity is unavailable.',
          data: { type: AmenityNotificationTypes.maintenanceCancelled, bookingId },
        });
      });
    },
  });
}

export function useRemoveAmenityBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, societyId }: { id: string; societyId: string }) => {
      const { data, error } = await supabase.rpc('remove_admin_amenity_block', {
        target_block_id: id,
      }).single();
      if (error) throw error;
      return assertSocietyRecord(
        data as AmenityBlock | null,
        societyId,
        'Removed amenity block returned an invalid society scope',
      );
    },
    onSuccess: (_data, input) => invalidateSocietyAmenities(queryClient, input.societyId),
  });
}

export function useAmenityRealtimeSync(societyId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!societyId) return;
    const refreshAmenities = () => {
      invalidateSocietyAmenities(queryClient, societyId);
    };
    const channel = subscribeToRealtimeTables(
      'amenities:' + societyId,
      [
        { table: 'amenities', filter: 'society_id=eq.' + societyId },
        { table: 'amenity_bookings', filter: 'society_id=eq.' + societyId },
        { table: 'amenity_slots', filter: 'society_id=eq.' + societyId },
        { table: 'amenity_blocks', filter: 'society_id=eq.' + societyId },
      ],
      refreshAmenities,
    );

    return () => {
      void removeRealtimeSubscription(channel);
    };
  }, [queryClient, societyId]);
}

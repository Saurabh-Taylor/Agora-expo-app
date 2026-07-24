import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assertSocietyRecord,
  assertSocietyRecords,
  getQueryKey,
  invalidateAuditEvents,
  removeRealtimeSubscription,
  subscribeToRealtimeTables,
} from '@/commonFunctions';
import { QueryKeyRoots } from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';

export const ParkingSlotTypes = ['CAR', 'BIKE', 'EV', 'ACCESSIBLE', 'FLEX'] as const;
export const ResidentVehicleTypes = ['CAR', 'BIKE', 'EV', 'OTHER'] as const;

export type ParkingSlotType = (typeof ParkingSlotTypes)[number];
export type ResidentVehicleType = (typeof ResidentVehicleTypes)[number];

export type ParkingSlot = {
  id: string;
  society_id: string;
  code: string;
  zone: string;
  level_label: string;
  row_index: number;
  column_index: number;
  slot_type: ParkingSlotType;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ResidentVehicle = {
  id: string;
  society_id: string;
  flat_id: string;
  created_by: string;
  registration_number: string;
  vehicle_type: ResidentVehicleType;
  make_model: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  flat?: {
    id: string;
    number: string;
    tower: { id: string; name: string; code: string } | null;
  } | null;
};

export type ParkingAssignment = {
  id: string;
  society_id: string;
  slot_id: string;
  vehicle_id: string;
  flat_id: string;
  assigned_by: string;
  assigned_at: string;
  ended_at: string | null;
  ended_by: string | null;
  vehicle?: ResidentVehicle | null;
  flat?: ResidentVehicle['flat'];
};

export type ParkingSlotWithAssignment = ParkingSlot & {
  assignment: ParkingAssignment | null;
};

export function useParkingLayout(societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.parking, societyId, 'layout'),
    queryFn: async () => {
      const [slotsResult, assignmentsResult] = await Promise.all([
        supabase
          .from('parking_slots')
          .select('*')
          .eq('society_id', societyId as string)
          .order('zone')
          .order('level_label')
          .order('row_index')
          .order('column_index'),
        supabase
          .from('parking_assignments')
          .select('*, vehicle:resident_vehicles(*), flat:flats(id, number, tower:towers(id, name, code))')
          .eq('society_id', societyId as string)
          .is('ended_at', null),
      ]);
      if (slotsResult.error) throw slotsResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;

      const slots = assertSocietyRecords(
        (slotsResult.data ?? []) as ParkingSlot[],
        societyId as string,
        'The server returned parking slots outside this society',
      );
      const assignments = assertSocietyRecords(
        (assignmentsResult.data ?? []) as unknown as ParkingAssignment[],
        societyId as string,
        'The server returned parking assignments outside this society',
      );
      const assignmentsBySlot = new Map(assignments.map((assignment) => [assignment.slot_id, assignment]));
      return slots.map((slot) => ({ ...slot, assignment: assignmentsBySlot.get(slot.id) ?? null }));
    },
    enabled: !!societyId,
  });
}

export function useResidentVehicles(
  societyId: string | null | undefined,
  flatId?: string | null,
) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.vehicles, societyId, flatId ?? 'society'),
    queryFn: async () => {
      let query = supabase
        .from('resident_vehicles')
        .select('*, flat:flats(id, number, tower:towers(id, name, code))')
        .eq('society_id', societyId as string)
        .eq('is_active', true)
        .order('registration_number');
      if (flatId) query = query.eq('flat_id', flatId);
      const { data, error } = await query;
      if (error) throw error;
      return assertSocietyRecords(
        (data ?? []) as unknown as ResidentVehicle[],
        societyId as string,
        'The server returned vehicles outside this society',
      );
    },
    enabled: !!societyId,
  });
}

export function useParkingRealtime(societyId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!societyId) return;
    const channel = subscribeToRealtimeTables(
      `parking:${societyId}`,
      [
        { table: 'parking_slots', filter: `society_id=eq.${societyId}` },
        { table: 'resident_vehicles', filter: `society_id=eq.${societyId}` },
        { table: 'parking_assignments', filter: `society_id=eq.${societyId}` },
      ],
      () => {
        queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.parking, societyId) });
        queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.vehicles, societyId) });
      },
    );
    return () => {
      void removeRealtimeSubscription(channel);
    };
  }, [queryClient, societyId]);
}

type CreateParkingSlotInput = {
  societyId: string;
  code: string;
  zone: string;
  levelLabel: string;
  rowIndex: number;
  columnIndex: number;
  slotType: ParkingSlotType;
};

export function useCreateParkingSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateParkingSlotInput) => {
      const { data, error } = await supabase.rpc('create_admin_parking_slot', {
        requested_code: input.code.trim(),
        requested_zone: input.zone.trim(),
        requested_level_label: input.levelLabel.trim(),
        requested_row_index: input.rowIndex,
        requested_column_index: input.columnIndex,
        requested_slot_type: input.slotType,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ParkingSlot | null,
        input.societyId,
        'The parking slot could not be created in this society',
      );
    },
    onSuccess: (slot) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.parking, slot.society_id) });
      invalidateAuditEvents(queryClient, slot.society_id);
    },
  });
}

export function useSetParkingSlotActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { societyId: string; slotId: string; active: boolean }) => {
      const { data, error } = await supabase.rpc('set_admin_parking_slot_active', {
        target_slot_id: input.slotId,
        requested_active: input.active,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ParkingSlot | null,
        input.societyId,
        'The parking slot could not be updated in this society',
      );
    },
    onSuccess: (slot) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.parking, slot.society_id) });
      invalidateAuditEvents(queryClient, slot.society_id);
    },
  });
}

type VehicleInput = {
  societyId: string;
  vehicleType: ResidentVehicleType;
  makeModel: string;
  color: string;
};

export function useCreateResidentVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: VehicleInput & { registrationNumber: string }) => {
      const { data, error } = await supabase.rpc('create_resident_vehicle', {
        requested_registration_number: input.registrationNumber.trim(),
        requested_vehicle_type: input.vehicleType,
        requested_make_model: input.makeModel.trim() || null,
        requested_color: input.color.trim() || null,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ResidentVehicle | null,
        input.societyId,
        'The vehicle could not be added to this society',
      );
    },
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.vehicles, vehicle.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.parking, vehicle.society_id) });
    },
  });
}

export function useUpdateResidentVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: VehicleInput & { vehicleId: string }) => {
      const { data, error } = await supabase.rpc('update_resident_vehicle', {
        target_vehicle_id: input.vehicleId,
        requested_vehicle_type: input.vehicleType,
        requested_make_model: input.makeModel.trim() || null,
        requested_color: input.color.trim() || null,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ResidentVehicle | null,
        input.societyId,
        'The vehicle could not be updated in this society',
      );
    },
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.vehicles, vehicle.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.parking, vehicle.society_id) });
    },
  });
}

export function useDeactivateResidentVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { societyId: string; vehicleId: string }) => {
      const { data, error } = await supabase.rpc('deactivate_resident_vehicle', {
        target_vehicle_id: input.vehicleId,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ResidentVehicle | null,
        input.societyId,
        'The vehicle could not be removed from this society',
      );
    },
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.vehicles, vehicle.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.parking, vehicle.society_id) });
    },
  });
}

export function useAssignParkingSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { societyId: string; slotId: string; vehicleId: string }) => {
      const { data, error } = await supabase.rpc('assign_admin_parking_slot', {
        target_slot_id: input.slotId,
        target_vehicle_id: input.vehicleId,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ParkingAssignment | null,
        input.societyId,
        'The parking assignment could not be created in this society',
      );
    },
    onSuccess: (assignment) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.parking, assignment.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.vehicles, assignment.society_id) });
      invalidateAuditEvents(queryClient, assignment.society_id);
    },
  });
}

export function useReleaseParkingSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { societyId: string; slotId: string }) => {
      const { data, error } = await supabase.rpc('release_admin_parking_slot', {
        target_slot_id: input.slotId,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as ParkingAssignment | null,
        input.societyId,
        'The parking assignment could not be released in this society',
      );
    },
    onSuccess: (assignment) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.parking, assignment.society_id) });
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.vehicles, assignment.society_id) });
      invalidateAuditEvents(queryClient, assignment.society_id);
    },
  });
}

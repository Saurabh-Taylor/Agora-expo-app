import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logAuditEvent } from '@/features/audit/api';
import { supabase } from '@/lib/supabase';

export type StaffStatus = 'ON_DUTY' | 'OFF_DUTY';

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  shift: string | null;
  phone: string | null;
  status: StaffStatus;
  created_at: string;
};

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as StaffMember[];
    },
  });
}

export function useStaffDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['staff', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff').select('*').eq('id', id as string).single();
      if (error) throw error;
      return data as StaffMember;
    },
    enabled: !!id,
  });
}

type CreateStaffInput = {
  societyId: string;
  name: string;
  role: string;
  shift: string;
  phone: string;
};

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateStaffInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('staff')
        .insert({
          society_id: input.societyId,
          name: input.name,
          role: input.role,
          shift: input.shift || null,
          phone: input.phone || null,
        })
        .select()
        .single();
      if (error) throw error;
      if (user) await logAuditEvent({ societyId: input.societyId, actorId: user.id, action: `Added staff member ${input.name}` });
      return data as StaffMember;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

type ToggleStaffStatusInput = { id: string; societyId: string; name: string; status: StaffStatus };

export function useToggleStaffStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ToggleStaffStatusInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from('staff').update({ status: input.status }).eq('id', input.id);
      if (error) throw error;
      if (user) {
        await logAuditEvent({
          societyId: input.societyId,
          actorId: user.id,
          action: `Marked ${input.name} as ${input.status === 'ON_DUTY' ? 'on duty' : 'off duty'}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

// ══════════════════════════ service providers ══════════════════════════

export type ServiceProvider = {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  status: StaffStatus;
  created_at: string;
};

export function useServiceProviders() {
  return useQuery({
    queryKey: ['service-providers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('service_providers').select('*').order('name');
      if (error) throw error;
      return (data ?? []) as ServiceProvider[];
    },
  });
}

export function useServiceProviderDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['service-providers', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('service_providers').select('*').eq('id', id as string).single();
      if (error) throw error;
      return data as ServiceProvider;
    },
    enabled: !!id,
  });
}

type CreateServiceProviderInput = {
  societyId: string;
  name: string;
  category: string;
  phone: string;
};

export function useCreateServiceProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateServiceProviderInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('service_providers')
        .insert({
          society_id: input.societyId,
          name: input.name,
          category: input.category,
          phone: input.phone || null,
        })
        .select()
        .single();
      if (error) throw error;
      if (user) await logAuditEvent({ societyId: input.societyId, actorId: user.id, action: `Added service provider ${input.name}` });
      return data as ServiceProvider;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-providers'] });
    },
  });
}

type ToggleServiceProviderStatusInput = { id: string; societyId: string; name: string; status: StaffStatus };

export function useToggleServiceProviderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ToggleServiceProviderStatusInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from('service_providers').update({ status: input.status }).eq('id', input.id);
      if (error) throw error;
      if (user) {
        await logAuditEvent({
          societyId: input.societyId,
          actorId: user.id,
          action: `Marked ${input.name} as ${input.status === 'ON_DUTY' ? 'on duty' : 'off duty'}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-providers'] });
    },
  });
}

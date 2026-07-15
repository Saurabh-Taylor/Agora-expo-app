import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logAuditEvent } from '@/features/audit/api';
import type { Profile } from '@/features/profile/api';
import { supabase } from '@/lib/supabase';

export type ResidentProfile = Profile & {
  flat: { id: string; number: string; floor: number; tower_id: string } | null;
};

export function useResidents() {
  return useQuery({
    queryKey: ['residents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, flat:flats(id, number, floor, tower_id)')
        .eq('role', 'RESIDENT')
        .order('full_name');
      if (error) throw error;
      return data as unknown as ResidentProfile[];
    },
  });
}

export function useResident(id: string | undefined) {
  return useQuery({
    queryKey: ['resident', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, flat:flats(id, number, floor, tower_id)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as ResidentProfile;
    },
    enabled: !!id,
  });
}

export function useVerifyResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (residentId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', residentId)
        .select('society_id, full_name')
        .single();
      if (error) throw error;

      const { data: session } = await supabase.auth.getSession();
      if (session.session) {
        await logAuditEvent({
          societyId: data.society_id,
          actorId: session.session.user.id,
          action: `Verified ${data.full_name}`,
        });
      }
    },
    onSuccess: (_data, residentId) => {
      queryClient.invalidateQueries({ queryKey: ['residents'] });
      queryClient.invalidateQueries({ queryKey: ['resident', residentId] });
      queryClient.invalidateQueries({ queryKey: ['audit-events'] });
    },
  });
}

type CreateResidentInput = {
  fullName: string;
  email: string;
  phone?: string;
  flatId: string;
  occupancyType: 'OWNER' | 'TENANT';
  isVerified: boolean;
};

export function useCreateResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateResidentInput) => {
      const { data, error } = await supabase.functions.invoke<{ userId: string; email: string; tempPassword: string }>(
        'create-user-with-temp-password',
        {
          body: {
            fullName: input.fullName,
            role: 'RESIDENT',
            email: input.email,
            phone: input.phone,
            flatId: input.flatId,
            occupancyType: input.occupancyType,
          },
        },
      );
      if (error) throw error;
      if (!data) throw new Error('No response from server');

      if (input.isVerified) {
        await supabase.from('profiles').update({ is_verified: true }).eq('id', data.userId);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['residents'] });
      queryClient.invalidateQueries({ queryKey: ['flats'] });
      queryClient.invalidateQueries({ queryKey: ['audit-events'] });
    },
  });
}

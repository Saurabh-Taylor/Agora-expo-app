import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type UserRole = 'RESIDENT' | 'GUARD' | 'ADMIN';

export type Profile = {
  id: string;
  society_id: string;
  role: UserRole;
  flat_id: string | null;
  occupancy_type: 'OWNER' | 'TENANT' | null;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  society: { name: string } | null;
};

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, society:societies(name)')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data as unknown as Profile;
    },
    enabled: !!userId,
  });
}

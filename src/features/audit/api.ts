import { useQuery } from '@tanstack/react-query';

import { getQueryKey } from '@/commonFunctions';
import { QueryKeyRoots } from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';

export type AuditEvent = {
  id: string;
  society_id: string;
  actor_id: string | null;
  action: string;
  detail: string | null;
  created_at: string;
};

export function useRecentAuditEvents(societyId: string | null | undefined, limit: number) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.auditEvents, societyId, limit),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .eq('society_id', societyId as string)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as AuditEvent[];
    },
    enabled: !!societyId,
  });
}

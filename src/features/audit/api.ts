import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export type AuditEvent = {
  id: string;
  society_id: string;
  actor_id: string | null;
  action: string;
  detail: string | null;
  created_at: string;
};

// Called from other feature mutations (towers, residents, ...) right after a
// write succeeds, so the admin Home feed reflects real actions immediately.
export async function logAuditEvent(params: { societyId: string; actorId: string; action: string; detail?: string }) {
  await supabase.from('audit_events').insert({
    society_id: params.societyId,
    actor_id: params.actorId,
    action: params.action,
    detail: params.detail,
  });
}

export function useRecentAuditEvents(limit: number) {
  return useQuery({
    queryKey: ['audit-events', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as AuditEvent[];
    },
  });
}

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export function useOpenComplaintsCount() {
  return useQuery({
    queryKey: ['open-complaints-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'RESOLVED');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export type NoticeCategory = 'GENERAL' | 'WATER' | 'EVENT' | 'BILLING' | 'SECURITY';

export type Notice = {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  state: 'SCHEDULED' | 'PUBLISHED';
  published_at: string | null;
  created_at: string;
};

const NOTICE_SELECT = 'id, title, body, category, state, published_at, created_at';

// RLS already scopes this per role: residents only ever see PUBLISHED rows,
// admin sees everything in their society — one hook serves both.
export function useNotices() {
  return useQuery({
    queryKey: ['notices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notices')
        .select(NOTICE_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Notice[];
    },
  });
}

export function useNoticeDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['notices', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('notices').select(NOTICE_SELECT).eq('id', id as string).single();
      if (error) throw error;
      return data as Notice;
    },
    enabled: !!id,
  });
}

type CreateNoticeInput = {
  societyId: string;
  title: string;
  body: string;
  category: NoticeCategory;
};

// Send-now only — the schema keeps a SCHEDULED state for a future cron-driven
// publish, but nothing flips it to PUBLISHED yet, so scheduling isn't offered
// here; every notice created in-app publishes immediately.
export function useCreateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNoticeInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('notices')
        .insert({
          society_id: input.societyId,
          title: input.title,
          body: input.body,
          category: input.category,
          state: 'PUBLISHED',
          published_at: now,
          created_by: user?.id,
        })
        .select(NOTICE_SELECT)
        .single();
      if (error) throw error;
      return data as Notice;
    },
    onSuccess: (notice) => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      sendPushNotification({
        notifyAllResidents: true,
        title: 'New notice published',
        body: notice.title,
        data: { type: 'NOTICE', noticeId: notice.id },
      });
    },
  });
}

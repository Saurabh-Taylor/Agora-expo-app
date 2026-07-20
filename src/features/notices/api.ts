import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export type NoticeCategory = 'GENERAL' | 'WATER' | 'EVENT' | 'BILLING' | 'SECURITY';
export type NoticeState = 'SCHEDULED' | 'PUBLISHED';

export type Notice = {
  id: string;
  society_id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  state: NoticeState;
  scheduled_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
};

const NOTICE_SELECT =
  'id, society_id, title, body, category, state, scheduled_at, published_at, archived_at, created_by, created_at';

export function useNotices(societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['notices', societyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notices')
        .select(NOTICE_SELECT)
        .eq('society_id', societyId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Notice[];
    },
    enabled: !!societyId,
  });
}

export function useNoticeDetail(id: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: ['notices', 'detail', societyId, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notices')
        .select(NOTICE_SELECT)
        .eq('id', id as string)
        .eq('society_id', societyId as string)
        .single();
      if (error) throw error;
      return data as Notice;
    },
    enabled: !!id && !!societyId,
  });
}

type CreateNoticeInput = {
  societyId: string;
  title: string;
  body: string;
  category: NoticeCategory;
};

export function useCreateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNoticeInput) => {
      const { data, error } = await supabase.rpc('create_admin_notice', {
        requested_title: input.title.trim(),
        requested_body: input.body.trim(),
        requested_category: input.category,
        publish_now: false,
      });
      if (error) throw error;
      const notice = data as Notice;
      if (!notice || notice.society_id !== input.societyId) throw new Error('The notice could not be created');
      return notice;
    },
    onSuccess: (notice) => {
      queryClient.invalidateQueries({ queryKey: ['notices', notice.society_id] });
      queryClient.invalidateQueries({ queryKey: ['audit-events', notice.society_id] });
    },
  });
}

type UpdateNoticeInput = {
  id: string;
  societyId: string;
  title: string;
  body: string;
  category: NoticeCategory;
};

export function useUpdateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateNoticeInput) => {
      const { data, error } = await supabase.rpc('update_admin_notice', {
        target_notice_id: input.id,
        requested_title: input.title.trim(),
        requested_body: input.body.trim(),
        requested_category: input.category,
      });
      if (error) throw error;
      const notice = data as Notice;
      if (!notice || notice.society_id !== input.societyId) throw new Error('The notice could not be updated');
      return notice;
    },
    onSuccess: (notice) => {
      queryClient.invalidateQueries({ queryKey: ['notices', notice.society_id] });
      queryClient.invalidateQueries({ queryKey: ['notices', 'detail', notice.society_id, notice.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-events', notice.society_id] });
    },
  });
}

export function usePublishNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, societyId }: { id: string; societyId: string }) => {
      const { data, error } = await supabase.rpc('publish_admin_notice', { target_notice_id: id });
      if (error) throw error;
      const notice = data as Notice;
      if (!notice || notice.society_id !== societyId) throw new Error('The notice could not be published');
      return notice;
    },
    onSuccess: (notice) => {
      queryClient.invalidateQueries({ queryKey: ['notices', notice.society_id] });
      queryClient.invalidateQueries({ queryKey: ['notices', 'detail', notice.society_id, notice.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-events', notice.society_id] });
      void sendPushNotification({
        notifyAllResidents: true,
        title: 'New notice published',
        body: notice.title,
        data: { type: 'NOTICE', noticeId: notice.id },
      });
    },
  });
}

export function useArchiveNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, societyId }: { id: string; societyId: string }) => {
      const { data, error } = await supabase.rpc('archive_admin_notice', { target_notice_id: id });
      if (error) throw error;
      const notice = data as Notice;
      if (!notice || notice.society_id !== societyId) throw new Error('The notice could not be archived');
      return notice;
    },
    onSuccess: (notice) => {
      queryClient.invalidateQueries({ queryKey: ['notices', notice.society_id] });
      queryClient.invalidateQueries({ queryKey: ['notices', 'detail', notice.society_id, notice.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-events', notice.society_id] });
    },
  });
}

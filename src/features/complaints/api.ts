import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as Crypto from 'expo-crypto';
import { useEffect } from 'react';

import { assertFlatRecord, assertSocietyRecord, getQueryKey, invalidateSocietyComplaints, removeRealtimeSubscription, subscribeToRealtimeTables } from '@/commonFunctions';
import {
  COMPLAINT_ATTACHMENTS_BUCKET,
  COMPLAINT_ATTACHMENT_MAX_BYTES,
  COMPLAINT_ATTACHMENT_SIGNED_URL_SECONDS,
  QueryKeyRoots,
} from '@/constants/commonConstants';
import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export type Complaint = {
  id: string;
  society_id: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  flat_id: string;
  raised_by: string;
  attachment_path: string | null;
  flat: { number: string; tower: { code: string } | null } | null;
  raised_by_profile: { full_name: string } | null;
};

const COMPLAINT_SELECT =
  'id, society_id, title, description, category, priority, status, created_at, updated_at, resolved_at, flat_id, raised_by, attachment_path, flat:flats(number, tower:towers(code)), raised_by_profile:profiles!complaints_raised_by_same_society_fkey(full_name)';

export function useOpenComplaintsCount(societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.complaints, societyId, 'open-count'),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .eq('society_id', societyId as string)
        .neq('status', 'RESOLVED');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!societyId,
  });
}

export function useAdminComplaints(societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.complaints, societyId, 'admin'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('complaints')
        .select(COMPLAINT_SELECT)
        .eq('society_id', societyId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Complaint[];
    },
    enabled: !!societyId,
  });
}

export type ComplaintEvent = {
  id: string;
  status: ComplaintStatus;
  note: string | null;
  created_at: string;
  created_by_profile: { full_name: string } | null;
};

export function useComplaintDetail(id: string | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.complaints, societyId, 'detail', id),
    queryFn: async () => {
      const [complaintResult, eventsResult] = await Promise.all([
        supabase
          .from('complaints')
          .select(COMPLAINT_SELECT)
          .eq('id', id as string)
          .eq('society_id', societyId as string)
          .single(),
        supabase
          .from('complaint_events')
          .select('id, status, note, created_at, created_by_profile:profiles(full_name)')
          .eq('complaint_id', id as string)
          .eq('society_id', societyId as string)
          .order('created_at', { ascending: true }),
      ]);
      if (complaintResult.error) throw complaintResult.error;
      if (eventsResult.error) throw eventsResult.error;
      return {
        complaint: complaintResult.data as unknown as Complaint,
        events: (eventsResult.data ?? []) as unknown as ComplaintEvent[],
      };
    },
    enabled: !!id && !!societyId,
  });
}

type UpdateComplaintInput = {
  id: string;
  societyId: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  previousStatus: ComplaintStatus;
  note?: string;
};

export function useUpdateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateComplaintInput) => {
      const { data, error } = await supabase
        .rpc('update_admin_complaint', {
          target_complaint_id: input.id,
          requested_priority: input.priority,
          requested_status: input.status,
          requested_note: input.note?.trim() || null,
        })
        .single();
      if (error) throw error;
      return assertSocietyRecord(
        data as Complaint | null,
        input.societyId,
        'Updated complaint returned an invalid society scope',
      );
    },
    onSuccess: (complaint, input) => {
      invalidateSocietyComplaints(queryClient, input.societyId);
      if (complaint.status !== input.previousStatus) {
        void sendPushNotification({
          title: 'Complaint status updated',
          body: `Your complaint is now ${complaint.status.toLowerCase().replace('_', ' ')}.`,
          data: { type: 'COMPLAINT_STATUS', complaintId: complaint.id },
        });
      }
    },
  });
}

export function useFlatComplaints(flatId: string | null | undefined, societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.complaints, societyId, 'flat', flatId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('complaints')
        .select(COMPLAINT_SELECT)
        .eq('flat_id', flatId as string)
        .eq('society_id', societyId as string)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Complaint[];
    },
    enabled: !!flatId && !!societyId,
  });
}

export type ComplaintAttachmentInput = {
  uri: string;
  base64: string;
  fileSize: number | null;
};

type CreateComplaintInput = {
  societyId: string;
  flatId: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  attachment?: ComplaintAttachmentInput;
};

async function uploadComplaintAttachment(input: CreateComplaintInput) {
  if (!input.attachment) return null;
  if (input.attachment.fileSize && input.attachment.fileSize > COMPLAINT_ATTACHMENT_MAX_BYTES) {
    throw new Error('Attachment must be smaller than 5 MB');
  }

  const attachmentPath = input.societyId + '/' + input.userId + '/' + Crypto.randomUUID() + '.jpg';
  const fileBody = decode(input.attachment.base64);

  if (fileBody.byteLength > COMPLAINT_ATTACHMENT_MAX_BYTES) {
    throw new Error('Attachment must be smaller than 5 MB');
  }

  const { error } = await supabase.storage
    .from(COMPLAINT_ATTACHMENTS_BUCKET)
    .upload(attachmentPath, fileBody, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  if (error) throw error;
  return attachmentPath;
}

export function useComplaintAttachmentUrl(
  attachmentPath: string | null | undefined,
  societyId: string | null | undefined,
) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.complaintAttachment, societyId, attachmentPath),
    queryFn: async () => {
      if (!attachmentPath?.startsWith((societyId as string) + '/')) {
        throw new Error('Complaint attachment has an invalid society scope');
      }
      const { data, error } = await supabase.storage
        .from(COMPLAINT_ATTACHMENTS_BUCKET)
        .createSignedUrl(attachmentPath, COMPLAINT_ATTACHMENT_SIGNED_URL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!attachmentPath && !!societyId,
    staleTime: (COMPLAINT_ATTACHMENT_SIGNED_URL_SECONDS - 300) * 1000,
  });
}

export function useCreateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateComplaintInput) => {
      let attachmentPath: string | null = null;
      try {
        attachmentPath = await uploadComplaintAttachment(input);
        const { data, error } = await supabase
          .rpc('create_resident_complaint_with_attachment', {
            requested_title: input.title,
            requested_description: input.description,
            requested_category: input.category,
            requested_attachment_path: attachmentPath,
          })
          .single();
        if (error) throw error;
        return assertFlatRecord(
          data as Complaint | null,
          input.societyId,
          input.flatId,
          'Created complaint returned an invalid ownership scope',
        );
      } catch (error) {
        if (attachmentPath) {
          await supabase.storage.from(COMPLAINT_ATTACHMENTS_BUCKET).remove([attachmentPath]);
        }
        throw error;
      }
    },
    onSuccess: (_data, input) => invalidateSocietyComplaints(queryClient, input.societyId),
  });
}

export function useComplaintRealtimeSync(societyId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!societyId) return;
    const refreshComplaints = () => {
      invalidateSocietyComplaints(queryClient, societyId);
    };
    const channel = subscribeToRealtimeTables(
      'complaints:' + societyId,
      [
        { table: 'complaints', filter: 'society_id=eq.' + societyId },
        { table: 'complaint_events', filter: 'society_id=eq.' + societyId, event: 'INSERT' },
      ],
      refreshComplaints,
    );

    return () => {
      void removeRealtimeSubscription(channel);
    };
  }, [queryClient, societyId]);
}

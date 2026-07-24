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
import { sendPushNotification } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

export const OperationalTaskPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const OperationalTaskStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type OperationalTaskPriority = (typeof OperationalTaskPriorities)[number];
export type OperationalTaskStatus = (typeof OperationalTaskStatuses)[number];

export type OperationalTask = {
  id: string;
  society_id: string;
  title: string;
  description: string | null;
  priority: OperationalTaskPriority;
  status: OperationalTaskStatus;
  due_at: string;
  assigned_staff_id: string | null;
  assigned_guard_id: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  staff: { id: string; name: string; role: string } | null;
  guard: { id: string; full_name: string } | null;
};

export type OperationalTaskComment = {
  id: string;
  society_id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: { id: string; full_name: string; role: string } | null;
};

export function useOperationalTasks(societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.tasks, societyId, 'list'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operational_tasks')
        .select('*, staff:staff(id, name, role), guard:profiles!operational_tasks_guard_same_society_fkey(id, full_name)')
        .eq('society_id', societyId as string)
        .order('due_at');
      if (error) throw error;
      return assertSocietyRecords(
        (data ?? []) as unknown as OperationalTask[],
        societyId as string,
        'The server returned tasks outside this society',
      );
    },
    enabled: !!societyId,
  });
}

export function useOperationalTaskComments(
  taskId: string | null | undefined,
  societyId: string | null | undefined,
) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.tasks, societyId, taskId, 'comments'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operational_task_comments')
        .select('*, author:profiles(id, full_name, role)')
        .eq('society_id', societyId as string)
        .eq('task_id', taskId as string)
        .order('created_at');
      if (error) throw error;
      return assertSocietyRecords(
        (data ?? []) as unknown as OperationalTaskComment[],
        societyId as string,
        'The server returned task comments outside this society',
      );
    },
    enabled: !!taskId && !!societyId,
  });
}

export function useOperationalTaskRealtime(societyId: string | null | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!societyId) return;
    const channel = subscribeToRealtimeTables(
      `tasks:${societyId}`,
      [
        { table: 'operational_tasks', filter: `society_id=eq.${societyId}` },
        { table: 'operational_task_comments', filter: `society_id=eq.${societyId}` },
      ],
      () => queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.tasks, societyId) }),
    );
    return () => { void removeRealtimeSubscription(channel); };
  }, [queryClient, societyId]);
}

type TaskWriteInput = {
  societyId: string;
  title: string;
  description: string;
  priority: OperationalTaskPriority;
  dueAt: string;
  staffId: string | null;
  guardId: string | null;
};

export function useCreateOperationalTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskWriteInput) => {
      const { data, error } = await supabase.rpc('create_admin_operational_task', {
        requested_title: input.title.trim(),
        requested_description: input.description.trim() || null,
        requested_priority: input.priority,
        requested_due_at: input.dueAt,
        requested_staff_id: input.staffId,
        requested_guard_id: input.guardId,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as OperationalTask | null,
        input.societyId,
        'The task could not be created in this society',
      );
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.tasks, task.society_id) });
      invalidateAuditEvents(queryClient, task.society_id);
      if (task.assigned_guard_id) {
        void sendPushNotification({
          title: 'Society task assigned',
          body: task.title,
          data: { type: 'TASK_ASSIGNMENT', taskId: task.id },
        });
      }
    },
  });
}

export function useUpdateOperationalTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskWriteInput & { taskId: string }) => {
      const { data, error } = await supabase.rpc('update_admin_operational_task', {
        target_task_id: input.taskId,
        requested_title: input.title.trim(),
        requested_description: input.description.trim() || null,
        requested_priority: input.priority,
        requested_due_at: input.dueAt,
        requested_staff_id: input.staffId,
        requested_guard_id: input.guardId,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as OperationalTask | null,
        input.societyId,
        'The task could not be updated in this society',
      );
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.tasks, task.society_id) });
    },
  });
}

export function useSetOperationalTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { societyId: string; taskId: string; status: OperationalTaskStatus; note?: string }) => {
      const { data, error } = await supabase.rpc('set_operational_task_status', {
        target_task_id: input.taskId,
        requested_status: input.status,
        requested_note: input.note?.trim() || null,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as OperationalTask | null,
        input.societyId,
        'The task status could not be updated in this society',
      );
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.tasks, task.society_id) });
    },
  });
}

export function useAddOperationalTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { societyId: string; taskId: string; body: string }) => {
      const { data, error } = await supabase.rpc('add_operational_task_comment', {
        target_task_id: input.taskId,
        requested_body: input.body.trim(),
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as OperationalTaskComment | null,
        input.societyId,
        'The task comment could not be added in this society',
      );
    },
    onSuccess: (comment) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.tasks, comment.society_id) });
    },
  });
}

export function useSendOperationalTaskReminder() {
  return useMutation({
    mutationFn: async (taskId: string) => {
      const sent = await sendPushNotification({
        title: 'Society task reminder',
        body: 'Open Agora to review your assigned task.',
        data: { type: 'TASK_ASSIGNMENT', taskId },
      });
      if (sent === null) throw new Error('Could not request the task reminder');
      return sent;
    },
  });
}

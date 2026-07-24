import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDateTime, getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import {
  type OperationalTask,
  type OperationalTaskStatus,
  useAddOperationalTaskComment,
  useOperationalTaskComments,
  useOperationalTaskRealtime,
  useOperationalTasks,
  useSendOperationalTaskReminder,
  useSetOperationalTaskStatus,
} from '@/features/tasks/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type OperationalTaskDetailScreenProps = { role: 'ADMIN' | 'GUARD' };

type TaskActionPanelProps = {
  role: 'ADMIN' | 'GUARD';
  task: OperationalTask;
  pending: boolean;
  reminderPending: boolean;
  onStatusChange: (status: OperationalTaskStatus) => void;
  onReminder: () => void;
};

function TaskActionPanel({
  role,
  task,
  pending,
  reminderPending,
  onStatusChange,
  onReminder,
}: TaskActionPanelProps) {
  const active = !['COMPLETED', 'CANCELLED'].includes(task.status);

  return (
    <View style={styles.actions}>
      {role === 'GUARD' && task.status === 'PENDING' && (
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={() => onStatusChange('IN_PROGRESS')}
          style={styles.primaryButton}>
          <Text style={styles.primaryLabel}>Start task</Text>
        </Pressable>
      )}
      {role === 'GUARD' && task.status === 'IN_PROGRESS' && (
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={() => onStatusChange('COMPLETED')}
          style={styles.primaryButton}>
          <Text style={styles.primaryLabel}>Mark completed</Text>
        </Pressable>
      )}
      {role === 'ADMIN' && active && (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={() => router.push(`/(admin)/edit-task/${task.id}` as Href)}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Edit / reassign</Text>
          </Pressable>
          {task.status !== 'IN_PROGRESS' && (
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={() => onStatusChange('IN_PROGRESS')}
              style={styles.primaryButton}>
              <Text style={styles.primaryLabel}>Start</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={() => onStatusChange('COMPLETED')}
            style={styles.primaryButton}>
            <Text style={styles.primaryLabel}>Complete</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={pending}
            onPress={() => onStatusChange('CANCELLED')}
            style={styles.cancelButton}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </>
      )}
      {role === 'ADMIN' && task.assigned_guard_id && active && (
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={onReminder}
          style={styles.reminderButton}>
          {reminderPending && <ActivityIndicator size="small" color={Colors.success700} />}
          <Text style={styles.reminderLabel}>Send reminder</Text>
        </Pressable>
      )}
    </View>
  );
}

export function OperationalTaskDetailScreen({ role }: OperationalTaskDetailScreenProps) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const tasksQuery = useOperationalTasks(societyId);
  const commentsQuery = useOperationalTaskComments(id, societyId);
  const updateStatus = useSetOperationalTaskStatus();
  const addComment = useAddOperationalTaskComment();
  const sendReminder = useSendOperationalTaskReminder();
  const [comment, setComment] = useState('');
  useOperationalTaskRealtime(societyId);

  const task = (tasksQuery.data ?? []).find((item) => item.id === id);
  const pending = updateStatus.isPending || addComment.isPending || sendReminder.isPending;
  const assignee = task?.staff
    ? `${task.staff.name} · ${task.staff.role}`
    : task?.guard?.full_name ?? 'Assigned guard';

  async function setStatus(status: OperationalTaskStatus) {
    if (!societyId || !task) return;
    try {
      await updateStatus.mutateAsync({ societyId, taskId: task.id, status });
      showToast(`Task marked ${status.toLowerCase().replace('_', ' ')}`);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update task status'));
    }
  }

  async function submitComment() {
    if (!societyId || !task || !comment.trim()) return;
    try {
      await addComment.mutateAsync({ societyId, taskId: task.id, body: comment });
      setComment('');
      showToast('Comment added');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not add task comment'));
    }
  }

  async function remind() {
    if (!task?.assigned_guard_id) return;
    try {
      const sent = await sendReminder.mutateAsync(task.id);
      showToast(sent > 0 ? 'Guard reminder sent' : 'Guard has no enabled notification device');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not send task reminder'));
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text accessibilityRole="header" style={styles.headerTitle}>Task details</Text>
      </View>
      <AsyncState
        isLoading={profileQuery.isLoading || tasksQuery.isLoading || commentsQuery.isLoading}
        isError={
          profileQuery.isError ||
          tasksQuery.isError ||
          commentsQuery.isError ||
          (!tasksQuery.isLoading && !task)
        }
        errorTitle="Task unavailable"
        errorMessage="This task is missing, no longer assigned to you, or outside your society."
        onRetry={() => {
          profileQuery.refetch();
          tasksQuery.refetch();
          commentsQuery.refetch();
        }}
      />

      {task && (
        <>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.flex}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.assignee}>{assignee}</Text>
              </View>
              <View style={styles.priority}>
                <Text style={styles.priorityLabel}>{task.priority}</Text>
              </View>
            </View>
            <Text style={styles.status}>{task.status.replace('_', ' ')}</Text>
            <Text style={styles.due}>Due {formatDateTime(task.due_at)}</Text>
            {task.description && <Text style={styles.description}>{task.description}</Text>}
          </View>

          <TaskActionPanel
            role={role}
            task={task}
            pending={pending}
            reminderPending={sendReminder.isPending}
            onStatusChange={(status) => void setStatus(status)}
            onReminder={() => void remind()}
          />

          <Text style={styles.sectionTitle}>Comments & updates</Text>
          <View style={styles.comments}>
            {(commentsQuery.data ?? []).map((item) => (
              <View key={item.id} style={styles.commentCard}>
                <Text style={styles.commentAuthor}>
                  {item.author?.full_name ??
                    (item.author_id === session?.user.id ? 'You' : 'Society admin')}
                </Text>
                <Text style={styles.commentBody}>{item.body}</Text>
                <Text style={styles.commentTime}>{formatDateTime(item.created_at)}</Text>
              </View>
            ))}
          </View>
          {!commentsQuery.isLoading && (commentsQuery.data ?? []).length === 0 && (
            <Text style={styles.noComments}>No comments yet.</Text>
          )}

          <View style={styles.commentForm}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Add an operational update"
              placeholderTextColor={Colors.textFaint}
              multiline
              style={styles.commentInput}
              textAlignVertical="top"
            />
            <Pressable
              accessibilityRole="button"
              disabled={pending || !comment.trim()}
              onPress={() => void submitComment()}
              style={[styles.commentButton, (pending || !comment.trim()) && styles.disabled]}>
              {addComment.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
              <Text style={styles.commentButtonLabel}>Add comment</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  hero: { marginTop: 18, padding: 18, borderRadius: Radius.cardLarge, backgroundColor: Colors.green500 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  taskTitle: { fontFamily: FontFamily.headingBold, fontSize: 21, color: Colors.textOnDark },
  assignee: { marginTop: 4, fontSize: 12, color: '#C6D5CB' },
  priority: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.gold },
  priorityLabel: { fontSize: 10, fontWeight: '800', color: Colors.green900 },
  status: { marginTop: 16, fontSize: 11, letterSpacing: 1.2, fontWeight: '800', color: Colors.gold },
  due: { marginTop: 5, fontSize: 13, fontWeight: '600', color: Colors.textOnDark },
  description: { marginTop: 12, fontSize: 13, lineHeight: 20, color: '#D8E3DB' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  primaryButton: { minHeight: 46, paddingHorizontal: 15, borderRadius: 13, backgroundColor: Colors.green500, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textOnDark },
  secondaryButton: { minHeight: 46, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
  cancelButton: { minHeight: 46, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#FCEBE8', alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.danger700 },
  reminderButton: { minHeight: 46, paddingHorizontal: 14, borderRadius: 13, backgroundColor: Colors.categorySecurity.bg, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  reminderLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.success700 },
  sectionTitle: { marginTop: 26, fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textPrimary },
  comments: { gap: 8, marginTop: 10 },
  commentCard: { padding: 13, borderRadius: Radius.input, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  commentAuthor: { fontSize: 12, fontWeight: '800', color: Colors.textPrimary },
  commentBody: { marginTop: 5, fontSize: 13, lineHeight: 18, color: Colors.textPrimary },
  commentTime: { marginTop: 6, fontSize: 10.5, color: Colors.textMuted },
  noComments: { marginTop: 9, fontSize: 12.5, color: Colors.textMuted },
  commentForm: { marginTop: 12 },
  commentInput: { minHeight: 82, padding: 13, borderRadius: Radius.input, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, color: Colors.textPrimary },
  commentButton: { minHeight: 48, marginTop: 8, borderRadius: 13, backgroundColor: Colors.green500, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  commentButtonLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.textOnDark },
  disabled: { opacity: 0.45 },
});

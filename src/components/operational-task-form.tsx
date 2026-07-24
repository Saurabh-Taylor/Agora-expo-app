import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useGuards } from '@/features/guards/api';
import { useProfile } from '@/features/profile/api';
import { useStaff } from '@/features/staff/api';
import {
  OperationalTaskPriorities,
  type OperationalTask,
  type OperationalTaskPriority,
  useCreateOperationalTask,
  useUpdateOperationalTask,
} from '@/features/tasks/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type OperationalTaskFormProps = { task?: OperationalTask };

function getInitialDueInput(task?: OperationalTask) {
  const date = task ? new Date(task.due_at) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function OperationalTaskForm({ task }: OperationalTaskFormProps) {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const staffQuery = useStaff(societyId);
  const guardsQuery = useGuards(societyId);
  const createTask = useCreateOperationalTask();
  const updateTask = useUpdateOperationalTask();
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<OperationalTaskPriority>(task?.priority ?? 'MEDIUM');
  const [dueInput, setDueInput] = useState(getInitialDueInput(task));
  const [assignee, setAssignee] = useState(task?.assigned_staff_id ? `STAFF:${task.assigned_staff_id}` : task?.assigned_guard_id ? `GUARD:${task.assigned_guard_id}` : '');
  const activeStaff = (staffQuery.data ?? []).filter((member) => member.status === 'ON_DUTY');
  const activeGuards = (guardsQuery.data ?? []).filter((guard) => guard.is_active);
  const parsedDue = new Date(dueInput.replace(' ', 'T'));
  const validDue = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dueInput) && !Number.isNaN(parsedDue.getTime());
  const pending = createTask.isPending || updateTask.isPending;
  const canSave = !!societyId && title.trim().length >= 2 && !!assignee && validDue && !pending;

  async function save() {
    if (!canSave || !societyId) return;
    const staffId = assignee.startsWith('STAFF:') ? assignee.slice(6) : null;
    const guardId = assignee.startsWith('GUARD:') ? assignee.slice(6) : null;
    const input = { societyId, title, description, priority, dueAt: parsedDue.toISOString(), staffId, guardId };
    try {
      if (task) await updateTask.mutateAsync({ ...input, taskId: task.id });
      else await createTask.mutateAsync(input);
      showToast(task ? 'Task updated' : 'Task created and assigned');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, task ? 'Could not update task' : 'Could not create task'));
    }
  }

  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.headerRow}><BackArrowButton onPress={() => router.back()} /><Text accessibilityRole="header" style={styles.title}>{task ? 'Edit task' : 'Create daily task'}</Text></View><AsyncState isLoading={profileQuery.isLoading || staffQuery.isLoading || guardsQuery.isLoading} isError={profileQuery.isError || staffQuery.isError || guardsQuery.isError} onRetry={() => { profileQuery.refetch(); staffQuery.refetch(); guardsQuery.refetch(); }} /><Text style={styles.label}>TASK TITLE</Text><TextInput value={title} onChangeText={setTitle} placeholder="Inspect fire extinguishers" placeholderTextColor={Colors.textFaint} style={styles.input} /><Text style={styles.label}>DESCRIPTION</Text><TextInput value={description} onChangeText={setDescription} placeholder="Add instructions or completion criteria" placeholderTextColor={Colors.textFaint} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" /><Text style={styles.label}>PRIORITY</Text><View style={styles.choices}>{OperationalTaskPriorities.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: priority === item }} onPress={() => setPriority(item)} style={[styles.choice, priority === item && styles.choiceActive]}><Text style={[styles.choiceLabel, priority === item && styles.choiceLabelActive]}>{item}</Text></Pressable>)}</View><Text style={styles.label}>DUE DATE & TIME</Text><TextInput value={dueInput} onChangeText={setDueInput} placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={Colors.textFaint} autoCapitalize="none" keyboardType="numbers-and-punctuation" style={styles.input} accessibilityLabel="Due date and time in year month day hour minute format" />{dueInput && !validDue && <Text style={styles.error}>Use YYYY-MM-DD HH:mm, for example 2026-07-25 09:30.</Text>}<Text style={styles.label}>ASSIGN TO ACTIVE STAFF / COMMITTEE</Text><View style={styles.assignees}>{activeStaff.map((member) => { const value = `STAFF:${member.id}`; return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: assignee === value }} onPress={() => setAssignee(value)} style={[styles.assignee, assignee === value && styles.assigneeActive]}><Text style={[styles.assigneeName, assignee === value && styles.assigneeNameActive]}>{member.name}</Text><Text style={[styles.assigneeRole, assignee === value && styles.assigneeRoleActive]}>{member.role}</Text></Pressable>; })}</View><Text style={styles.label}>OR ASSIGN TO GUARD ACCOUNT</Text><View style={styles.assignees}>{activeGuards.map((guard) => { const value = `GUARD:${guard.id}`; return <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: assignee === value }} onPress={() => setAssignee(value)} style={[styles.assignee, assignee === value && styles.assigneeActive]}><Text style={[styles.assigneeName, assignee === value && styles.assigneeNameActive]}>{guard.full_name}</Text><Text style={[styles.assigneeRole, assignee === value && styles.assigneeRoleActive]}>Security guard · receives app task</Text></Pressable>; })}</View>{activeStaff.length === 0 && activeGuards.length === 0 && <View style={styles.emptyAssignee}><Text style={styles.error}>Add active staff or guard accounts before creating tasks.</Text></View>}<Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSave, busy: pending }} disabled={!canSave} onPress={save} style={[styles.saveButton, !canSave && styles.disabled]}>{pending && <ActivityIndicator size="small" color={Colors.textOnDark} />}<Text style={styles.saveLabel}>{pending ? 'Saving...' : task ? 'Save task' : 'Create & assign'}</Text></Pressable></ScrollView>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.adminCanvas }, content: { paddingHorizontal: 18, paddingBottom: 48 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary }, label: { marginTop: 18, fontSize: 10.5, letterSpacing: 1.35, fontWeight: '700', color: Colors.textMutedAlt }, input: { minHeight: 50, marginTop: 7, borderRadius: Radius.input, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14.5, color: Colors.textPrimary }, multiline: { minHeight: 94 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }, choice: { minHeight: 44, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center' }, choiceActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 }, choiceLabel: { fontSize: 11.5, fontWeight: '700', color: Colors.textPrimary }, choiceLabelActive: { color: Colors.textOnDark }, error: { marginTop: 6, fontSize: 11.5, lineHeight: 16, color: Colors.danger700 }, assignees: { gap: 8, marginTop: 8 }, assignee: { minHeight: 62, padding: 12, borderRadius: Radius.input, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.borderAlt, justifyContent: 'center' }, assigneeActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 }, assigneeName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary }, assigneeNameActive: { color: Colors.textOnDark }, assigneeRole: { marginTop: 2, fontSize: 11.5, color: Colors.textMuted }, assigneeRoleActive: { color: '#D8E9DE' }, emptyAssignee: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#FCEBE8' }, saveButton: { minHeight: 54, marginTop: 28, borderRadius: Radius.button, backgroundColor: Colors.green500, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, saveLabel: { fontSize: 15, fontWeight: '700', color: Colors.textOnDark }, disabled: { opacity: 0.45 } });

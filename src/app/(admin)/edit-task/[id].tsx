import { useLocalSearchParams } from 'expo-router';
import { AsyncState } from '@/components/async-state';
import { OperationalTaskForm } from '@/components/operational-task-form';
import { useProfile } from '@/features/profile/api';
import { useOperationalTasks } from '@/features/tasks/api';
import { useAuthStore } from '@/stores/auth-store';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const tasksQuery = useOperationalTasks(profileQuery.data?.society_id);
  const task = (tasksQuery.data ?? []).find((item) => item.id === id);
  if (!task) return <AsyncState isLoading={profileQuery.isLoading || tasksQuery.isLoading} isError={profileQuery.isError || tasksQuery.isError || !tasksQuery.isLoading} errorTitle="Task unavailable" errorMessage="This task is complete, cancelled, missing, or outside your society." onRetry={() => { profileQuery.refetch(); tasksQuery.refetch(); }} />;
  return <OperationalTaskForm key={`${task.id}:${task.updated_at}`} task={task} />;
}

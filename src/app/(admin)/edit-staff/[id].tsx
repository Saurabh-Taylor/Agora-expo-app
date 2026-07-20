import { useLocalSearchParams } from 'expo-router';

import { DirectoryEntryFormScreen } from '@/components/directory-entry-form';

export default function EditStaffScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DirectoryEntryFormScreen kind="staff" id={id} />;
}

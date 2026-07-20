import { useLocalSearchParams } from 'expo-router';

import { DirectoryEntryFormScreen } from '@/components/directory-entry-form';

export default function EditServiceProviderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DirectoryEntryFormScreen kind="provider" id={id} />;
}

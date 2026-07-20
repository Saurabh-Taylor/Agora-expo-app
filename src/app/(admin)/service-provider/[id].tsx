import { useLocalSearchParams } from 'expo-router';

import { DirectoryEntryDetail } from '@/components/directory-entry-detail';

export default function ServiceProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DirectoryEntryDetail kind="provider" id={id} />;
}

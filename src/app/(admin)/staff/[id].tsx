import { useLocalSearchParams } from 'expo-router';

import { DirectoryEntryDetail } from '@/components/directory-entry-detail';

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DirectoryEntryDetail kind="staff" id={id} />;
}

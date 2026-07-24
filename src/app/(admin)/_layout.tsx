import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/commonConstants';

const ADMIN_STACK_CONTENT_TOP_GAP = 18;

export default function AdminLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        animation: 'ios_from_right',
        animationTypeForReplace: 'push',
        headerShown: false,
        contentStyle: {
          backgroundColor: Colors.adminCanvas,
          paddingTop: insets.top + ADMIN_STACK_CONTENT_TOP_GAP,
        },
      }}>
      <Stack.Screen
        name="(tabs)"
        options={{
          contentStyle: { backgroundColor: Colors.adminCanvas, paddingTop: 0 },
        }}
      />
      <Stack.Screen name="tower/[id]" />
      <Stack.Screen name="resident/[id]" />
      <Stack.Screen name="add-tower" />
      <Stack.Screen name="add-resident" />
      <Stack.Screen name="guard-accounts" />
      <Stack.Screen name="add-guard" />
      <Stack.Screen name="maintenance" />
      <Stack.Screen name="add-maintenance" />
      <Stack.Screen name="parking" />
      <Stack.Screen name="add-parking-slot" />
      <Stack.Screen name="assign-parking" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="upload-document" />
      <Stack.Screen name="document/[id]" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="create-task" />
      <Stack.Screen name="edit-task/[id]" />
      <Stack.Screen name="task/[id]" />
      <Stack.Screen name="audit" />
      <Stack.Screen name="visitor-history" />
      <Stack.Screen name="compose-notice" />
      <Stack.Screen name="polls" />
      <Stack.Screen name="create-poll" />
      <Stack.Screen name="poll/[id]" />
      <Stack.Screen name="complaint/[id]" />
      <Stack.Screen name="amenities" />
      <Stack.Screen name="add-amenity" />
      <Stack.Screen name="edit-amenity/[id]" />
      <Stack.Screen name="amenity/[id]" />
      <Stack.Screen name="staff-services" />
      <Stack.Screen name="add-staff" />
      <Stack.Screen name="staff/[id]" />
      <Stack.Screen name="edit-staff/[id]" />
      <Stack.Screen name="add-service-provider" />
      <Stack.Screen name="service-provider/[id]" />
      <Stack.Screen name="edit-service-provider/[id]" />
    </Stack>
  );
}

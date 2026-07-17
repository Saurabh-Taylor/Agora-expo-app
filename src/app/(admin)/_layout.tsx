import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tower/[id]" />
      <Stack.Screen name="resident/[id]" />
      <Stack.Screen name="add-tower" />
      <Stack.Screen name="add-resident" />
      <Stack.Screen name="audit" />
      <Stack.Screen name="compose-notice" />
      <Stack.Screen name="polls" />
      <Stack.Screen name="create-poll" />
      <Stack.Screen name="poll/[id]" />
      <Stack.Screen name="complaint/[id]" />
      <Stack.Screen name="amenities" />
      <Stack.Screen name="add-amenity" />
      <Stack.Screen name="amenity/[id]" />
      <Stack.Screen name="staff-services" />
      <Stack.Screen name="add-staff" />
      <Stack.Screen name="staff/[id]" />
      <Stack.Screen name="add-service-provider" />
      <Stack.Screen name="service-provider/[id]" />
    </Stack>
  );
}

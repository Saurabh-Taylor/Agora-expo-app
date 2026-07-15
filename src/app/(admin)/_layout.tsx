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
    </Stack>
  );
}

import { Tabs } from 'expo-router';

import { AdminTabBar, type AdminTabBarProps } from '@/components/admin-tab-bar';

export default function AdminTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AdminTabBar {...(props as unknown as AdminTabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="complaints" />
      <Tabs.Screen name="notices" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}

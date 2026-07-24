import { Tabs } from 'expo-router';

import { AdminTabBar, type RoleTabBarProps } from '@/components/role-tab-bar';

export default function AdminTabsLayout() {
  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AdminTabBar {...(props as unknown as RoleTabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="complaints" />
      <Tabs.Screen name="notices" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}

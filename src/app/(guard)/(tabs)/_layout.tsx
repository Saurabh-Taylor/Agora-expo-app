import { Tabs } from 'expo-router';

import { GuardTabBar, type RoleTabBarProps } from '@/components/role-tab-bar';

export default function GuardTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GuardTabBar {...(props as unknown as RoleTabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="movement-log" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}

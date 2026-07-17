import { Tabs } from 'expo-router';

import { GuardTabBar, type GuardTabBarProps } from '@/components/guard-tab-bar';

export default function GuardTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GuardTabBar {...(props as unknown as GuardTabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="movement-log" />
    </Tabs>
  );
}

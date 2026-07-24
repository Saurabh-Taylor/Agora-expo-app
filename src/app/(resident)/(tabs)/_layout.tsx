import { Tabs } from 'expo-router';

import { ResidentTabBar, type RoleTabBarProps } from '@/components/role-tab-bar';

export default function ResidentTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <ResidentTabBar {...(props as unknown as RoleTabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="gate" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}

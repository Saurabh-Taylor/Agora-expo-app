import { Tabs } from 'expo-router';

import { ResidentTabBar, type ResidentTabBarProps } from '@/components/resident-tab-bar';

export default function ResidentTabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <ResidentTabBar {...(props as unknown as ResidentTabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="gate" />
      <Tabs.Screen name="community" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommunicationTabIcon, HomeTabIcon, MoreTabIcon } from '@/components/icons/admin-tab-icons';
import { GateTabIcon } from '@/components/icons/resident-tab-icons';
import { Colors, FontFamily } from '@/constants/commonConstants';

// Same minimal local shape as AdminTabBarProps — see admin-tab-bar.tsx for why
// this doesn't import @react-navigation/bottom-tabs directly.
type TabBarRoute = { key: string; name: string };
type ResidentTabBarNavigation = {
  navigate: (name: string) => void;
  emit: (event: { type: string; target: string; canPreventDefault: true }) => { defaultPrevented?: boolean };
};
export type ResidentTabBarProps = {
  state: { index: number; routes: TabBarRoute[] };
  navigation: ResidentTabBarNavigation;
};

const TAB_ORDER = ['index', 'gate', 'community', 'more'] as const;

const TAB_META: Record<(typeof TAB_ORDER)[number], { label: string; Icon: typeof HomeTabIcon }> = {
  index: { label: 'Home', Icon: HomeTabIcon },
  gate: { label: 'Gate', Icon: GateTabIcon },
  community: { label: 'Community', Icon: CommunicationTabIcon },
  more: { label: 'More', Icon: MoreTabIcon },
};

export function ResidentTabBar({ state, navigation }: ResidentTabBarProps) {
  const insets = useSafeAreaInsets();

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((route) => route.name === name)).filter(
    (route): route is (typeof state.routes)[number] => !!route,
  );

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      {orderedRoutes.map((route) => {
        const routeIndex = state.routes.indexOf(route);
        const isFocused = state.index === routeIndex;
        const meta = TAB_META[route.name as (typeof TAB_ORDER)[number]];
        const color = isFocused ? '#123528' : '#9BA394';

        function handlePress() {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable key={route.key} style={styles.tab} onPress={handlePress}>
            <meta.Icon color={color} />
            <Text style={[styles.label, { color }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(237,231,218,0.96)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 9,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6, minHeight: 44 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: 10 },
});

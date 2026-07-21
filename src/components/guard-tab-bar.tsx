import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeTabIcon, MoreTabIcon } from '@/components/icons/admin-tab-icons';
import { MovementTabIcon } from '@/components/icons/guard-tab-icons';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useAwaitingEntryCount } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';

// Same minimal local shape as AdminTabBarProps — see admin-tab-bar.tsx for why
// this doesn't import @react-navigation/bottom-tabs directly.
type TabBarRoute = { key: string; name: string };
type GuardTabBarNavigation = {
  navigate: (name: string) => void;
  emit: (event: { type: string; target: string; canPreventDefault: true }) => { defaultPrevented?: boolean };
};
export type GuardTabBarProps = {
  state: { index: number; routes: TabBarRoute[] };
  navigation: GuardTabBarNavigation;
};

const TAB_ORDER = ['index', 'movement-log', 'more'] as const;

const TAB_META: Record<(typeof TAB_ORDER)[number], { label: string; Icon: typeof HomeTabIcon }> = {
  index: { label: 'Home', Icon: HomeTabIcon },
  'movement-log': { label: 'Movement', Icon: MovementTabIcon },
  more: { label: 'More', Icon: MoreTabIcon },
};

export function GuardTabBar({ state, navigation }: GuardTabBarProps) {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((store) => store.session);
  const profileQuery = useProfile(session?.user.id);
  const { data: awaitingEntryCount } = useAwaitingEntryCount(profileQuery.data?.society_id);
  const hasAwaitingEntry = (awaitingEntryCount ?? 0) > 0;

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
            {route.name === 'movement-log' && hasAwaitingEntry && <View style={styles.badge} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(244,239,227,0.96)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 9,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6, minHeight: 44 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: 10 },
  badge: {
    position: 'absolute',
    top: 4,
    right: '30%',
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.gold,
  },
});

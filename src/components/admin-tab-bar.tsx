import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CommunicationTabIcon,
  CommunityTabIcon,
  HomeTabIcon,
  MoreTabIcon,
  OperationsTabIcon,
} from '@/components/icons/admin-tab-icons';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { useOpenComplaintsCount } from '@/features/complaints/api';

// Minimal local shape instead of importing @react-navigation/bottom-tabs'
// BottomTabBarProps directly — that package isn't a direct dependency here
// (expo-router vendors it internally), so we only type what we actually use.
type TabBarRoute = { key: string; name: string };
type AdminTabBarNavigation = {
  navigate: (name: string) => void;
  // react-navigation's real `emit` is generic over known event names; typing it
  // precisely here would mean importing the library we're deliberately not
  // depending on directly, so this stays loose at the boundary.
  emit: (event: { type: string; target: string; canPreventDefault: true }) => { defaultPrevented?: boolean };
};
export type AdminTabBarProps = {
  state: { index: number; routes: TabBarRoute[] };
  navigation: AdminTabBarNavigation;
};

const TAB_ORDER = ['index', 'community', 'complaints', 'notices', 'more'] as const;

const TAB_META: Record<(typeof TAB_ORDER)[number], { label: string; Icon: typeof HomeTabIcon }> = {
  index: { label: 'Home', Icon: HomeTabIcon },
  community: { label: 'Community', Icon: CommunityTabIcon },
  complaints: { label: 'Operations', Icon: OperationsTabIcon },
  notices: { label: 'Communication', Icon: CommunicationTabIcon },
  more: { label: 'More', Icon: MoreTabIcon },
};

export function AdminTabBar({ state, navigation }: AdminTabBarProps) {
  const insets = useSafeAreaInsets();
  const { data: openComplaintsCount } = useOpenComplaintsCount();
  const hasOpenComplaints = (openComplaintsCount ?? 0) > 0;

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
            {route.name === 'complaints' && hasOpenComplaints && <View style={styles.badge} />}
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
    right: '22%',
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.danger700,
  },
});

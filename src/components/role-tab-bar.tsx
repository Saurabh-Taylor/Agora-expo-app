import type { ComponentType } from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CommunicationTabIcon,
  CommunityTabIcon,
  HomeTabIcon,
  MoreTabIcon,
  OperationsTabIcon,
} from '@/components/icons/admin-tab-icons';
import { MovementTabIcon } from '@/components/icons/guard-tab-icons';
import { GateTabIcon } from '@/components/icons/resident-tab-icons';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { useOpenComplaintsCount } from '@/features/complaints/api';
import { useProfile } from '@/features/profile/api';
import { useAwaitingEntryCount } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';

type TabBarRoute = { key: string; name: string };
type TabBarNavigation = {
  navigate: (name: string) => void;
  emit: (event: {
    type: string;
    target: string;
    canPreventDefault?: boolean;
  }) => { defaultPrevented?: boolean };
};

export type RoleTabBarProps = {
  state: { index: number; routes: TabBarRoute[] };
  navigation: TabBarNavigation;
};

type TabItem = {
  name: string;
  label: string;
  Icon: ComponentType<{ color: string }>;
};

type TabBadge = {
  accessibilityLabel: string;
  label?: string;
};

const TAB_TRANSITION_DURATION = 160;

const ADMIN_TABS = [
  { name: 'index', label: 'Home', Icon: HomeTabIcon },
  { name: 'community', label: 'Community', Icon: CommunityTabIcon },
  { name: 'complaints', label: 'Operations', Icon: OperationsTabIcon },
  { name: 'notices', label: 'Notices', Icon: CommunicationTabIcon },
  { name: 'more', label: 'More', Icon: MoreTabIcon },
] satisfies TabItem[];

const GUARD_TABS = [
  { name: 'index', label: 'Home', Icon: HomeTabIcon },
  { name: 'movement-log', label: 'Movement', Icon: MovementTabIcon },
  { name: 'more', label: 'More', Icon: MoreTabIcon },
] satisfies TabItem[];

const RESIDENT_TABS = [
  { name: 'index', label: 'Home', Icon: HomeTabIcon },
  { name: 'gate', label: 'Gate', Icon: GateTabIcon },
  { name: 'community', label: 'Community', Icon: CommunicationTabIcon },
  { name: 'more', label: 'More', Icon: MoreTabIcon },
] satisfies TabItem[];

function TabButton({
  item,
  route,
  isFocused,
  badge,
  navigation,
}: {
  item: TabItem;
  route: TabBarRoute;
  isFocused: boolean;
  badge?: TabBadge;
  navigation: TabBarNavigation;
}) {
  const reduceMotion = useReducedMotion();
  const focusProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    const nextValue = isFocused ? 1 : 0;
    focusProgress.value = reduceMotion
      ? nextValue
      : withTiming(nextValue, {
          duration: TAB_TRANSITION_DURATION,
          easing: Easing.out(Easing.cubic),
        });
  }, [focusProgress, isFocused, reduceMotion]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + focusProgress.value * 0.28,
    transform: [
      { translateY: -focusProgress.value },
      { scale: 1 + focusProgress.value * 0.04 },
    ],
  }));

  function handlePress() {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
  }

  function handleLongPress() {
    navigation.emit({ type: 'tabLongPress', target: route.key });
  }

  const color = isFocused ? Colors.green400 : Colors.textMuted;
  const accessibilityLabel = badge
    ? `${item.label} tab, ${badge.accessibilityLabel}`
    : `${item.label} tab`;

  return (
    <Pressable
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={accessibilityLabel}>
      <Animated.View
        style={[
          styles.iconContainer,
          isFocused && styles.iconContainerFocused,
          animatedIconStyle,
        ]}>
        <item.Icon color={color} />
        {badge && (
          <View style={badge.label ? styles.countBadge : styles.dotBadge}>
            {badge.label && <Text style={styles.badgeLabel}>{badge.label}</Text>}
          </View>
        )}
      </Animated.View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

function RoleTabBar({
  state,
  navigation,
  items,
  badges = {},
}: RoleTabBarProps & {
  items: TabItem[];
  badges?: Partial<Record<string, TabBadge>>;
}) {
  const insets = useSafeAreaInsets();
  const routesByName = new Map(state.routes.map((route) => [route.name, route]));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items.map((item) => {
        const route = routesByName.get(item.name);
        if (!route) return null;

        return (
          <TabButton
            key={route.key}
            item={item}
            route={route}
            isFocused={state.routes[state.index]?.key === route.key}
            badge={badges[item.name]}
            navigation={navigation}
          />
        );
      })}
    </View>
  );
}

export function AdminTabBar(props: RoleTabBarProps) {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const { data: openComplaintsCount = 0 } = useOpenComplaintsCount(
    profileQuery.data?.society_id,
  );
  const badges: Partial<Record<string, TabBadge>> =
    openComplaintsCount > 0
      ? {
          complaints: {
            accessibilityLabel: `${openComplaintsCount} open complaints`,
            label: openComplaintsCount > 99 ? '99+' : String(openComplaintsCount),
          },
        }
      : {};

  return <RoleTabBar {...props} items={ADMIN_TABS} badges={badges} />;
}

export function GuardTabBar(props: RoleTabBarProps) {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const { data: awaitingEntryCount = 0 } = useAwaitingEntryCount(
    profileQuery.data?.society_id,
  );
  const badges: Partial<Record<string, TabBadge>> =
    awaitingEntryCount > 0
      ? {
          'movement-log': {
            accessibilityLabel: `${awaitingEntryCount} visitors awaiting entry`,
          },
        }
      : {};

  return <RoleTabBar {...props} items={GUARD_TABS} badges={badges} />;
}

export function ResidentTabBar(props: RoleTabBarProps) {
  return <RoleTabBar {...props} items={RESIDENT_TABS} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 16,
  },
  tabPressed: {
    opacity: 0.68,
  },
  iconContainer: {
    position: 'relative',
    width: 38,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  iconContainerFocused: {
    backgroundColor: Colors.categorySecurity.bg,
  },
  label: {
    maxWidth: '100%',
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -7,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: Colors.danger700,
  },
  dotBadge: {
    position: 'absolute',
    top: 0,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  badgeLabel: {
    color: Colors.surface,
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    lineHeight: 10,
  },
});

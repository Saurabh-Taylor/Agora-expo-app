import { useEffect, useRef, useState } from 'react';
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
import { getCenteredTabIndicatorX } from '@/commonFunctions';
import {
  ADMIN_TAB_ACTIVE_INDICATOR_SIZE,
  ADMIN_TAB_BAR_HORIZONTAL_PADDING,
  ADMIN_TAB_TRANSITION_DURATION,
  Colors,
  FontFamily,
} from '@/constants/commonConstants';
import { useOpenComplaintsCount } from '@/features/complaints/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

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
  notices: { label: 'Notices', Icon: CommunicationTabIcon },
  more: { label: 'More', Icon: MoreTabIcon },
};

export function AdminTabBar({ state, navigation }: AdminTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  const pendingPressedOrderIndex = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const session = useAuthStore((storeState) => storeState.session);
  const profileQuery = useProfile(session?.user.id);
  const { data: openComplaintsCount } = useOpenComplaintsCount(profileQuery.data?.society_id);
  const openComplaints = openComplaintsCount ?? 0;
  const hasOpenComplaints = openComplaints > 0;
  const openComplaintBadgeLabel = openComplaints > 99 ? '99+' : String(openComplaints);

  const orderedRoutes = TAB_ORDER.map((name) => state.routes.find((route) => route.name === name)).filter(
    (route): route is (typeof state.routes)[number] => !!route,
  );
  const focusedRouteName = state.routes[state.index]?.name as (typeof TAB_ORDER)[number] | undefined;
  const focusedOrderIndex = orderedRoutes.findIndex((route) => route.name === focusedRouteName);
  const FocusedIcon = focusedRouteName ? TAB_META[focusedRouteName].Icon : HomeTabIcon;

  useEffect(() => {
    if (barWidth === 0 || focusedOrderIndex < 0 || orderedRoutes.length === 0) return;

    if (pendingPressedOrderIndex.current !== null) {
      if (pendingPressedOrderIndex.current === focusedOrderIndex) {
        pendingPressedOrderIndex.current = null;
      }
      return;
    }

    indicatorX.value = getCenteredTabIndicatorX(
      barWidth,
      orderedRoutes.length,
      focusedOrderIndex,
      ADMIN_TAB_BAR_HORIZONTAL_PADDING,
      ADMIN_TAB_ACTIVE_INDICATOR_SIZE,
    );
    indicatorOpacity.value = 1;
  }, [
    barWidth,
    focusedOrderIndex,
    indicatorOpacity,
    indicatorX,
    orderedRoutes.length,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View style={[styles.safeArea, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
        <Animated.View pointerEvents="none" style={[styles.activeIndicator, indicatorStyle]}>
          <FocusedIcon color={Colors.green400} />
          {focusedRouteName === 'complaints' && hasOpenComplaints && (
            <View style={[styles.badge, styles.badgeFocused]}>
              <Text style={styles.badgeLabel}>{openComplaintBadgeLabel}</Text>
            </View>
          )}
        </Animated.View>
        {orderedRoutes.map((route, orderIndex) => {
          const routeIndex = state.routes.indexOf(route);
          const isFocused = state.index === routeIndex;
          const meta = TAB_META[route.name as (typeof TAB_ORDER)[number]];

          function handlePress() {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              pendingPressedOrderIndex.current = orderIndex;
              indicatorOpacity.value = 1;
              const targetX = getCenteredTabIndicatorX(
                barWidth,
                orderedRoutes.length,
                orderIndex,
                ADMIN_TAB_BAR_HORIZONTAL_PADDING,
                ADMIN_TAB_ACTIVE_INDICATOR_SIZE,
              );

              if (reduceMotion) {
                indicatorX.value = targetX;
              } else {
                indicatorX.value = withTiming(targetX, {
                  duration: ADMIN_TAB_TRANSITION_DURATION,
                  easing: Easing.inOut(Easing.cubic),
                });
              }

              navigation.navigate(route.name);
            }
          }

          return (
            <Pressable
              key={route.key}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
              onPress={handlePress}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={
                route.name === 'complaints' && hasOpenComplaints
                  ? meta.label + ' tab, ' + openComplaints + ' open complaints'
                  : meta.label + ' tab'
              }>
              <View style={styles.iconContainer}>
                {!isFocused && <meta.Icon color={Colors.textMuted} />}
                {route.name === 'complaints' && hasOpenComplaints && !isFocused && (
                  <View style={[styles.badge, styles.badgeInactive]}>
                    <Text style={styles.badgeLabel}>{openComplaintBadgeLabel}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.label, isFocused ? styles.labelFocused : styles.labelInactive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.adminCanvas,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    marginHorizontal: 12,
    paddingHorizontal: ADMIN_TAB_BAR_HORIZONTAL_PADDING,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    shadowColor: Colors.green900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  tab: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 0,
    paddingHorizontal: 2,
    borderRadius: 18,
  },
  tabPressed: {
    opacity: 0.72,
  },
  iconContainer: {
    position: 'relative',
    width: ADMIN_TAB_ACTIVE_INDICATOR_SIZE,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    zIndex: 2,
    top: -20,
    left: 0,
    width: ADMIN_TAB_ACTIVE_INDICATOR_SIZE,
    height: ADMIN_TAB_ACTIVE_INDICATOR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ADMIN_TAB_ACTIVE_INDICATOR_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: Colors.surface,
    shadowColor: Colors.green900,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 6,
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontFamily: FontFamily.bodyBold,
    fontSize: 10,
    lineHeight: 13,
  },
  labelFocused: {
    color: Colors.green400,
  },
  labelInactive: {
    color: Colors.textMuted,
  },
  badge: {
    position: 'absolute',
    right: -7,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: Colors.danger700,
  },
  badgeFocused: {
    top: -7,
  },
  badgeInactive: {
    top: -7,
  },
  badgeLabel: {
    color: Colors.surface,
    fontFamily: FontFamily.bodyBold,
    fontSize: 8,
    lineHeight: 10,
  },
});

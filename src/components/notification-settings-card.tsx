import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { getErrorMessage } from '@/commonFunctions';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { enablePushNotifications, getPushNotificationPermission } from '@/features/notifications/api';
import { showToast } from '@/stores/toast-store';

type PermissionState = Awaited<ReturnType<typeof getPushNotificationPermission>>;

function NotificationIcon() {
  return (
    <Svg width={22} height={22} viewBox='0 0 24 24' fill='none'>
      <Path
        d='M6.5 9a5.5 5.5 0 0 1 11 0v3.2l1.5 2.3H5l1.5-2.3V9zM9.8 18h4.4'
        stroke={Colors.success700}
        strokeWidth={1.8}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </Svg>
  );
}

export function NotificationSettingsCard() {
  const [permission, setPermission] = useState<PermissionState>();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    let active = true;
    void getPushNotificationPermission().then((nextPermission) => {
      if (active) setPermission(nextPermission);
    });

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void getPushNotificationPermission().then((nextPermission) => {
        if (active) setPermission(nextPermission);
      });
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function handlePress() {
    if (!permission?.available || permission.status === 'granted' || isPending) return;
    if (!permission.canAskAgain) {
      await Linking.openSettings();
      return;
    }

    setIsPending(true);
    try {
      const enabled = await enablePushNotifications();
      const nextPermission = await getPushNotificationPermission();
      setPermission(nextPermission);
      showToast(enabled ? 'Notifications enabled' : 'Notification permission was not granted');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not enable notifications'));
    } finally {
      setIsPending(false);
    }
  }

  const isGranted = permission?.available && permission.status === 'granted';
  const title = isGranted ? 'Notifications enabled' : 'Gate and society alerts';
  const subtitle = !permission
    ? 'Checking device permission...'
    : !permission.available
      ? 'Available in an Agora development or release build'
      : isGranted
        ? 'Time-sensitive updates can reach this device'
        : permission.canAskAgain
          ? 'Enable visitor, complaint, and booking updates'
          : 'Permission is off. Open device settings to enable it';
  const action = isGranted ? 'On' : permission?.canAskAgain ? 'Enable' : 'Settings';

  return (
    <Pressable
      accessibilityRole='button'
      accessibilityState={{ disabled: !permission?.available || isGranted }}
      disabled={!permission?.available || isGranted || isPending}
      onPress={() => void handlePress()}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <NotificationIcon />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {isPending || !permission ? (
        <ActivityIndicator size='small' color={Colors.green500} />
      ) : (
        <Text style={[styles.action, isGranted && styles.actionGranted]}>{action}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.categorySecurity.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, marginLeft: 13, marginRight: 10 },
  title: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.textPrimary },
  subtitle: { fontFamily: FontFamily.bodyRegular, fontSize: 12, lineHeight: 17, color: Colors.textMuted, marginTop: 3 },
  action: { fontFamily: FontFamily.bodyBold, fontSize: 12.5, color: Colors.green500 },
  actionGranted: { color: Colors.success700 },
  pressed: { opacity: 0.78 },
});

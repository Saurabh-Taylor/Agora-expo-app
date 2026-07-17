import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { loadNotificationsModule } from '@/commonFunctions';
import { supabase } from '@/lib/supabase';

type SendPushInput = {
  profileIds?: string[];
  flatId?: string;
  notifyAllResidents?: boolean;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

// Fire-and-forget: push is a convenience layer, never a blocking dependency —
// Realtime plus a refreshable screen remain the source of truth (AGENTS.md
// "Notifications and Real-time Behavior").
export async function sendPushNotification(input: SendPushInput) {
  try {
    await supabase.functions.invoke('send-push-notification', { body: input });
  } catch (error) {
    console.warn('send-push-notification failed', error);
  }
}

// Registers this device's Expo push token against the signed-in profile.
// No-ops quietly (never throws, never blocks the caller's screen) when there's
// no linked EAS project, the permission is denied, or the upsert fails —
// missing push must never block the core workflow.
export function useRegisterPushToken(profileId: string | undefined, societyId: string | undefined) {
  useEffect(() => {
    if (!profileId || !societyId) return;
    let cancelled = false;

    (async () => {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) return;

      const Notifications = await loadNotificationsModule();
      if (!Notifications || cancelled) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted' || cancelled) return;

      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (cancelled || !token) return;

      await supabase
        .from('push_tokens')
        .upsert(
          { profile_id: profileId, society_id: societyId, token, platform: Platform.OS },
          { onConflict: 'profile_id,token' },
        );
    })().catch((error) => console.warn('push token registration failed', error));

    return () => {
      cancelled = true;
    };
  }, [profileId, societyId]);
}

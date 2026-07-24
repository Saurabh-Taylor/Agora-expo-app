import Constants from "expo-constants";
import { useEffect } from "react";
import { Platform } from "react-native";

import { loadNotificationsModule } from "@/commonFunctions";
import { supabase } from "@/lib/supabase";

type SendPushInput = {
  profileIds?: string[];
  flatId?: string;
  notifyAllResidents?: boolean;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

let registeredExpoPushToken: string | null = null;

export async function getPushNotificationPermission() {
  const Notifications = await loadNotificationsModule();
  if (!Notifications || !["android", "ios"].includes(Platform.OS)) {
    return { available: false, status: "unavailable" as const, canAskAgain: false };
  }

  const permission = await Notifications.getPermissionsAsync();
  return { available: true, status: permission.status, canAskAgain: permission.canAskAgain };
}

async function getCurrentExpoPushToken(requestPermission: boolean) {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || !["android", "ios"].includes(Platform.OS)) return null;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Agora updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (requestPermission && existingStatus !== "granted") {
    const result = await Notifications.requestPermissionsAsync();
    finalStatus = result.status;
  }
  if (finalStatus !== "granted") return null;

  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  return result.data || null;
}

export async function sendPushNotification(input: SendPushInput) {
  try {
    const { data, error } = await supabase.functions.invoke<{ sent: number }>("send-push-notification", {
      body: input,
    });
    if (error) return null;
    return data?.sent ?? 0;
  } catch {
    return null;
  }
}

export async function enablePushNotifications() {
  const token = await getCurrentExpoPushToken(true);
  if (!token) return false;

  const { error } = await supabase.rpc("register_current_push_token", {
    requested_token: token,
    requested_platform: Platform.OS,
  });
  if (error) throw error;

  registeredExpoPushToken = token;
  return true;
}

export async function unregisterCurrentDevicePushToken() {
  const token = registeredExpoPushToken ?? (await getCurrentExpoPushToken(false));
  if (!token) return;

  const { error } = await supabase.rpc("unregister_current_push_token", {
    requested_token: token,
  });
  if (error) throw error;
  registeredExpoPushToken = null;
}

export function useRegisterPushToken(profileId: string | undefined, societyId: string | undefined) {
  useEffect(() => {
    if (!profileId || !societyId) return;
    let cancelled = false;

    (async () => {
      const token = await getCurrentExpoPushToken(false);
      if (cancelled || !token) return;

      const { error } = await supabase.rpc("register_current_push_token", {
        requested_token: token,
        requested_platform: Platform.OS,
      });
      if (error) throw error;
      registeredExpoPushToken = token;
    })().catch(() => {
      // Realtime and manual refresh remain available when registration fails.
    });

    return () => {
      cancelled = true;
    };
  }, [profileId, societyId]);
}

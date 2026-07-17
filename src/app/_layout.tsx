import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
} from '@expo-google-fonts/schibsted-grotesk';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ToastHost } from '@/components/toast-host';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useRegisterPushToken } from '@/features/notifications/api';
import { useProfile } from '@/features/profile/api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

SplashScreen.preventAutoHideAsync();

// Expo Go on Android (SDK 53+) throws synchronously the moment any
// expo-notifications API touching remote/push handling is called — the
// native module for that was removed from Expo Go entirely, so a real
// development/production build is required for actual push delivery. This
// call is otherwise unguarded module-scope code, so a throw here would take
// down the whole app before a single route could mount; push is always a
// convenience layer (AGENTS.md), never a blocking dependency, including here.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (error) {
  console.warn('expo-notifications setNotificationHandler unavailable in this runtime', error);
}

function RootNavigator() {
  const session = useAuthStore((state) => state.session);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const profileQuery = useProfile(session?.user.id);

  const profile = session && profileQuery.isSuccess ? profileQuery.data : undefined;
  const mustChangePassword = !!profile?.must_change_password;

  useRegisterPushToken(profile?.id, profile?.society_id);

  useEffect(() => {
    if (!profile) return;
    try {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        // A push payload is only a hint — the destination screen re-fetches the
        // record itself and RLS re-authorizes it before showing anything.
        const data = response.notification.request.content.data as { type?: string; requestId?: string } | undefined;
        if (data?.type === 'VISITOR_REQUEST' && data.requestId && profile.role === 'RESIDENT') {
          router.push(`/(resident)/visitor-request/${data.requestId}`);
        } else if (data?.type === 'VISITOR_DECISION' && profile.role === 'GUARD') {
          router.push('/(guard)/(tabs)');
        }
      });
      return () => subscription.remove();
    } catch (error) {
      console.warn('expo-notifications listener unavailable in this runtime', error);
      return undefined;
    }
  }, [profile]);

  if (isInitializing) return null;

  if (session && profileQuery.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.green600 }}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  // The access token is still technically valid, but the profile it should
  // unlock is unreachable (revoked, deleted, or a genuinely expired session
  // Supabase hasn't flushed yet). Silently falling through to the auth
  // group would strand the user in the splash/onboarding carousel with the
  // stale session still in the store — this gives them an actionable choice
  // instead, per AGENTS.md's expired/revoked-session requirement.
  if (session && profileQuery.isError) {
    return (
      <View style={sessionErrorStyles.root}>
        <Text style={sessionErrorStyles.title}>We couldn&apos;t verify your session</Text>
        <Text style={sessionErrorStyles.subtitle}>
          This can happen if it expired or your account access changed. You can try again, or sign in again.
        </Text>
        <Pressable style={sessionErrorStyles.retryButton} onPress={() => profileQuery.refetch()} disabled={profileQuery.isFetching}>
          {profileQuery.isFetching ? (
            <ActivityIndicator size="small" color={Colors.textOnDark} />
          ) : (
            <Text style={sessionErrorStyles.retryLabel}>Try again</Text>
          )}
        </Pressable>
        <Pressable
          style={sessionErrorStyles.signOutButton}
          onPress={async () => {
            await useAuthStore.getState().signOut();
            router.replace('/(auth)/login');
          }}>
          <Text style={sessionErrorStyles.signOutLabel}>Sign out and sign in again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={!!profile && mustChangePassword}>
        <Stack.Screen name="change-password" />
      </Stack.Protected>

      <Stack.Protected guard={!!profile && !mustChangePassword && profile.role === 'RESIDENT'}>
        <Stack.Screen name="(resident)" />
      </Stack.Protected>

      <Stack.Protected guard={!!profile && !mustChangePassword && profile.role === 'GUARD'}>
        <Stack.Screen name="(guard)" />
      </Stack.Protected>

      <Stack.Protected guard={!!profile && !mustChangePassword && profile.role === 'ADMIN'}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <RootNavigator />
      <ToastHost />
    </QueryClientProvider>
  );
}

const sessionErrorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 20, textAlign: 'center' },
  subtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 21 },
  retryButton: {
    marginTop: 26,
    width: '100%',
    height: 52,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: { fontSize: 15, fontWeight: '700', color: Colors.textOnDark },
  signOutButton: { marginTop: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  signOutLabel: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
});

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
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ToastHost } from '@/components/toast-host';
import { Colors } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const session = useAuthStore((state) => state.session);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const profileQuery = useProfile(session?.user.id);

  if (isInitializing) return null;

  if (session && profileQuery.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.green600 }}>
        <ActivityIndicator color={Colors.gold} />
      </View>
    );
  }

  const profile = session && profileQuery.isSuccess ? profileQuery.data : undefined;
  const mustChangePassword = !!profile?.must_change_password;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session || profileQuery.isError}>
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

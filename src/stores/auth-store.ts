import type { Session } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  isInitializing: boolean;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => {
  supabase.auth.onAuthStateChange((_event, session) => {
    set({ session, isInitializing: false });
  });

  return {
    session: null,
    isInitializing: true,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
});

// Shared by every role's sign-out entry point (Admin's More tile, Resident
// and Guard's Home avatar) — one native confirm so an accidental tap can't
// silently end the session.
export function confirmSignOut() {
  Alert.alert('Sign out?', "You'll need to sign in again to continue.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => useAuthStore.getState().signOut() },
  ]);
}

import type { Session } from '@supabase/supabase-js';
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

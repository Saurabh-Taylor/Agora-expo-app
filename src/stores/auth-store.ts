import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { markOnboardingComplete } from '@/commonFunctions';
import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  isInitializing: boolean;
  isPasswordRecovery: boolean;
  isSignOutDialogOpen: boolean;
  beginPasswordRecovery: () => void;
  finishPasswordRecovery: () => void;
  openSignOutDialog: () => void;
  closeSignOutDialog: () => void;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => {
  supabase.auth.onAuthStateChange((event, session) => {
    set((state) => ({
      session,
      isInitializing: false,
      isPasswordRecovery: event === 'PASSWORD_RECOVERY' ? true : event === 'SIGNED_OUT' ? false : state.isPasswordRecovery,
      isSignOutDialogOpen: event === 'SIGNED_OUT' ? false : state.isSignOutDialogOpen,
    }));
  });

  return {
    session: null,
    isInitializing: true,
    isPasswordRecovery: false,
    isSignOutDialogOpen: false,
    beginPasswordRecovery: () => set({ isPasswordRecovery: true }),
    finishPasswordRecovery: () => set({ isPasswordRecovery: false }),
    openSignOutDialog: () => set({ isSignOutDialogOpen: true }),
    closeSignOutDialog: () => set({ isSignOutDialogOpen: false }),
    signOut: async () => {
      await markOnboardingComplete();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  };
});

// Shared by the Resident, Guard, and Admin More tabs.
// The global themed dialog keeps confirmation behavior consistent.
export function confirmSignOut() {
  useAuthStore.getState().openSignOutDialog();
}

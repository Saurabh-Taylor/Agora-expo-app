import { router } from 'expo-router';
import { useState } from 'react';
import Svg, { Path } from 'react-native-svg';

import { getErrorMessage } from '@/commonFunctions';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { AuthRoutes, Colors } from '@/constants/commonConstants';
import { useAuthStore } from '@/stores/auth-store';

function SignOutIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10"
        stroke={Colors.gold}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Path
        d="M14 8l4 4-4 4M8.5 12H18"
        stroke={Colors.gold}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SignOutDialog() {
  const visible = useAuthStore((state) => state.isSignOutDialogOpen);
  const closeDialog = useAuthStore((state) => state.closeSignOutDialog);
  const signOut = useAuthStore((state) => state.signOut);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClose() {
    if (isSigningOut) return;
    setErrorMessage(null);
    closeDialog();
  }

  async function handleSignOut() {
    if (isSigningOut) return;

    setIsSigningOut(true);
    setErrorMessage(null);

    try {
      await signOut();
      closeDialog();
      router.replace(AuthRoutes.login);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'We could not sign you out. Please try again.'));
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <ConfirmationDialog
      visible={visible}
      icon={<SignOutIcon />}
      title="Sign out of Agora?"
      message="You’ll return to the login screen and can sign back in anytime."
      confirmLabel="Sign out"
      isPending={isSigningOut}
      errorMessage={errorMessage}
      onCancel={handleClose}
      onConfirm={() => void handleSignOut()}
    />
  );
}

import { router } from 'expo-router';
import { useEffect } from 'react';

import { hasCompletedOnboarding } from '@/commonFunctions';
import { BrandedSplash } from '@/components/branded-splash';
import { AuthRoutes } from '@/constants/commonConstants';

export default function AuthEntryScreen() {
  useEffect(() => {
    let isMounted = true;

    void hasCompletedOnboarding().then((isComplete) => {
      if (isMounted) router.replace(isComplete ? AuthRoutes.login : AuthRoutes.onboarding);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return <BrandedSplash />;
}

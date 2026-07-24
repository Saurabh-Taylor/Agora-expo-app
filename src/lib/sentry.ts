import * as Sentry from '@sentry/react-native';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: __DEV__ ? 'development' : 'production',
  sendDefaultPii: false,
  tracesSampleRate: __DEV__ ? 0 : 0.1,
});

export function setSentryIdentity(
  profile?: {
    id: string;
    role: string;
    society_id: string;
  },
) {
  Sentry.setUser(profile ? { id: profile.id } : null);
  Sentry.setTag('role', profile?.role ?? 'unauthenticated');
  Sentry.setTag('society_id', profile?.society_id ?? 'none');
}

export { Sentry };

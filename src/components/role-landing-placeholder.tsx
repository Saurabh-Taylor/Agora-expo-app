import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

type RoleLandingPlaceholderProps = {
  roleLabel: string;
};

export function RoleLandingPlaceholder({ roleLabel }: RoleLandingPlaceholderProps) {
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const profileQuery = useProfile(session?.user.id);

  return (
    <View style={styles.root}>
      <Text style={styles.overline}>{roleLabel} DASHBOARD</Text>
      <Text style={styles.heading}>{profileQuery.data ? `Welcome, ${profileQuery.data.full_name.split(' ')[0]}` : 'Welcome'}</Text>
      <Text style={styles.subheading}>
        Signed in. This role&apos;s real dashboard lands in a later build phase — for now this confirms auth, RBAC and
        routing are wired end to end.
      </Text>
      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutLabel}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  overline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  heading: { fontFamily: FontFamily.headingExtraBold, fontSize: 26, color: Colors.textPrimary, textAlign: 'center' },
  subheading: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  signOutButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: Colors.green500,
  },
  signOutLabel: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.textOnDark },
});

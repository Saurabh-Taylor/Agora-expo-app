import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getInitials } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { confirmSignOut, useAuthStore } from '@/stores/auth-store';

function SignOutIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10" stroke={Colors.danger700} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M14 8l4 4-4 4M8.5 12H18" stroke={Colors.danger700} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function AccountMoreScreen() {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const profile = profileQuery.data;
  const roleLabel = profile?.role === 'GUARD' ? 'Security Guard' : 'Resident';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>More</Text>
      <Text style={styles.subtitle}>Account and session</Text>

      <AsyncState
        isLoading={profileQuery.isLoading}
        isError={profileQuery.isError}
        errorTitle="Account details unavailable"
        errorMessage="We couldn’t load your account details. Try again."
        onRetry={() => profileQuery.refetch()}
      />

      {profile && (
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{getInitials(profile.full_name)}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{profile.full_name}</Text>
            <Text style={styles.role}>{roleLabel}</Text>
            {profile.society?.name && <Text style={styles.society}>{profile.society.name}</Text>}
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <Pressable
        style={({ pressed }) => [styles.signOutCard, pressed && styles.cardPressed]}
        onPress={confirmSignOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out of Agora">
        <View style={styles.signOutIconWrap}>
          <SignOutIcon />
        </View>
        <View style={styles.actionText}>
          <Text style={styles.signOutTitle}>Sign out</Text>
          <Text style={styles.signOutSubtitle}>End this session securely</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.adminCanvas,
    paddingHorizontal: 18,
    paddingBottom: 108,
  },
  title: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 28,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13.5,
    color: Colors.textMuted,
    marginTop: 3,
  },
  profileCard: {
    backgroundColor: Colors.green400,
    borderRadius: Radius.cardLarge,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: Colors.textOnDark,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    color: Colors.green500,
  },
  profileText: { flex: 1, marginLeft: 14 },
  name: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    color: Colors.textOnDark,
  },
  role: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 12.5,
    color: Colors.gold,
    marginTop: 3,
  },
  society: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: 'rgba(247,244,236,0.68)',
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: Colors.textMuted,
    marginTop: 28,
    marginBottom: 10,
  },
  signOutCard: {
    minHeight: 76,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  signOutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F9E4E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1, marginLeft: 13 },
  signOutTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: Colors.danger700,
  },
  signOutSubtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  chevron: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 28,
    color: Colors.textFaint,
    marginLeft: 8,
  },
  cardPressed: { opacity: 0.78 },
});

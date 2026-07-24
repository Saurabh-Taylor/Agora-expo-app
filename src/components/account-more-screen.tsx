import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getInitials } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { NotificationSettingsCard } from '@/components/notification-settings-card';
import { AgoraSymbol } from '@/components/icons/agora-symbol';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { confirmSignOut, useAuthStore } from '@/stores/auth-store';

function DirectoryIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M5 4.5h14v15H5v-15zM8 8h8M8 12h8M8 16h5" stroke={Colors.success700} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.root, { paddingTop: insets.top + 24 }]}
      showsVerticalScrollIndicator={false}>
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

      {profile && (
        <>
          <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
          <NotificationSettingsCard />
        </>
      )}

      {profile?.role === 'RESIDENT' && (
        <>
          <Text style={styles.sectionLabel}>COMMUNITY</Text>
          <Pressable
            style={({ pressed }) => [styles.directoryCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(resident)/directory' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open society staff and service directory">
            <View style={styles.directoryIconWrap}>
              <DirectoryIcon />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.directoryTitle}>Society directory</Text>
              <Text style={styles.directorySubtitle}>Active staff and trusted service contacts</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.directoryCard, styles.spacedCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(resident)/vehicles' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open my vehicles and parking">
            <View style={styles.directoryIconWrap}>
              <AgoraSymbol name="vehicle" color={Colors.success700} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.directoryTitle}>My vehicles & parking</Text>
              <Text style={styles.directorySubtitle}>Manage vehicles and view assigned slots</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.directoryCard, styles.spacedCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(resident)/documents' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open society documents">
            <View style={styles.directoryIconWrap}>
              <AgoraSymbol name="documents" color={Colors.success700} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.directoryTitle}>Society documents</Text>
              <Text style={styles.directorySubtitle}>Search and download published records</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </>
      )}

      {profile?.role === 'GUARD' && (
        <>
          <Text style={styles.sectionLabel}>OPERATIONS</Text>
          <Pressable
            style={({ pressed }) => [styles.directoryCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(guard)/tasks' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open my assigned daily tasks">
            <View style={styles.directoryIconWrap}>
              <AgoraSymbol name="tasks" color={Colors.success700} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.directoryTitle}>My daily tasks</Text>
              <Text style={styles.directorySubtitle}>Start, update, comment, and complete work</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.directoryCard, styles.spacedCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(guard)/parking' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open society parking lookup">
            <View style={styles.directoryIconWrap}>
              <AgoraSymbol name="parking" color={Colors.success700} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.directoryTitle}>Parking lookup</Text>
              <Text style={styles.directorySubtitle}>Find slots, resident vehicles, and flats</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.directoryCard, styles.spacedCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(guard)/documents' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Open guard society documents">
            <View style={styles.directoryIconWrap}>
              <AgoraSymbol name="documents" color={Colors.success700} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.directoryTitle}>Society documents</Text>
              <Text style={styles.directorySubtitle}>View records published for security staff</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.adminCanvas },
  root: {
    flexGrow: 1,
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
  directoryCard: {
    minHeight: 76,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacedCard: { marginTop: 10 },
  directoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.categorySecurity.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directoryTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  directorySubtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
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

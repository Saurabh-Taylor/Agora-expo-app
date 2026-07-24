import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getInitials, matchesDirectorySearch } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useDirectoryRealtimeSync, useServiceProviders, useStaff } from '@/features/staff/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type DirectoryTab = 'Staff' | 'Services';

function callDirectoryContact(phone: string) {
  const normalizedPhone = phone.replace(/[^0-9+]/g, '');
  return Linking.openURL('tel:' + normalizedPhone);
}

export default function ResidentDirectoryScreen() {
  const [tab, setTab] = useState<DirectoryTab>('Staff');
  const [search, setSearch] = useState('');
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const staffQuery = useStaff(societyId);
  const providersQuery = useServiceProviders(societyId);
  useDirectoryRealtimeSync(societyId);

  const staff = (staffQuery.data ?? []).filter(
    (member) =>
      member.status === 'ON_DUTY' &&
      matchesDirectorySearch(member, search, [member.role, member.shift ?? '', member.phone ?? '']),
  );
  const providers = (providersQuery.data ?? []).filter(
    (provider) =>
      provider.status === 'ON_DUTY' &&
      matchesDirectorySearch(provider, search, [provider.category, provider.phone ?? '']),
  );
  const activeQuery = tab === 'Staff' ? staffQuery : providersQuery;
  const activeRecords = tab === 'Staff' ? staff : providers;

  async function call(phone: string) {
    try {
      await callDirectoryContact(phone);
    } catch {
      showToast('This device could not open the phone app');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text accessibilityRole="header" style={styles.title}>Society directory</Text>
      </View>
      <Text style={styles.subtitle}>Active society staff and trusted service contacts.</Text>

      <View style={styles.segmented}>
        {(['Staff', 'Services'] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            onPress={() => {
              setTab(item);
              setSearch('');
            }}
            style={[styles.segment, tab === item && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, tab === item && styles.segmentLabelActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={tab === 'Staff' ? 'Search name, role, or shift' : 'Search name or service'}
        placeholderTextColor={Colors.textFaint}
        style={styles.searchInput}
        returnKeyType="search"
        accessibilityLabel="Search society directory"
      />

      <View style={styles.list}>
        <AsyncState
          isLoading={profileQuery.isLoading || activeQuery.isLoading}
          isError={profileQuery.isError || activeQuery.isError}
          isRetrying={profileQuery.isRefetching || activeQuery.isRefetching}
          onRetry={() => {
            profileQuery.refetch();
            activeQuery.refetch();
          }}
          isEmpty={activeRecords.length === 0}
          emptyTitle={search.trim() ? 'No matching contacts' : 'No active contacts'}
          emptyMessage={
            search.trim()
              ? 'Try another name, role, or category.'
              : 'Your society admin has not published active directory contacts.'
          }
          actionLabel={search.trim() ? 'Clear search' : undefined}
          onAction={search.trim() ? () => setSearch('') : undefined}
        />

        {tab === 'Staff' &&
          staff.map((member) => (
            <View key={member.id} style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>{getInitials(member.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.name}>{member.name}</Text>
                <Text style={styles.meta}>
                  {member.role}
                  {member.shift ? ' - ' + member.shift : ''}
                </Text>
              </View>
              {member.phone && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${member.name}`}
                  style={styles.callButton}
                  onPress={() => void call(member.phone as string)}>
                  <Text style={styles.callButtonLabel}>Call</Text>
                </Pressable>
              )}
            </View>
          ))}

        {tab === 'Services' &&
          providers.map((provider) => (
            <View key={provider.id} style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>{getInitials(provider.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.name}>{provider.name}</Text>
                <Text style={styles.meta}>{provider.category}</Text>
              </View>
              {provider.phone && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${provider.name}`}
                  style={styles.callButton}
                  onPress={() => void call(provider.phone as string)}>
                  <Text style={styles.callButtonLabel}>Call</Text>
                </Pressable>
              )}
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { marginTop: 8, marginLeft: 48, fontSize: 13, color: Colors.textMuted },
  segmented: { flexDirection: 'row', backgroundColor: '#DDD6C7', borderRadius: 14, padding: 4, marginTop: 18 },
  segment: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: Colors.green500 },
  segmentLabel: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  segmentLabelActive: { color: Colors.textOnDark },
  searchInput: {
    minHeight: 48,
    marginTop: 14,
    paddingHorizontal: 15,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    fontSize: 14.5,
    color: Colors.textPrimary,
  },
  list: { gap: 10, marginTop: 12 },
  card: {
    minHeight: 72,
    padding: 13,
    borderRadius: Radius.card - 2,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.categoryBilling.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 16, color: '#8A5A00' },
  name: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  meta: { marginTop: 2, fontSize: 12.5, color: Colors.textMuted },
  callButton: {
    minWidth: 58,
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: Colors.categorySecurity.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  callButtonLabel: { fontSize: 13, fontWeight: '700', color: Colors.success700 },
});

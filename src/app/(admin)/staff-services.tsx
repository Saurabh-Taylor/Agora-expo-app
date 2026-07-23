import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  getInitials,
  getServiceProviderStatusStyle,
  getStaffStatusStyle,
  matchesDirectorySearch,
} from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useDirectoryRealtimeSync, useServiceProviders, useStaff } from '@/features/staff/api';
import { useAuthStore } from '@/stores/auth-store';

type Tab = 'Staff' | 'Services';

export default function StaffServicesScreen() {
  const [tab, setTab] = useState<Tab>('Staff');
  const [search, setSearch] = useState('');
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const staffQuery = useStaff(societyId);
  const providersQuery = useServiceProviders(societyId);
  useDirectoryRealtimeSync(societyId);

  const staff = (staffQuery.data ?? []).filter((member) =>
    matchesDirectorySearch(member, search, [member.role, member.shift ?? '', member.phone ?? '']),
  );
  const providers = (providersQuery.data ?? []).filter((provider) =>
    matchesDirectorySearch(provider, search, [provider.category, provider.phone ?? '']),
  );
  const activeQuery = tab === 'Staff' ? staffQuery : providersQuery;
  const activeRecords = tab === 'Staff' ? staff : providers;
  const addRoute = tab === 'Staff' ? '/(admin)/add-staff' : '/(admin)/add-service-provider';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Staff & Services</Text>
      </View>

      <View style={styles.segmented}>
        {(['Staff', 'Services'] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => {
              setTab(item);
              setSearch('');
            }}
            style={[styles.segment, tab === item && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}>
            <Text style={[styles.segmentLabel, tab === item && styles.segmentLabelActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={tab === 'Staff' ? 'Search name, role or shift' : 'Search name or category'}
        placeholderTextColor={Colors.textFaint}
        style={styles.searchInput}
        returnKeyType="search"
        accessibilityLabel="Search directory"
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
          emptyTitle={search.trim() ? 'No matches' : tab === 'Staff' ? 'No staff yet' : 'No providers yet'}
          emptyMessage={
            search.trim()
              ? 'Try a different name or category.'
              : tab === 'Staff'
                ? 'Add society staff to start the directory.'
                : 'Add trusted service providers to start the directory.'
          }
          actionLabel={search.trim() ? 'Clear search' : tab === 'Staff' ? 'Add staff member' : 'Add service provider'}
          onAction={() => (search.trim() ? setSearch('') : router.push(addRoute))}
        />

        {tab === 'Staff' &&
          staff.map((member) => {
            const statusStyle = getStaffStatusStyle(member.status);
            return (
              <Pressable
                key={member.id}
                style={styles.card}
                onPress={() => router.push(`/(admin)/staff/${member.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${member.name}`}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLabel}>{getInitials(member.name)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.name}>{member.name}</Text>
                  <Text style={styles.meta}>
                    {member.role}
                    {member.shift ? ` · ${member.shift}` : ''}
                  </Text>
                </View>
                <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
              </Pressable>
            );
          })}

        {tab === 'Services' &&
          providers.map((provider) => {
            const statusStyle = getServiceProviderStatusStyle(provider.status);
            return (
              <Pressable
                key={provider.id}
                style={styles.card}
                onPress={() => router.push(`/(admin)/service-provider/${provider.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${provider.name}`}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarLabel}>{getInitials(provider.name)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.name}>{provider.name}</Text>
                  <Text style={styles.meta}>{provider.category}</Text>
                </View>
                <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
              </Pressable>
            );
          })}

        {activeRecords.length > 0 && (
          <Pressable style={styles.addButton} onPress={() => router.push(addRoute)} accessibilityRole="button">
            <Text style={styles.addButtonLabel}>{tab === 'Staff' ? '+ Add staff member' : '+ Add service provider'}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  segmented: { flexDirection: 'row', backgroundColor: '#EBE6D8', borderRadius: 14, padding: 4, marginTop: 18 },
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F6ECD8', alignItems: 'center', justifyContent: 'center' },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 16, color: '#9A6B14' },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  meta: { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },
  addButton: {
    minHeight: 52,
    marginTop: 6,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: '#C9BE9F',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  addButtonLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.success700 },
});

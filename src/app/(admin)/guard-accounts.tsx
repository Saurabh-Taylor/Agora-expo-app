import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage, getInitials } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useGuards, useSetGuardActive } from '@/features/guards/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function GuardAccountsScreen() {
  const [search, setSearch] = useState('');
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const guardsQuery = useGuards(societyId);
  const setGuardActive = useSetGuardActive();

  const guards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (guardsQuery.data ?? []).filter(
      (guard) =>
        !query ||
        guard.full_name.toLowerCase().includes(query) ||
        guard.phone?.toLowerCase().includes(query),
    );
  }, [guardsQuery.data, search]);

  function changeGuardAccess(guardId: string, guardName: string, active: boolean) {
    if (!societyId) return;

    const run = async () => {
      try {
        await setGuardActive.mutateAsync({ guardId, societyId, active });
        showToast(active ? 'Guard account activated' : 'Guard account deactivated');
      } catch (error) {
        showToast(getErrorMessage(error, 'Could not update guard access'));
      }
    };

    if (active) {
      void run();
      return;
    }

    Alert.alert(
      'Deactivate guard account?',
      `${guardName} will immediately lose access to gate operations. Existing movement history remains intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => void run() },
      ],
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text accessibilityRole="header" style={styles.title}>Security guards</Text>
      </View>
      <Text style={styles.subtitle}>Create and control gate-operations accounts for this society.</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search guards"
        placeholderTextColor={Colors.textFaint}
        style={styles.searchInput}
        returnKeyType="search"
        accessibilityLabel="Search guard accounts"
      />

      <View style={styles.list}>
        <AsyncState
          isLoading={profileQuery.isLoading || guardsQuery.isLoading}
          isError={profileQuery.isError || guardsQuery.isError}
          isRetrying={profileQuery.isRefetching || guardsQuery.isRefetching}
          onRetry={() => {
            profileQuery.refetch();
            guardsQuery.refetch();
          }}
          isEmpty={guards.length === 0}
          emptyTitle={search.trim() ? 'No matching guards' : 'No guard accounts'}
          emptyMessage={
            search.trim()
              ? 'Try another name or phone number.'
              : 'Create a dedicated account before assigning someone to gate operations.'
          }
          actionLabel={search.trim() ? 'Clear search' : 'Add security guard'}
          onAction={() => (search.trim() ? setSearch('') : router.push('/(admin)/add-guard' as Href))}
        />

        {guards.map((guard) => (
          <View key={guard.id} style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>{getInitials(guard.full_name)}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{guard.full_name}</Text>
              <Text style={styles.meta}>{guard.phone || 'No phone added'}</Text>
              {guard.must_change_password && <Text style={styles.passwordStatus}>Password change pending</Text>}
            </View>
            <View style={styles.actions}>
              <StatusPill
                label={guard.is_active ? 'Active' : 'Inactive'}
                color={guard.is_active ? Colors.success600 : Colors.danger700}
                backgroundColor={guard.is_active ? Colors.categorySecurity.bg : '#F9E4E1'}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={guard.is_active ? `Deactivate ${guard.full_name}` : `Activate ${guard.full_name}`}
                accessibilityState={{ disabled: setGuardActive.isPending }}
                style={styles.accessButton}
                disabled={setGuardActive.isPending}
                onPress={() => changeGuardAccess(guard.id, guard.full_name, !guard.is_active)}>
                <Text style={[styles.accessButtonLabel, guard.is_active && styles.deactivateLabel]}>
                  {guard.is_active ? 'Deactivate' : 'Activate'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {guards.length > 0 && (
          <Pressable
            accessibilityRole="button"
            style={styles.addButton}
            onPress={() => router.push('/(admin)/add-guard' as Href)}>
            <Text style={styles.addButtonLabel}>+ Add security guard</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { marginTop: 8, marginLeft: 48, fontSize: 13, lineHeight: 19, color: Colors.textMuted },
  searchInput: {
    minHeight: 48,
    marginTop: 18,
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
    minHeight: 82,
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
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.categorySecurity.bg,
  },
  avatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 16, color: Colors.categorySecurity.text },
  name: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  meta: { marginTop: 2, fontSize: 12.5, color: Colors.textMuted },
  passwordStatus: { marginTop: 3, fontSize: 11.5, color: '#8A5A00' },
  actions: { alignItems: 'flex-end', gap: 8 },
  accessButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4 },
  accessButtonLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.success700 },
  deactivateLabel: { color: Colors.danger700 },
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

import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { ParkingLayoutGrid } from '@/components/parking-layout-grid';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useParkingLayout, useParkingRealtime } from '@/features/parking/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export default function GuardParkingScreen() {
  const [search, setSearch] = useState('');
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const layoutQuery = useParkingLayout(societyId);
  useParkingRealtime(societyId);
  const normalizedSearch = search.trim().toLowerCase();
  const slots = (layoutQuery.data ?? []).filter((slot) => !normalizedSearch || `${slot.code} ${slot.zone} ${slot.level_label} ${slot.assignment?.vehicle?.registration_number ?? ''} ${slot.assignment?.flat?.tower?.code ?? ''}-${slot.assignment?.flat?.number ?? ''}`.toLowerCase().includes(normalizedSearch));

  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.headerRow}><BackArrowButton onPress={() => router.back()} /><View style={styles.flex}><Text accessibilityRole="header" style={styles.title}>Parking lookup</Text><Text style={styles.subtitle}>Read-only live society parking map</Text></View></View><TextInput value={search} onChangeText={setSearch} placeholder="Search slot, vehicle, or flat" placeholderTextColor={Colors.textFaint} returnKeyType="search" style={styles.search} accessibilityLabel="Search society parking" /><AsyncState isLoading={profileQuery.isLoading || layoutQuery.isLoading} isError={profileQuery.isError || layoutQuery.isError} isRetrying={profileQuery.isRefetching || layoutQuery.isRefetching} onRetry={() => { profileQuery.refetch(); layoutQuery.refetch(); }} isEmpty={!layoutQuery.isLoading && slots.length === 0} emptyTitle={search ? 'No parking match' : 'No parking layout'} emptyMessage={search ? 'Try another slot, registration, or flat.' : 'The society admin has not created parking slots.'} actionLabel={search ? 'Clear search' : undefined} onAction={search ? () => setSearch('') : undefined} />{slots.length > 0 && <ParkingLayoutGrid slots={slots} />}</ScrollView>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.canvas }, content: { paddingHorizontal: 16, paddingBottom: 48 }, flex: { flex: 1 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary }, subtitle: { marginTop: 2, fontSize: 12.5, color: Colors.textMuted }, search: { minHeight: 48, marginTop: 18, marginBottom: 14, paddingHorizontal: 14, borderRadius: Radius.input, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, color: Colors.textPrimary } });

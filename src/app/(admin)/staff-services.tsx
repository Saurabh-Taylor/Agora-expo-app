import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getInitials, getServiceProviderStatusStyle, getStaffStatusStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useServiceProviders, useStaff } from '@/features/staff/api';

type Tab = 'Staff' | 'Services';

export default function StaffServicesScreen() {
  const [tab, setTab] = useState<Tab>('Staff');
  const staffQuery = useStaff();
  const providersQuery = useServiceProviders();

  const staff = staffQuery.data ?? [];
  const providers = providersQuery.data ?? [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Staff & Services</Text>
      </View>

      <View style={styles.segmented}>
        {(['Staff', 'Services'] as const).map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.segment, tab === item && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, tab === item && styles.segmentLabelActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'Staff' && (
        <View style={styles.list}>
          <AsyncState
            isLoading={staffQuery.isLoading}
            isError={staffQuery.isError}
            onRetry={() => staffQuery.refetch()}
            isEmpty={staff.length === 0}
            emptyMessage="No staff added yet."
          />
          {staff.map((member) => {
            const statusStyle = getStaffStatusStyle(member.status);
            return (
              <Pressable key={member.id} style={styles.card} onPress={() => router.push(`/(admin)/staff/${member.id}`)}>
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
          <Pressable style={styles.addButton} onPress={() => router.push('/(admin)/add-staff')}>
            <Text style={styles.addButtonLabel}>+ Add staff member</Text>
          </Pressable>
        </View>
      )}

      {tab === 'Services' && (
        <View style={styles.list}>
          <AsyncState
            isLoading={providersQuery.isLoading}
            isError={providersQuery.isError}
            onRetry={() => providersQuery.refetch()}
            isEmpty={providers.length === 0}
            emptyMessage="No service providers added yet."
          />
          {providers.map((provider) => {
            const statusStyle = getServiceProviderStatusStyle(provider.status);
            return (
              <Pressable
                key={provider.id}
                style={styles.card}
                onPress={() => router.push(`/(admin)/service-provider/${provider.id}`)}>
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
          <Pressable style={styles.addButton} onPress={() => router.push('/(admin)/add-service-provider')}>
            <Text style={styles.addButtonLabel}>+ Add service provider</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  segmented: { flexDirection: 'row', backgroundColor: '#EBE6D8', borderRadius: 14, padding: 4, marginTop: 18 },
  segment: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: Colors.green500 },
  segmentLabel: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  segmentLabelActive: { color: Colors.textOnDark },
  list: { gap: 10, marginTop: 16 },
  card: {
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
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },
  addButton: {
    marginTop: 6,
    height: 52,
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

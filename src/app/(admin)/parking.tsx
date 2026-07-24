import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { ParkingLayoutGrid } from '@/components/parking-layout-grid';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useParkingLayout, useParkingRealtime } from '@/features/parking/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export default function AdminParkingScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const layoutQuery = useParkingLayout(societyId);
  useParkingRealtime(societyId);
  const slots = layoutQuery.data ?? [];
  const activeSlots = slots.filter((slot) => slot.is_active);
  const occupiedCount = activeSlots.filter((slot) => slot.assignment).length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <View style={styles.flex}>
          <Text accessibilityRole="header" style={styles.title}>Parking management</Text>
          <Text style={styles.subtitle}>Live layout, occupancy, and resident assignments</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricValue}>{activeSlots.length}</Text><Text style={styles.metricLabel}>Active slots</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{occupiedCount}</Text><Text style={styles.metricLabel}>Occupied</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{activeSlots.length - occupiedCount}</Text><Text style={styles.metricLabel}>Vacant</Text></View>
      </View>

      <Pressable
        accessibilityRole="button"
        style={styles.addButton}
        onPress={() => router.push('/(admin)/add-parking-slot' as Href)}>
        <Text style={styles.addButtonLabel}>+ Add parking slot</Text>
      </Pressable>

      <AsyncState
        isLoading={profileQuery.isLoading || layoutQuery.isLoading}
        isError={profileQuery.isError || layoutQuery.isError}
        isRetrying={profileQuery.isRefetching || layoutQuery.isRefetching}
        onRetry={() => { profileQuery.refetch(); layoutQuery.refetch(); }}
        isEmpty={!layoutQuery.isLoading && slots.length === 0}
        emptyTitle="No parking layout"
        emptyMessage="Add the first slot to start building the society parking map."
        actionLabel="Add first slot"
        onAction={() => router.push('/(admin)/add-parking-slot' as Href)}
      />

      {slots.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Visual layout</Text>
          <Text style={styles.help}>Tap a slot to assign, reassign, release, or change its availability.</Text>
          <ParkingLayoutGrid
            slots={slots}
            onSlotPress={(slot) => router.push(`/(admin)/assign-parking?slotId=${slot.id}` as Href)}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 18, paddingBottom: 48 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { marginTop: 2, fontSize: 12.5, color: Colors.textMuted },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 20 },
  metric: { flex: 1, minHeight: 76, padding: 12, borderRadius: Radius.input, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  metricValue: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.green500 },
  metricLabel: { marginTop: 4, fontSize: 11.5, color: Colors.textMuted },
  addButton: { minHeight: 50, marginTop: 14, borderRadius: Radius.button, backgroundColor: Colors.green500, alignItems: 'center', justifyContent: 'center' },
  addButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14.5, color: Colors.textOnDark },
  sectionTitle: { marginTop: 24, fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textPrimary },
  help: { marginTop: 4, marginBottom: 14, fontSize: 12.5, lineHeight: 18, color: Colors.textMuted },
});

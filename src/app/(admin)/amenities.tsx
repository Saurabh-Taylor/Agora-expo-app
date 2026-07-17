import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getInitials } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useAmenities, usePendingBookingsCount } from '@/features/amenities/api';

function formatTimings(openTime: string | null, closeTime: string | null) {
  if (!openTime || !closeTime) return 'Timing not set';
  return `${openTime.slice(0, 5)} – ${closeTime.slice(0, 5)}`;
}

export default function AmenitiesScreen() {
  const amenitiesQuery = useAmenities();
  const pendingQuery = usePendingBookingsCount();
  const amenities = amenitiesQuery.data ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Amenities</Text>
      </View>
      <Text style={styles.subtitle}>{pendingQuery.data ?? 0} booking requests waiting</Text>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={amenities}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <AsyncState
            isLoading={amenitiesQuery.isLoading}
            isError={amenitiesQuery.isError}
            onRetry={() => amenitiesQuery.refetch()}
            isEmpty={amenities.length === 0}
            emptyMessage="No amenities yet. Add one for residents to book."
          />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/(admin)/amenity/${item.id}`)}>
            <View style={styles.iconWrap}>
              <Text style={styles.iconLabel}>{getInitials(item.name)}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.timings}>{formatTimings(item.open_time, item.close_time)}</Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable style={styles.addButton} onPress={() => router.push('/(admin)/add-amenity')}>
        <Text style={styles.addButtonLabel}>+ Add amenity</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas, paddingTop: 66, paddingHorizontal: 16 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  list: { marginTop: 16 },
  listContent: { gap: 10, paddingBottom: 20 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#E9F1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: { fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.success700 },
  name: { fontSize: 15, fontWeight: '700' },
  timings: { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },
  addButton: {
    marginTop: 16,
    marginBottom: 16,
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

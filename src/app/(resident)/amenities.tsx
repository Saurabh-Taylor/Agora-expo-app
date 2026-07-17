import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getBookingStatusStyle, getInitials } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useAmenities, useFlatBookings } from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

type Tab = 'Browse' | 'My Bookings';

function formatTimings(openTime: string | null, closeTime: string | null) {
  if (!openTime || !closeTime) return 'Timing not set';
  return `${openTime.slice(0, 5)} – ${closeTime.slice(0, 5)}`;
}

function formatSlot(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const day = startDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
  const startTime = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${startTime} – ${endTime}`;
}

export default function ResidentAmenitiesScreen() {
  const [tab, setTab] = useState<Tab>('Browse');
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const amenitiesQuery = useAmenities();
  const bookingsQuery = useFlatBookings(profileQuery.data?.flat_id);

  const amenities = amenitiesQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Amenities</Text>
      </View>

      <View style={styles.segmented}>
        {(['Browse', 'My Bookings'] as const).map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.segment, tab === item && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, tab === item && styles.segmentLabelActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'Browse' && (
        <View style={styles.list}>
          <AsyncState
            isLoading={amenitiesQuery.isLoading}
            isError={amenitiesQuery.isError}
            onRetry={() => amenitiesQuery.refetch()}
            isEmpty={amenities.length === 0}
            emptyMessage="No amenities available yet."
          />
          {amenities.map((amenity) => (
            <Pressable key={amenity.id} style={styles.card} onPress={() => router.push(`/(resident)/book-amenity/${amenity.id}`)}>
              <View style={styles.iconWrap}>
                <Text style={styles.iconLabel}>{getInitials(amenity.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.name}>{amenity.name}</Text>
                <Text style={styles.timings}>{formatTimings(amenity.open_time, amenity.close_time)}</Text>
                {!!amenity.description && (
                  <Text style={styles.description} numberOfLines={1}>
                    {amenity.description}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {tab === 'My Bookings' && (
        <View style={styles.list}>
          <AsyncState
            isLoading={bookingsQuery.isLoading}
            isError={bookingsQuery.isError}
            onRetry={() => bookingsQuery.refetch()}
            isEmpty={bookings.length === 0}
            emptyMessage="No bookings yet. Browse amenities to request a slot."
          />
          {bookings.map((booking) => {
            const statusStyle = getBookingStatusStyle(booking.status);
            return (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingTopRow}>
                  <Text style={styles.bookingAmenity}>{booking.amenity?.name ?? 'Amenity'}</Text>
                  <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
                </View>
                <Text style={styles.bookingSlot}>{formatSlot(booking.slot_start, booking.slot_end)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  segmented: { flexDirection: 'row', backgroundColor: '#EBE6D8', borderRadius: 14, padding: 4, marginTop: 18 },
  segment: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: Colors.green500 },
  segmentLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.textMuted },
  segmentLabelActive: { color: Colors.textOnDark },
  list: { gap: 10, marginTop: 16 },
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
  iconWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E9F1EC', alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.success700 },
  name: { fontSize: 15, fontWeight: '700' },
  timings: { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },
  description: { fontSize: 12, color: Colors.textFaint, marginTop: 3 },
  bookingCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.card - 4, padding: 15 },
  bookingTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookingAmenity: { fontSize: 14.5, fontWeight: '700' },
  bookingSlot: { fontSize: 12.5, color: Colors.textMuted, marginTop: 6 },
});

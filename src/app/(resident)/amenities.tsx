import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatAmenityTimings, formatBookingSlot, getBookingStatusStyle, getErrorMessage, getInitials } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useAmenities, useAmenityRealtimeSync, useCancelBooking, useFlatBookings } from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type Tab = 'Browse' | 'My Bookings';

export default function ResidentAmenitiesScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'bookings' ? 'My Bookings' : 'Browse');
  const [screenOpenedAt] = useState(Date.now);
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const amenitiesQuery = useAmenities(societyId);
  const bookingsQuery = useFlatBookings(profileQuery.data?.flat_id, societyId);
  const cancelBooking = useCancelBooking();
  useAmenityRealtimeSync(societyId);

  const amenities = amenitiesQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];

  async function handleCancel(bookingId: string) {
    if (!societyId) return;
    try {
      await cancelBooking.mutateAsync({ id: bookingId, societyId });
      showToast('Booking cancelled');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not cancel this booking'));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Amenities</Text>
      </View>

      <View style={styles.segmented}>
        {(['Browse', 'My Bookings'] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => setTab(item)}
            style={[styles.segment, tab === item && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}>
            <Text style={[styles.segmentLabel, tab === item && styles.segmentLabelActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'Browse' && (
        <View style={styles.list}>
          <AsyncState
            isLoading={profileQuery.isLoading || amenitiesQuery.isLoading}
            isError={profileQuery.isError || amenitiesQuery.isError}
            onRetry={() => {
              profileQuery.refetch();
              amenitiesQuery.refetch();
            }}
            isEmpty={amenities.length === 0}
            emptyMessage="No amenities available yet."
          />
          {amenities.map((amenity) => (
            <Pressable
              key={amenity.id}
              style={styles.card}
              onPress={() => router.push(`/(resident)/book-amenity/${amenity.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Book ${amenity.name}`}>
              <View style={styles.iconWrap}>
                <Text style={styles.iconLabel}>{getInitials(amenity.name)}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.name}>{amenity.name}</Text>
                <Text style={styles.timings}>{formatAmenityTimings(amenity.open_time, amenity.close_time)}</Text>
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
            isLoading={profileQuery.isLoading || bookingsQuery.isLoading}
            isError={profileQuery.isError || bookingsQuery.isError}
            onRetry={() => {
              profileQuery.refetch();
              bookingsQuery.refetch();
            }}
            isEmpty={bookings.length === 0}
            emptyMessage="No bookings yet. Browse amenities to request a slot."
          />
          {bookings.map((booking) => {
            const statusStyle = getBookingStatusStyle(booking.status);
            const canCancel = booking.status !== 'CANCELLED' && new Date(booking.slot_start).getTime() > screenOpenedAt;
            return (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingTopRow}>
                  <Text style={styles.bookingAmenity}>{booking.amenity?.name ?? 'Amenity'}</Text>
                  <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
                </View>
                <Text style={styles.bookingSlot}>{formatBookingSlot(booking.slot_start, booking.slot_end)}</Text>
                {canCancel && (
                  <Pressable
                    style={styles.cancelButton}
                    onPress={() => void handleCancel(booking.id)}
                    disabled={cancelBooking.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel booking">
                    {cancelBooking.isPending && <ActivityIndicator size="small" color={Colors.danger700} />}
                    <Text style={styles.cancelButtonLabel}>Cancel booking</Text>
                  </Pressable>
                )}
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
  segment: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
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
  bookingTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bookingAmenity: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  bookingSlot: { fontSize: 12.5, color: Colors.textMuted, marginTop: 6 },
  cancelButton: {
    minHeight: 42,
    marginTop: 12,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: '#E8C6BF',
    backgroundColor: '#FFF8F6',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  cancelButtonLabel: { fontSize: 13, fontWeight: '700', color: Colors.danger700 },
});

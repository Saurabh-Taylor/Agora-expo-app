import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getInitials } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useAmenityBookings, useAmenityDetail, useDecideBooking } from '@/features/amenities/api';
import { showToast } from '@/stores/toast-store';

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

export default function AdminAmenityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const amenityQuery = useAmenityDetail(id);
  const bookingsQuery = useAmenityBookings(id);
  const decideBooking = useDecideBooking();

  const amenity = amenityQuery.data;
  const bookings = bookingsQuery.data ?? [];
  const pending = bookings.filter((b) => b.status === 'PENDING');

  async function handleDecide(bookingId: string, decision: 'CONFIRMED' | 'CANCELLED', bookedBy: string, slotStart: string) {
    if (!amenity) return;
    try {
      await decideBooking.mutateAsync({ id: bookingId, decision, bookedBy, amenityName: amenity.name, slotStart });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update this booking');
    }
  }

  if (!amenity) {
    return (
      <View style={styles.root}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={amenityQuery.isLoading}
          isError={amenityQuery.isError}
          onRetry={() => amenityQuery.refetch()}
          isEmpty={!amenityQuery.isLoading && !amenityQuery.isError}
          emptyMessage="This amenity isn't available."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackArrowButton onPress={() => router.back()} />

      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconLabel}>{getInitials(amenity.name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{amenity.name}</Text>
          <Text style={styles.timings}>{formatTimings(amenity.open_time, amenity.close_time)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Booking requests</Text>
      <View style={styles.list}>
        <AsyncState
          isLoading={bookingsQuery.isLoading}
          isError={bookingsQuery.isError}
          onRetry={() => bookingsQuery.refetch()}
          isEmpty={pending.length === 0}
          emptyMessage="No pending requests"
        />
        {pending.map((booking) => (
          <View key={booking.id} style={styles.bookingCard}>
            <View style={styles.bookingTopRow}>
              <View style={styles.bookingAvatar}>
                <Text style={styles.bookingAvatarLabel}>{getInitials(booking.booked_by_profile?.full_name ?? '?')}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.bookingName}>{booking.booked_by_profile?.full_name ?? 'Resident'}</Text>
                <Text style={styles.bookingSlot}>
                  {booking.flat ? `${booking.flat.tower ? `${booking.flat.tower.code}-` : ''}${booking.flat.number} · ` : ''}
                  {formatSlot(booking.slot_start, booking.slot_end)}
                </Text>
              </View>
            </View>
            <View style={styles.bookingActions}>
              <Pressable
                style={styles.declineButton}
                onPress={() => handleDecide(booking.id, 'CANCELLED', booking.booked_by, booking.slot_start)}
                disabled={decideBooking.isPending}>
                <Text style={styles.declineLabel}>Decline</Text>
              </Pressable>
              <Pressable
                style={styles.approveButton}
                onPress={() => handleDecide(booking.id, 'CONFIRMED', booking.booked_by, booking.slot_start)}
                disabled={decideBooking.isPending}>
                <Text style={styles.approveLabel}>Approve</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 16 },
  iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#E9F1EC', alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.success700 },
  name: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  timings: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: 16, marginTop: 22 },
  list: { gap: 10, marginTop: 12 },
  bookingCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.card - 4, padding: 13 },
  bookingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bookingAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F6ECD8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingAvatarLabel: { fontFamily: FontFamily.headingBold, fontSize: 14, color: '#9A6B14' },
  bookingName: { fontSize: 14, fontWeight: '600' },
  bookingSlot: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  bookingActions: { flexDirection: 'row', gap: 9, marginTop: 11 },
  declineButton: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E7E4' },
  declineLabel: { fontSize: 13, fontWeight: '700', color: Colors.danger700 },
  approveButton: { flex: 1.2, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.success600 },
  approveLabel: { fontSize: 13, fontWeight: '700', color: Colors.textOnDark },
});

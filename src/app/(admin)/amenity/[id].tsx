import { router, type Href, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  formatAmenityTimings,
  formatBookingSlot,
  getBookingStatusStyle,
  getErrorMessage,
  getInitials,
} from '@/commonFunctions';
import { AmenityGallery } from '@/components/amenity-gallery';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import {
  useAmenityBookings,
  useAmenityDetail,
  useAmenityRealtimeSync,
  useDecideBooking,
  useSetAmenityActive,
} from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function AdminAmenityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const amenityQuery = useAmenityDetail(id, societyId);
  const bookingsQuery = useAmenityBookings(id, societyId);
  const decideBooking = useDecideBooking();
  const setAmenityActive = useSetAmenityActive();
  useAmenityRealtimeSync(societyId);

  const amenity = amenityQuery.data;
  const bookings = bookingsQuery.data ?? [];
  const pending = bookings.filter((booking) => booking.status === 'PENDING');
  const decided = bookings.filter((booking) => booking.status !== 'PENDING');

  async function handleDecide(bookingId: string, decision: 'CONFIRMED' | 'CANCELLED') {
    if (!societyId) return;
    try {
      await decideBooking.mutateAsync({ id: bookingId, decision, societyId });
      showToast(decision === 'CONFIRMED' ? 'Booking confirmed' : 'Booking declined');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update this booking'));
    }
  }

  async function changeAvailability(isActive: boolean) {
    if (!amenity || !societyId) return;
    try {
      await setAmenityActive.mutateAsync({ id: amenity.id, societyId, isActive });
      showToast(isActive ? 'Amenity reactivated' : 'Amenity archived');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not change amenity availability'));
    }
  }

  function confirmArchive() {
    Alert.alert(
      'Archive amenity?',
      'Residents will no longer be able to browse or request this amenity. Existing confirmed bookings remain visible.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: () => void changeAvailability(false) },
      ],
    );
  }

  if (!amenity) {
    return (
      <View style={styles.emptyRoot}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={profileQuery.isLoading || amenityQuery.isLoading}
          isError={profileQuery.isError || amenityQuery.isError}
          onRetry={() => {
            profileQuery.refetch();
            amenityQuery.refetch();
          }}
          isEmpty={!profileQuery.isLoading && !amenityQuery.isLoading && !profileQuery.isError && !amenityQuery.isError}
          emptyMessage="This amenity isn't available."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <BackArrowButton onPress={() => router.back()} />
      <AmenityGallery imagePaths={amenity.image_paths} societyId={societyId} />

      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconLabel}>{getInitials(amenity.name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{amenity.name}</Text>
          <Text style={styles.timings}>{formatAmenityTimings(amenity.open_time, amenity.close_time)}</Text>
          <Text style={amenity.is_active ? styles.activeLabel : styles.archivedLabel}>
            {amenity.is_active ? 'Available to residents' : 'Archived'}
          </Text>
        </View>
      </View>

      <View style={styles.managementRow}>
        <Pressable
          style={styles.editButton}
          onPress={() => router.push(`/(admin)/edit-amenity/${amenity.id}` as Href)}
          accessibilityRole="button"
          accessibilityLabel="Edit amenity">
          <Text style={styles.editButtonLabel}>Edit details</Text>
        </Pressable>
        {amenity.is_active ? (
          <Pressable
            style={styles.archiveButton}
            onPress={confirmArchive}
            disabled={setAmenityActive.isPending}
            accessibilityRole="button"
            accessibilityLabel="Archive amenity">
            <Text style={styles.archiveButtonLabel}>Archive</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.reactivateButton}
            onPress={() => void changeAvailability(true)}
            disabled={setAmenityActive.isPending}
            accessibilityRole="button"
            accessibilityLabel="Reactivate amenity">
            {setAmenityActive.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
            <Text style={styles.reactivateButtonLabel}>Reactivate</Text>
          </Pressable>
        )}
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
                  {formatBookingSlot(booking.slot_start, booking.slot_end)}
                </Text>
              </View>
            </View>
            <View style={styles.bookingActions}>
              <Pressable
                style={styles.declineButton}
                onPress={() => void handleDecide(booking.id, 'CANCELLED')}
                disabled={decideBooking.isPending}
                accessibilityRole="button"
                accessibilityLabel="Decline booking">
                <Text style={styles.declineLabel}>Decline</Text>
              </Pressable>
              <Pressable
                style={styles.approveButton}
                onPress={() => void handleDecide(booking.id, 'CONFIRMED')}
                disabled={decideBooking.isPending}
                accessibilityRole="button"
                accessibilityLabel="Approve booking">
                {decideBooking.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
                <Text style={styles.approveLabel}>Approve</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Booking history</Text>
      <View style={styles.list}>
        <AsyncState isLoading={false} isError={false} isEmpty={decided.length === 0} emptyMessage="No decided bookings yet" />
        {decided.map((booking) => {
          const statusStyle = getBookingStatusStyle(booking.status);
          return (
            <View key={booking.id} style={styles.historyCard}>
              <View style={styles.historyTopRow}>
                <Text style={styles.bookingName}>{booking.booked_by_profile?.full_name ?? 'Resident'}</Text>
                <StatusPill label={statusStyle.label} color={statusStyle.color} backgroundColor={statusStyle.bg} />
              </View>
              <Text style={styles.bookingSlot}>{formatBookingSlot(booking.slot_start, booking.slot_end)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  emptyRoot: { flex: 1, backgroundColor: Colors.adminCanvas, paddingHorizontal: 20 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 16 },
  iconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#E9F1EC', alignItems: 'center', justifyContent: 'center' },
  iconLabel: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.success700 },
  name: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  timings: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  activeLabel: { fontSize: 11.5, color: Colors.success700, marginTop: 3, fontWeight: '700' },
  archivedLabel: { fontSize: 11.5, color: Colors.textFaint, marginTop: 3, fontWeight: '700' },
  managementRow: { flexDirection: 'row', gap: 9, marginTop: 18 },
  editButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  editButtonLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary },
  archiveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: '#E8C6BF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8F6',
  },
  archiveButtonLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.danger700 },
  reactivateButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success600,
    flexDirection: 'row',
    gap: 7,
  },
  reactivateButtonLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.textOnDark },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: 16, marginTop: 24 },
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
  bookingSlot: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  bookingActions: { flexDirection: 'row', gap: 9, marginTop: 11 },
  declineButton: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E7E4' },
  declineLabel: { fontSize: 13, fontWeight: '700', color: Colors.danger700 },
  approveButton: { flex: 1.2, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.success600, flexDirection: 'row', gap: 6 },
  approveLabel: { fontSize: 13, fontWeight: '700', color: Colors.textOnDark },
  historyCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.card - 4, padding: 13 },
  historyTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});

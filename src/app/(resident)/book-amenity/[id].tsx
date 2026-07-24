import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  buildAmenityDateOptions,
  formatDateForDatabase,
  getAmenitySlotStatusStyle,
  getErrorMessage,
} from '@/commonFunctions';
import { AmenityGallery } from '@/components/amenity-gallery';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import {
  useAmenityDetail,
  useAmenitySlotAvailability,
  useCreateBooking,
} from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function BookAmenityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const amenityQuery = useAmenityDetail(id, societyId);
  const createBooking = useCreateBooking();
  const amenity = amenityQuery.data;

  const [dateIndex, setDateIndex] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const dateOptions = useMemo(
    () => buildAmenityDateOptions(amenity?.advance_booking_days ?? 0),
    [amenity?.advance_booking_days],
  );
  const selectedDate = dateOptions[dateIndex] ?? dateOptions[0];
  const bookingDate = selectedDate ? formatDateForDatabase(selectedDate) : undefined;
  const availabilityQuery = useAmenitySlotAvailability(amenity?.id, societyId, bookingDate);
  const slots = availabilityQuery.data ?? [];
  const selectedSlot = slots.find((slot) => slot.slot_id === selectedSlotId);
  const canRequest =
    selectedSlot?.status === 'AVAILABLE'
    && !!profileQuery.data?.flat_id
    && !availabilityQuery.isFetching;

  async function handleRequest() {
    if (!canRequest || !selectedSlot || !profileQuery.data?.flat_id || !amenity || !bookingDate) return;
    try {
      const booking = await createBooking.mutateAsync({
        societyId: profileQuery.data.society_id,
        flatId: profileQuery.data.flat_id,
        amenityId: amenity.id,
        slotId: selectedSlot.slot_id,
        bookingDate,
      });
      showToast(
        booking.status === 'CONFIRMED'
          ? 'Booking confirmed'
          : 'Booking requested — the admin will review it shortly',
      );
      router.replace({ pathname: '/(resident)/amenities', params: { tab: 'bookings' } });
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not book this slot'));
      await availabilityQuery.refetch();
      setSelectedSlotId(null);
    }
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
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>{amenity.name}</Text>
      </View>
      <AmenityGallery imagePaths={amenity.image_paths} societyId={societyId} />
      {!!amenity.description && <Text style={styles.description}>{amenity.description}</Text>}

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Booking</Text>
          <Text style={styles.summaryValue}>
            {amenity.booking_type === 'SHARED'
              ? `Shared · ${amenity.max_bookings_per_slot} per slot`
              : 'Exclusive slot'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Confirmation</Text>
          <Text style={styles.summaryValue}>
            {amenity.requires_admin_approval ? 'Admin approval' : 'Instant'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Daily limit</Text>
          <Text style={styles.summaryValue}>{amenity.max_bookings_per_resident_per_day}</Text>
        </View>
      </View>

      {!!amenity.rules_and_regulations && (
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>Before you book</Text>
          <Text style={styles.rulesText}>{amenity.rules_and_regulations}</Text>
        </View>
      )}

      <Text style={styles.label}>DATE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
        {dateOptions.map((date, index) => {
          const active = dateIndex === index;
          return (
            <Pressable
              key={formatDateForDatabase(date)}
              onPress={() => {
                setDateIndex(index);
                setSelectedSlotId(null);
              }}
              style={[styles.dateChip, active ? styles.chipActive : styles.chipInactive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}>
              <Text style={[styles.dateChipDay, active ? styles.chipLabelActive : styles.chipLabelInactive]}>
                {date.toLocaleDateString([], { weekday: 'short' })}
              </Text>
              <Text style={[styles.dateChipNum, active ? styles.chipLabelActive : styles.chipLabelInactive]}>
                {date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>SLOTS</Text>
      <AsyncState
        isLoading={availabilityQuery.isLoading}
        isError={availabilityQuery.isError}
        onRetry={() => availabilityQuery.refetch()}
        isEmpty={!availabilityQuery.isLoading && !availabilityQuery.isError && slots.length === 0}
        emptyMessage="No booking slots are configured for this amenity."
      />
      <View style={styles.slotList}>
        {slots.map((slot) => {
          const active = selectedSlotId === slot.slot_id;
          const bookable = slot.status === 'AVAILABLE';
          const statusStyle = getAmenitySlotStatusStyle(slot.status);
          return (
            <Pressable
              key={slot.slot_id}
              onPress={() => bookable && setSelectedSlotId(slot.slot_id)}
              disabled={!bookable}
              style={[styles.slotCard, active && styles.slotCardActive, !bookable && styles.slotCardDisabled]}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: !bookable }}>
              <View style={styles.flex}>
                <Text style={[styles.slotTime, active && styles.slotTimeActive]}>
                  {new Date(slot.slot_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  {' – '}
                  {new Date(slot.slot_end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
                {amenity.booking_type === 'SHARED' && bookable && (
                  <Text style={[styles.capacityText, active && styles.capacityTextActive]}>
                    {slot.remaining_capacity} remaining
                  </Text>
                )}
              </View>
              <StatusPill
                label={statusStyle.label}
                color={active ? Colors.textOnDark : statusStyle.color}
                backgroundColor={active ? 'rgba(255,255,255,0.16)' : statusStyle.bg}
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.requestButton, !canRequest && styles.requestButtonDisabled]}
        onPress={handleRequest}
        disabled={!canRequest || createBooking.isPending}
        accessibilityRole="button"
        accessibilityLabel="Confirm amenity booking">
        {createBooking.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
        <Text style={[styles.requestLabel, !canRequest && styles.requestLabelDisabled]}>
          {amenity.requires_admin_approval ? 'Request booking' : 'Confirm booking'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  emptyRoot: { flex: 1, backgroundColor: Colors.canvas, paddingTop: 66, paddingHorizontal: 20 },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 21, flexShrink: 1 },
  description: { fontSize: 13.5, color: Colors.textMuted, marginTop: 10, lineHeight: 20 },
  summaryCard: { marginTop: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, gap: 9 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summaryLabel: { fontSize: 12, color: Colors.textMuted },
  summaryValue: { flexShrink: 1, textAlign: 'right', fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
  rulesCard: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: '#F6ECD8' },
  rulesTitle: { fontSize: 13, fontWeight: '800', color: '#7A5717' },
  rulesText: { marginTop: 5, fontSize: 12, lineHeight: 18, color: Colors.textMutedAlt },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  dateRow: { gap: 8, paddingTop: 10, paddingRight: 10 },
  dateChip: { width: 52, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  dateChipDay: { fontSize: 11, fontWeight: '600' },
  dateChipNum: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { color: Colors.textOnDark },
  chipLabelInactive: { color: Colors.textMutedAlt },
  slotList: { gap: 9, marginTop: 10 },
  slotCard: { minHeight: 66, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  slotCardActive: { borderColor: Colors.green500, backgroundColor: Colors.green500 },
  slotCardDisabled: { opacity: 0.66 },
  slotTime: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  slotTimeActive: { color: Colors.textOnDark },
  capacityText: { marginTop: 3, fontSize: 11, color: Colors.textMuted },
  capacityTextActive: { color: '#D9E7DF' },
  requestButton: { marginTop: 26, minHeight: 54, borderRadius: Radius.card - 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, backgroundColor: Colors.green500 },
  requestButtonDisabled: { backgroundColor: '#DDD8C8' },
  requestLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.textOnDark },
  requestLabelDisabled: { color: '#9B9682' },
});

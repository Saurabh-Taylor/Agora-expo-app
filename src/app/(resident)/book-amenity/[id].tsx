import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useAmenityDetail, useAmenityUnavailableSlots, useCreateBooking } from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const SLOT_HOURS = 2;
const DAYS_AHEAD = 7;

function buildDateOptions() {
  return Array.from({ length: DAYS_AHEAD }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return date;
  });
}

function buildSlotOptions(date: Date, openTime: string | null, closeTime: string | null) {
  const [openHour] = (openTime ?? '07:00').split(':').map(Number);
  const [closeHour] = (closeTime ?? '21:00').split(':').map(Number);
  const slots: { start: Date; end: Date }[] = [];
  for (let hour = openHour; hour + SLOT_HOURS <= closeHour; hour += SLOT_HOURS) {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(date);
    end.setHours(hour + SLOT_HOURS, 0, 0, 0);
    if (start.getTime() > Date.now()) slots.push({ start, end });
  }
  return slots;
}

export default function BookAmenityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const amenityQuery = useAmenityDetail(id, societyId);
  const createBooking = useCreateBooking();

  const [dateIndex, setDateIndex] = useState(0);
  const [slotIndex, setSlotIndex] = useState<number | null>(null);

  const dateOptions = useMemo(() => buildDateOptions(), []);
  const selectedDate = dateOptions[dateIndex];
  const rangeStart = selectedDate?.toISOString();
  const rangeEnd = useMemo(() => {
    if (!selectedDate) return undefined;
    const end = new Date(selectedDate);
    end.setDate(end.getDate() + 1);
    return end.toISOString();
  }, [selectedDate]);
  const amenity = amenityQuery.data;
  const availabilityQuery = useAmenityUnavailableSlots(amenity?.id, societyId, rangeStart, rangeEnd);

  const slotOptions = useMemo(() => {
    if (!amenity) return [];
    const candidates = buildSlotOptions(selectedDate, amenity.open_time, amenity.close_time);
    const unavailable = availabilityQuery.data ?? [];
    return candidates.filter(
      (slot) =>
        !unavailable.some(
          (blocked) =>
            new Date(blocked.slot_start).getTime() < slot.end.getTime() &&
            new Date(blocked.slot_end).getTime() > slot.start.getTime(),
        ),
    );
  }, [amenity, availabilityQuery.data, selectedDate]);

  const selectedSlot = slotIndex !== null ? slotOptions[slotIndex] : undefined;
  const canRequest =
    !!selectedSlot && !!profileQuery.data?.flat_id && !availabilityQuery.isLoading && !availabilityQuery.isError;

  async function handleRequest() {
    if (!canRequest || !selectedSlot || !profileQuery.data?.flat_id || !amenity) return;
    try {
      await createBooking.mutateAsync({
        societyId: profileQuery.data.society_id,
        flatId: profileQuery.data.flat_id,
        amenityId: amenity.id,
        slotStart: selectedSlot.start.toISOString(),
        slotEnd: selectedSlot.end.toISOString(),
      });
      showToast('Booking requested — the admin will confirm it shortly');
      router.replace({ pathname: '/(resident)/amenities', params: { tab: 'bookings' } });
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not request this booking'));
      availabilityQuery.refetch();
      setSlotIndex(null);
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
      {!!amenity.description && <Text style={styles.description}>{amenity.description}</Text>}

      <Text style={styles.label}>DATE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
        {dateOptions.map((date, index) => {
          const active = dateIndex === index;
          return (
            <Pressable
              key={date.toISOString()}
              onPress={() => {
                setDateIndex(index);
                setSlotIndex(null);
              }}
              style={[styles.dateChip, active ? styles.chipActive : styles.chipInactive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}>
              <Text style={[styles.dateChipDay, active ? styles.chipLabelActive : styles.chipLabelInactive]}>
                {date.toLocaleDateString([], { weekday: 'short' })}
              </Text>
              <Text style={[styles.dateChipNum, active ? styles.chipLabelActive : styles.chipLabelInactive]}>{date.getDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>AVAILABLE SLOTS</Text>
      <AsyncState
        isLoading={availabilityQuery.isLoading}
        isError={availabilityQuery.isError}
        onRetry={() => availabilityQuery.refetch()}
      />
      {!availabilityQuery.isLoading && !availabilityQuery.isError && slotOptions.length === 0 ? (
        <Text style={styles.noSlots}>No slots left on this day — try another date.</Text>
      ) : (
        <View style={styles.chipsRowWrap}>
          {slotOptions.map((slot, index) => {
            const active = slotIndex === index;
            return (
              <Pressable
                key={slot.start.toISOString()}
                onPress={() => setSlotIndex(index)}
                style={[styles.slotChip, active ? styles.chipActive : styles.chipInactive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}>
                <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>
                  {slot.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                  {slot.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        style={[styles.requestButton, { backgroundColor: canRequest ? Colors.green500 : '#DDD8C8' }]}
        onPress={handleRequest}
        disabled={!canRequest || createBooking.isPending}
        accessibilityRole="button"
        accessibilityLabel="Request amenity booking">
        {createBooking.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.requestLabel, { color: canRequest ? Colors.textOnDark : '#9B9682' }]}>Request booking</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  emptyRoot: { flex: 1, backgroundColor: Colors.canvas, paddingTop: 66, paddingHorizontal: 20 },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 21, flexShrink: 1 },
  description: { fontSize: 13.5, color: Colors.textMuted, marginTop: 10, lineHeight: 20 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  dateRow: { gap: 8, paddingTop: 10, paddingRight: 10 },
  dateChip: { width: 52, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  dateChipDay: { fontSize: 11, fontWeight: '600' },
  dateChipNum: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  chipsRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  slotChip: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { color: Colors.textOnDark },
  chipLabelInactive: { color: '#3E4A40' },
  noSlots: { fontSize: 13.5, color: Colors.textMuted, marginTop: 10 },
  requestButton: {
    marginTop: 30,
    minHeight: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  requestLabel: { fontSize: 15.5, fontWeight: '700' },
});

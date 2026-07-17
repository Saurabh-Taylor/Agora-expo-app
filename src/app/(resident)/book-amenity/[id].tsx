import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useAmenityDetail, useCreateBooking } from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const SLOT_HOURS = 2;
const DAYS_AHEAD = 7;

function buildDateOptions() {
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + i);
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
  const amenityQuery = useAmenityDetail(id);
  const createBooking = useCreateBooking();

  const [dateIndex, setDateIndex] = useState(0);
  const [slotIndex, setSlotIndex] = useState<number | null>(null);

  const dateOptions = useMemo(() => buildDateOptions(), []);
  const amenity = amenityQuery.data;
  const slotOptions = useMemo(
    () => (amenity ? buildSlotOptions(dateOptions[dateIndex], amenity.open_time, amenity.close_time) : []),
    [amenity, dateOptions, dateIndex],
  );

  const selectedSlot = slotIndex !== null ? slotOptions[slotIndex] : undefined;
  const canRequest = !!selectedSlot && !!profileQuery.data?.flat_id;

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
      router.replace('/(resident)/amenities');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not request this booking');
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
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>{amenity.name}</Text>
      </View>
      {!!amenity.description && <Text style={styles.description}>{amenity.description}</Text>}

      <Text style={styles.label}>DATE</Text>
      <View style={styles.chipsRow}>
        {dateOptions.map((date, index) => {
          const active = dateIndex === index;
          return (
            <Pressable
              key={date.toISOString()}
              onPress={() => {
                setDateIndex(index);
                setSlotIndex(null);
              }}
              style={[styles.dateChip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={[styles.dateChipDay, active ? styles.chipLabelActive : styles.chipLabelInactive]}>
                {date.toLocaleDateString([], { weekday: 'short' })}
              </Text>
              <Text style={[styles.dateChipNum, active ? styles.chipLabelActive : styles.chipLabelInactive]}>{date.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>AVAILABLE SLOTS</Text>
      {slotOptions.length === 0 ? (
        <Text style={styles.noSlots}>No slots left on this day — try another date.</Text>
      ) : (
        <View style={styles.chipsRowWrap}>
          {slotOptions.map((slot, index) => {
            const active = slotIndex === index;
            return (
              <Pressable
                key={slot.start.toISOString()}
                onPress={() => setSlotIndex(index)}
                style={[styles.slotChip, active ? styles.chipActive : styles.chipInactive]}>
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
        disabled={!canRequest || createBooking.isPending}>
        {createBooking.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.requestLabel, { color: canRequest ? Colors.textOnDark : '#9B9682' }]}>Request booking</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 21 },
  description: { fontSize: 13.5, color: Colors.textMuted, marginTop: 10, lineHeight: 20 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chipsRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  dateChip: { width: 52, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  dateChipDay: { fontSize: 11, fontWeight: '600' },
  dateChipNum: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  slotChip: { paddingVertical: 11, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { color: Colors.textOnDark },
  chipLabelInactive: { color: '#3E4A40' },
  noSlots: { fontSize: 13.5, color: Colors.textMuted, marginTop: 10 },
  requestButton: {
    marginTop: 30,
    height: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  requestLabel: { fontSize: 15.5, fontWeight: '700' },
});

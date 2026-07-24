import { Fragment, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import type { ParkingSlotWithAssignment } from '@/features/parking/api';

type ParkingLayoutGridProps = {
  slots: ParkingSlotWithAssignment[];
  onSlotPress?: (slot: ParkingSlotWithAssignment) => void;
};

export function ParkingLayoutGrid({ slots, onSlotPress }: ParkingLayoutGridProps) {
  const groups = useMemo(() => {
    const grouped = new Map<string, ParkingSlotWithAssignment[]>();
    slots.forEach((slot) => {
      const key = `${slot.zone} · ${slot.level_label}`;
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    });
    return [...grouped.entries()];
  }, [slots]);

  return (
    <View>
      <View style={styles.legend} accessibilityLabel="Parking map legend">
        <View style={[styles.legendDot, styles.vacantDot]} />
        <Text style={styles.legendLabel}>Vacant</Text>
        <View style={[styles.legendDot, styles.occupiedDot]} />
        <Text style={styles.legendLabel}>Occupied</Text>
        <View style={[styles.legendDot, styles.inactiveDot]} />
        <Text style={styles.legendLabel}>Inactive</Text>
      </View>

      {groups.map(([label, groupedSlots]) => (
        <Fragment key={label}>
          <Text style={styles.groupLabel}>{label}</Text>
          <View style={styles.grid}>
            {groupedSlots.map((slot) => {
              const occupied = !!slot.assignment;
              const stateLabel = slot.is_active ? (occupied ? 'Occupied' : 'Vacant') : 'Inactive';
              return (
                <Pressable
                  key={slot.id}
                  disabled={!onSlotPress}
                  onPress={() => onSlotPress?.(slot)}
                  accessibilityRole={onSlotPress ? 'button' : 'text'}
                  accessibilityLabel={`${slot.code}, ${stateLabel}, ${slot.slot_type} slot`}
                  style={({ pressed }) => [
                    styles.slot,
                    !slot.is_active ? styles.inactiveSlot : occupied ? styles.occupiedSlot : styles.vacantSlot,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.slotCode}>{slot.code}</Text>
                  <Text style={styles.slotType}>{slot.slot_type}</Text>
                  <Text style={styles.slotState}>{stateLabel}</Text>
                  {slot.assignment?.vehicle && (
                    <Text style={styles.registration} numberOfLines={1}>
                      {slot.assignment.vehicle.registration_number}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 4, marginLeft: 4 },
  vacantDot: { backgroundColor: '#BEE6CB', borderWidth: 1, borderColor: Colors.success700 },
  occupiedDot: { backgroundColor: '#F5C7C2', borderWidth: 1, borderColor: Colors.danger700 },
  inactiveDot: { backgroundColor: '#D7D3CB', borderWidth: 1, borderColor: Colors.textMuted },
  legendLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 12, color: Colors.textMuted },
  groupLabel: {
    marginTop: 18,
    marginBottom: 9,
    fontFamily: FontFamily.headingBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  slot: {
    width: 100,
    minHeight: 104,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  vacantSlot: { backgroundColor: '#E9F7EE', borderColor: Colors.success700 },
  occupiedSlot: { backgroundColor: '#FCEBE8', borderColor: Colors.danger700 },
  inactiveSlot: { backgroundColor: '#EEECE7', borderColor: Colors.textFaint },
  slotCode: { fontFamily: FontFamily.headingBold, fontSize: 16, color: Colors.textPrimary },
  slotType: { marginTop: 3, fontFamily: FontFamily.bodyBold, fontSize: 10, color: Colors.textMuted },
  slotState: { marginTop: 6, fontFamily: FontFamily.bodyBold, fontSize: 11.5, color: Colors.textPrimary },
  registration: { marginTop: 3, fontFamily: FontFamily.bodyMedium, fontSize: 10.5, color: Colors.textMuted },
  pressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
});

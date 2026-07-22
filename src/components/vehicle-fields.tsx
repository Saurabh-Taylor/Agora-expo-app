import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { isVehicleDetailsValid, normalizeVehicleNumber } from '@/commonFunctions';
import {
  Colors,
  Radius,
  VisitorVehicleTypeOptions,
  type VisitorVehicleType,
} from '@/constants/commonConstants';

type VehicleFieldsProps = {
  vehicleType: VisitorVehicleType | null;
  vehicleNumber: string;
  onTypeChange: (value: VisitorVehicleType | null) => void;
  onNumberChange: (value: string) => void;
};

export function VehicleFields({
  vehicleType,
  vehicleNumber,
  onTypeChange,
  onNumberChange,
}: VehicleFieldsProps) {
  const hasInvalidNumber = !!vehicleType && !!vehicleNumber && !isVehicleDetailsValid(vehicleNumber, vehicleType);

  function selectType(value: VisitorVehicleType | null) {
    onTypeChange(value);
    if (!value) onNumberChange('');
  }

  return (
    <View>
      <Text style={styles.label}>ARRIVING BY (OPTIONAL)</Text>
      <View style={styles.chipsRow}>
        <VehicleChip label="No vehicle" active={!vehicleType} onPress={() => selectType(null)} />
        {VisitorVehicleTypeOptions.map((option) => (
          <VehicleChip
            key={option.value}
            label={option.label}
            active={vehicleType === option.value}
            onPress={() => selectType(option.value)}
          />
        ))}
      </View>

      {!!vehicleType && (
        <>
          <Text style={styles.numberLabel}>VEHICLE NUMBER</Text>
          <TextInput
            value={vehicleNumber}
            onChangeText={(value) => onNumberChange(value.toUpperCase())}
            onBlur={() => onNumberChange(normalizeVehicleNumber(vehicleNumber))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            placeholder="e.g. MH 12 AB 1234"
            placeholderTextColor={Colors.textFaint}
            style={[styles.input, hasInvalidNumber && styles.inputInvalid]}
          />
          <Text style={[styles.helper, hasInvalidNumber && styles.error]}>
            {hasInvalidNumber ? 'Enter a valid vehicle number.' : 'Letters, numbers, spaces and hyphens are accepted.'}
          </Text>
        </>
      )}
    </View>
  );
}

function VehicleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { minHeight: 42, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 13, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 13, fontWeight: '600', color: '#3E4A40' },
  numberLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 16 },
  input: {
    marginTop: 8,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputInvalid: { borderColor: Colors.danger500 },
  helper: { marginTop: 6, fontSize: 12, color: Colors.textMuted },
  error: { color: Colors.danger500 },
});

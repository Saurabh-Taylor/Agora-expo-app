import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius } from '@/constants/commonConstants';

export function FilterChip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.root, selected && styles.selected, disabled && styles.disabled]}>
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
  },
  selected: {
    borderColor: Colors.green500,
    backgroundColor: Colors.green500,
  },
  disabled: { opacity: 0.45 },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  selectedLabel: { color: Colors.textOnDark },
});

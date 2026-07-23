import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/commonConstants';

export type AdminTabOption<T extends string> = {
  value: T;
  label: string;
};

type AdminTabSelectorProps<T extends string> = {
  options: readonly AdminTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

export function AdminTabSelector<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: AdminTabSelectorProps<T>) {
  return (
    <ScrollView
      horizontal
      style={styles.card}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <Pressable
            key={option.value}
            style={[styles.option, isActive ? styles.optionActive : styles.optionInactive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}>
            <Text style={isActive ? styles.labelActive : styles.labelInactive}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 0,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    shadowColor: '#10261B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 3,
  },
  row: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  option: {
    minHeight: 38,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  optionActive: {
    backgroundColor: Colors.green500,
    borderColor: Colors.green500,
  },
  optionInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderAlt,
  },
  labelActive: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textOnDark,
  },
  labelInactive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3E4A40',
  },
});

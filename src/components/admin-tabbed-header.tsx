import { type DimensionValue, StyleSheet, View } from 'react-native';

import { AdminTabHeader } from '@/components/admin-tab-header';
import { AdminTabSelector, type AdminTabOption } from '@/components/admin-tab-selector';

type AdminTabbedHeaderProps<T extends string> = {
  title: string;
  subtitle: string;
  options: readonly AdminTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  containerWidth?: DimensionValue;
};

export function AdminTabbedHeader<T extends string>({
  title,
  subtitle,
  options,
  value,
  onChange,
  accessibilityLabel,
  containerWidth,
}: AdminTabbedHeaderProps<T>) {
  return (
    <>
      <AdminTabHeader title={title} subtitle={subtitle} />
      <View
        style={[
          styles.selectorWrap,
          containerWidth !== undefined
            ? { alignSelf: 'center', marginHorizontal: 0, width: containerWidth }
            : undefined,
        ]}>
        <AdminTabSelector
          options={options}
          value={value}
          onChange={onChange}
          accessibilityLabel={accessibilityLabel}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  selectorWrap: {
    marginTop: -26,
    marginHorizontal: 16,
  },
});

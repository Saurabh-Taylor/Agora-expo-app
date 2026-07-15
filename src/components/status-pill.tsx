import { StyleSheet, Text, View } from 'react-native';

import { FontFamily, Radius } from '@/constants/commonConstants';

type StatusPillProps = {
  label: string;
  color: string;
  backgroundColor: string;
};

export function StatusPill({ label, color, backgroundColor }: StatusPillProps) {
  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: Radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 9,
    alignSelf: 'flex-start',
  },
  label: { fontFamily: FontFamily.bodyBold, fontSize: 10.5 },
});

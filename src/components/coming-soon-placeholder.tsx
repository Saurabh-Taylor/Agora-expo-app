import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily } from '@/constants/commonConstants';

type ComingSoonPlaceholderProps = {
  title: string;
  subtitle: string;
};

export function ComingSoonPlaceholder({ title, subtitle }: ComingSoonPlaceholderProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  subtitle: { fontSize: 13.5, color: Colors.textMuted, textAlign: 'center' },
});

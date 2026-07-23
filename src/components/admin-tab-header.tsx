import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily } from '@/constants/commonConstants';

type AdminTabHeaderProps = {
  title: string;
  subtitle: string;
};

export function AdminTabHeader({ title, subtitle }: AdminTabHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.green400,
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 54,
  },
  title: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 26,
    color: Colors.textOnDark,
  },
  subtitle: {
    marginTop: 5,
    fontSize: 14,
    color: 'rgba(247,244,236,0.68)',
  },
});

import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors } from '@/constants/commonConstants';

export function BackArrowButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress} hitSlop={8}>
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M14.5 5l-7 7 7 7" stroke={Colors.textPrimary} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

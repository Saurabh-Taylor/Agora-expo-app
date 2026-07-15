import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useToastStore } from '@/stores/toast-store';

export function ToastHost() {
  const message = useToastStore((state) => state.message);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = message ? withTiming(1, { duration: 300 }) : withTiming(0, { duration: 150 });
  }, [message, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  if (!message) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.toast, style]}>
      <Text style={styles.label}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 104,
    zIndex: 50,
    backgroundColor: Colors.green500,
    borderRadius: Radius.card - 4,
    paddingVertical: 13,
    paddingHorizontal: 16,
    shadowColor: '#0A1911',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 8,
  },
  label: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 13.5,
    color: Colors.textOnDark,
    textAlign: 'center',
  },
});

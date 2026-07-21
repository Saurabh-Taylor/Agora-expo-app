import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AgoraLogo } from '@/components/icons/agora-logo';
import { Colors, FontFamily } from '@/constants/commonConstants';

function dotLoop(delay: number) {
  return withDelay(delay, withRepeat(withSequence(withTiming(0.35, { duration: 550 }), withTiming(1, { duration: 550 })), -1));
}

export function BrandedSplash({ accessibilityLabel = 'Opening Agora' }: { accessibilityLabel?: string }) {
  const entrance = useSharedValue(0);
  const float = useSharedValue(0);
  const dot0 = useSharedValue(1);
  const dot1 = useSharedValue(1);
  const dot2 = useSharedValue(1);

  useEffect(() => {
    entrance.value = withTiming(1, { duration: 600 });
    float.value = withRepeat(withSequence(withTiming(-6, { duration: 1500 }), withTiming(0, { duration: 1500 })), -1);
    dot0.value = dotLoop(0);
    dot1.value = dotLoop(180);
    dot2.value = dotLoop(360);

    return () => {
      cancelAnimation(entrance);
      cancelAnimation(float);
      cancelAnimation(dot0);
      cancelAnimation(dot1);
      cancelAnimation(dot2);
    };
  }, [dot0, dot1, dot2, entrance, float]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ scale: 0.5 + entrance.value * 0.5 }],
  }));
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));
  const dot0Style = useAnimatedStyle(() => ({ opacity: dot0.value }));
  const dot1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const dotStyles = [dot0Style, dot1Style, dot2Style];

  return (
    <LinearGradient
      colors={[Colors.green400, Colors.green600, Colors.green800]}
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}>
      <View style={styles.center}>
        <Animated.View style={[styles.content, entranceStyle]}>
          <Animated.View style={floatStyle}>
            <AgoraLogo size={88} />
          </Animated.View>
          <Text style={styles.wordmark}>Agora</Text>
          <Text style={styles.tagline}>ONE COMMUNITY · ONE APP</Text>
        </Animated.View>
        <View style={styles.dotsRow}>
          {dotStyles.map((style, index) => (
            <Animated.View key={index} style={[styles.dot, style]} />
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center' },
  wordmark: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 46,
    color: '#FDFBF5',
    marginTop: 18,
  },
  tagline: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 11.5,
    letterSpacing: 2.5,
    color: 'rgba(247,244,236,0.5)',
    marginTop: 10,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 74,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.gold,
  },
});

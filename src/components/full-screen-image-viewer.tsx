import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, Radius } from '@/constants/commonConstants';

type FullScreenImageViewerProps = {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
  accessibilityLabel?: string;
};

const MAX_IMAGE_ZOOM = 4;

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const viewportWidth = useSharedValue(0);
  const viewportHeight = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(MAX_IMAGE_ZOOM, Math.max(1, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      if (scale.value === 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      const maxX = (viewportWidth.value * (scale.value - 1)) / 2;
      const maxY = (viewportHeight.value * (scale.value - 1)) / 2;
      const clampedX = Math.min(maxX, Math.max(-maxX, translateX.value));
      const clampedY = Math.min(maxY, Math.max(-maxY, translateY.value));
      translateX.value = withTiming(clampedX);
      translateY.value = withTiming(clampedY);
      savedTranslateX.value = clampedX;
      savedTranslateY.value = clampedY;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value <= 1) return;

      const maxX = (viewportWidth.value * (scale.value - 1)) / 2;
      const maxY = (viewportHeight.value * (scale.value - 1)) / 2;
      translateX.value = Math.min(maxX, Math.max(-maxX, savedTranslateX.value + event.translationX));
      translateY.value = Math.min(maxY, Math.max(-maxY, savedTranslateY.value + event.translationY));
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, panGesture)}>
      <Animated.View
        style={styles.zoomViewport}
        onLayout={(event) => {
          viewportWidth.value = event.nativeEvent.layout.width;
          viewportHeight.value = event.nativeEvent.layout.height;
        }}>
        <Animated.View style={[styles.fullImage, imageStyle]}>
          <Image source={{ uri }} style={styles.fullImage} contentFit="contain" />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export function FullScreenImageViewer({
  uri,
  visible,
  onClose,
  accessibilityLabel = 'Close image viewer',
}: FullScreenImageViewerProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.viewer}>
        {visible && uri && <ZoomableImage uri={uri} />}
        <Text style={styles.gestureHint}>Pinch to zoom - Drag to move</Text>
        <Pressable
          style={styles.closeButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}>
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(5, 12, 8, 0.96)',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomViewport: { width: '100%', flex: 1, overflow: 'hidden' },
  fullImage: { width: '100%', height: '100%' },
  gestureHint: { marginTop: 14, fontSize: 12.5, color: Colors.textFaint },
  closeButton: {
    minWidth: 112,
    minHeight: 48,
    marginTop: 18,
    paddingHorizontal: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  closeLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
});

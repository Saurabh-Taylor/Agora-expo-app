import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useComplaintAttachmentUrl } from '@/features/complaints/api';

type ComplaintAttachmentProps = {
  attachmentPath: string | null;
  societyId: string;
};

const MAX_ATTACHMENT_ZOOM = 4;

function ZoomableAttachmentImage({ uri }: { uri: string }) {
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
      scale.value = Math.min(MAX_ATTACHMENT_ZOOM, Math.max(1, savedScale.value * event.scale));
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

export function ComplaintAttachment({ attachmentPath, societyId }: ComplaintAttachmentProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const attachmentQuery = useComplaintAttachmentUrl(attachmentPath, societyId);

  if (!attachmentPath) return null;

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.label}>ATTACHMENT</Text>
        {attachmentQuery.isLoading && (
          <View style={[styles.preview, styles.centered]}>
            <ActivityIndicator color={Colors.success700} />
            <Text style={styles.loadingText}>Loading attachment...</Text>
          </View>
        )}
        {attachmentQuery.isError && (
          <View style={[styles.preview, styles.centered]}>
            <Text style={styles.errorTitle}>Attachment unavailable</Text>
            <Pressable
              onPress={() => attachmentQuery.refetch()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading complaint attachment">
              <Text style={styles.retryLabel}>Try again</Text>
            </Pressable>
          </View>
        )}
        {attachmentQuery.data && (
          <Pressable
            style={styles.preview}
            onPress={() => setIsViewerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open complaint attachment">
            <Image source={{ uri: attachmentQuery.data }} style={styles.previewImage} contentFit="cover" />
            <View style={styles.previewFooter}>
              <Text style={styles.previewLabel}>View attachment</Text>
              <Text style={styles.previewHint}>Tap to enlarge</Text>
            </View>
          </Pressable>
        )}
      </View>

      <Modal
        visible={isViewerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsViewerOpen(false)}>
        <GestureHandlerRootView style={styles.viewer}>
          {isViewerOpen && attachmentQuery.data && <ZoomableAttachmentImage uri={attachmentQuery.data} />}
          <Text style={styles.gestureHint}>Pinch to zoom · Drag to move</Text>
          <Pressable
            style={styles.closeButton}
            onPress={() => setIsViewerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close attachment">
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  label: { fontSize: 10.5, letterSpacing: 1.7, fontWeight: '700', color: Colors.success700, marginBottom: 9 },
  preview: {
    overflow: 'hidden',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  centered: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 12.5, color: Colors.textMuted },
  errorTitle: { fontSize: 13.5, fontWeight: '700', color: Colors.textPrimary },
  retryLabel: { fontSize: 13, fontWeight: '700', color: Colors.success700 },
  previewImage: { width: '100%', height: 180, backgroundColor: Colors.border },
  previewFooter: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 13.5, color: Colors.textPrimary },
  previewHint: { fontSize: 11.5, color: Colors.textMuted },
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

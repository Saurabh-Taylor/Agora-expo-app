import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FullScreenImageViewer } from '@/components/full-screen-image-viewer';
import { Colors, Radius } from '@/constants/commonConstants';
import { useAmenityImageUrls } from '@/features/amenities/api';

type AmenityGalleryProps = {
  imagePaths: string[];
  societyId: string | null | undefined;
};

export function AmenityGallery({ imagePaths, societyId }: AmenityGalleryProps) {
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const urlsQuery = useAmenityImageUrls(imagePaths, societyId);
  if (imagePaths.length === 0) return null;

  if (urlsQuery.isError) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorText}>Photos could not be loaded.</Text>
        <Pressable onPress={() => urlsQuery.refetch()} accessibilityRole="button">
          <Text style={styles.retryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {imagePaths.map((path, index) => {
          const uri = urlsQuery.data?.[path];
          return (
            <Pressable
              key={path}
              style={styles.imageCard}
              onPress={() => uri && setViewerUri(uri)}
              disabled={!uri}
              accessibilityRole="button"
              accessibilityLabel={'Open amenity photo ' + (index + 1)}>
              <Image
                source={uri ? { uri } : undefined}
                style={styles.image}
                contentFit="cover"
                transition={180}
              />
              <View style={styles.viewPill}>
                <Text style={styles.viewLabel}>Tap to view</Text>
              </View>
              {imagePaths.length > 1 && (
                <View style={styles.countPill}>
                  <Text style={styles.countLabel}>{index + 1}/{imagePaths.length}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      <FullScreenImageViewer
        uri={viewerUri}
        visible={!!viewerUri}
        onClose={() => setViewerUri(null)}
        accessibilityLabel="Close amenity photo"
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingTop: 16, paddingRight: 12 },
  imageCard: { width: 280, height: 176, borderRadius: Radius.card - 2, overflow: 'hidden', backgroundColor: Colors.border },
  image: { width: '100%', height: '100%' },
  viewPill: { position: 'absolute', left: 10, bottom: 10, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(9,24,16,0.72)' },
  viewLabel: { color: Colors.textOnDark, fontSize: 10.5, fontWeight: '700' },
  countPill: { position: 'absolute', right: 10, bottom: 10, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(9,24,16,0.72)' },
  countLabel: { color: Colors.textOnDark, fontSize: 11, fontWeight: '700' },
  errorCard: { marginTop: 16, minHeight: 72, borderRadius: Radius.card - 2, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', gap: 4 },
  errorText: { color: Colors.textMuted, fontSize: 12.5 },
  retryLabel: { color: Colors.success700, fontWeight: '700', fontSize: 12.5 },
});

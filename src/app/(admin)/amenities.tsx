import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatAmenityTimings, getInitials } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import {
  useAmenities,
  useAmenityImageUrls,
  useAmenityRealtimeSync,
  usePendingBookingsCount,
} from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

function isAmenityGallerySchemaMissing(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return code === '42703' || message.includes('image_paths');
}

export default function AmenitiesScreen() {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const amenitiesQuery = useAmenities(societyId);
  const pendingQuery = usePendingBookingsCount(societyId);
  const amenities = amenitiesQuery.data ?? [];
  const coverPaths = amenities.flatMap((amenity) => amenity.image_paths.slice(0, 1));
  const coverUrlsQuery = useAmenityImageUrls(coverPaths, societyId);
  const schemaUpdateRequired = isAmenityGallerySchemaMissing(amenitiesQuery.error);
  const bookingRequestLabel = pendingQuery.isLoading
    ? 'Checking booking requests…'
    : pendingQuery.isError
      ? 'Booking request count is temporarily unavailable'
      : `${pendingQuery.data ?? 0} booking requests waiting`;
  useAmenityRealtimeSync(societyId);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Amenities</Text>
      </View>
      <Text style={styles.subtitle}>{bookingRequestLabel}</Text>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={amenities}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <AsyncState
            isLoading={profileQuery.isLoading || amenitiesQuery.isLoading}
            isError={profileQuery.isError || amenitiesQuery.isError}
            isRetrying={profileQuery.isRefetching || amenitiesQuery.isRefetching}
            loadingMessage="Loading society amenities…"
            errorTitle={schemaUpdateRequired ? 'Amenity update is not ready' : 'Amenities are unavailable'}
            errorMessage={
              schemaUpdateRequired
                ? 'The latest amenity database update still needs to be applied.'
                : 'We couldn’t retrieve amenities from the society database. Your connection may still be working.'
            }
            onRetry={() => {
              profileQuery.refetch();
              amenitiesQuery.refetch();
              pendingQuery.refetch();
            }}
            isEmpty={
              !profileQuery.isLoading &&
              !amenitiesQuery.isLoading &&
              !profileQuery.isError &&
              !amenitiesQuery.isError &&
              amenities.length === 0
            }
            emptyTitle="No amenities yet"
            emptyMessage="Add your first amenity so residents can discover and book it."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, !item.is_active && styles.archivedCard]}
            onPress={() => router.push(`/(admin)/amenity/${item.id}`)}>
            {item.image_paths[0] && coverUrlsQuery.data?.[item.image_paths[0]] ? (
              <Image
                source={{ uri: coverUrlsQuery.data[item.image_paths[0]] }}
                style={styles.coverImage}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={styles.iconWrap}>
                <Text style={styles.iconLabel}>{getInitials(item.name)}</Text>
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.timings}>
                {formatAmenityTimings(item.open_time, item.close_time)}
                {!item.is_active ? ' · Archived' : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={() => router.push('/(admin)/add-amenity')}
          accessibilityRole="button"
          accessibilityLabel="Add amenity">
          <View style={styles.addIcon}>
            <Text style={styles.addIconLabel}>+</Text>
          </View>
          <Text style={styles.addButtonLabel}>Add amenity</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas, paddingHorizontal: 16 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  list: { marginTop: 16 },
  listContent: { gap: 10, paddingBottom: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  archivedCard: { opacity: 0.65 },
  coverImage: { width: 56, height: 56, borderRadius: 14 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#E9F1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: { fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.success700 },
  name: { fontSize: 15, fontWeight: '700' },
  timings: { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },
  actionBar: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.adminCanvas,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addButton: {
    height: 54,
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: Colors.green400,
  },
  addButtonPressed: { opacity: 0.88 },
  addIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,244,236,0.16)',
  },
  addIconLabel: { fontSize: 20, lineHeight: 22, fontWeight: '600', color: Colors.textOnDark },
  addButtonLabel: { fontSize: 15, fontWeight: '700', color: Colors.textOnDark },
});

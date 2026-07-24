import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AmenityForm, type AmenityFormValue } from '@/components/amenity-form';
import { AsyncState } from '@/components/async-state';
import { Colors } from '@/constants/commonConstants';
import { useAmenityDetail, useAmenityImageUrls, useSetAmenityImages, useUpdateAmenity } from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function EditAmenityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const amenityQuery = useAmenityDetail(id, profileQuery.data?.society_id);
  const updateAmenity = useUpdateAmenity();
  const setAmenityImages = useSetAmenityImages();
  const amenity = amenityQuery.data;
  const imageUrlsQuery = useAmenityImageUrls(amenity?.image_paths ?? [], profileQuery.data?.society_id);
  const isImageLoading = !!amenity?.image_paths.length && imageUrlsQuery.isLoading;

  async function handleSubmit(value: AmenityFormValue) {
    if (!amenity || !profileQuery.data) return;
    try {
      const { photos, ...details } = value;
      await updateAmenity.mutateAsync({ id: amenity.id, societyId: profileQuery.data.society_id, ...details });
      await setAmenityImages.mutateAsync({ amenityId: amenity.id, societyId: profileQuery.data.society_id, photos, previousPaths: amenity.image_paths });
      showToast('Amenity updated');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update the amenity'));
    }
  }

  if (!amenity || isImageLoading || imageUrlsQuery.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.adminCanvas }}>
        <AsyncState
          isLoading={profileQuery.isLoading || amenityQuery.isLoading || isImageLoading}
          isError={profileQuery.isError || amenityQuery.isError || imageUrlsQuery.isError}
          onRetry={() => {
            profileQuery.refetch();
            amenityQuery.refetch();
            imageUrlsQuery.refetch();
          }}
          isEmpty={!profileQuery.isLoading && !amenityQuery.isLoading && !profileQuery.isError && !amenityQuery.isError}
          emptyMessage="This amenity isn't available."
        />
      </View>
    );
  }

  return (
    <AmenityForm
      key={amenity.updated_at}
      title="Edit amenity"
      submitLabel="Save changes"
      initialValue={{
        name: amenity.name,
        description: amenity.description ?? '',
        openTime: amenity.open_time?.slice(0, 5) ?? '07:00',
        closeTime: amenity.close_time?.slice(0, 5) ?? '21:00',
        bookingType: amenity.booking_type,
        slotDurationMinutes: amenity.slot_duration_minutes,
        maxBookingsPerSlot: amenity.max_bookings_per_slot,
        advanceBookingDays: amenity.advance_booking_days,
        maxBookingsPerResidentPerDay: amenity.max_bookings_per_resident_per_day,
        requiresAdminApproval: amenity.requires_admin_approval,
        rulesAndRegulations: amenity.rules_and_regulations ?? '',
        photos: amenity.image_paths.map((path) => ({ uri: imageUrlsQuery.data?.[path] ?? '', base64: null, fileSize: null, storagePath: path })),
      }}
      isPending={updateAmenity.isPending || setAmenityImages.isPending}
      onSubmit={handleSubmit}
    />
  );
}

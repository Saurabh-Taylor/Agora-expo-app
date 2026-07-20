import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AmenityForm, type AmenityFormValue } from '@/components/amenity-form';
import { AsyncState } from '@/components/async-state';
import { Colors } from '@/constants/commonConstants';
import { useAmenityDetail, useUpdateAmenity } from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function EditAmenityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const amenityQuery = useAmenityDetail(id, profileQuery.data?.society_id);
  const updateAmenity = useUpdateAmenity();
  const amenity = amenityQuery.data;

  async function handleSubmit(value: AmenityFormValue) {
    if (!amenity || !profileQuery.data) return;
    try {
      await updateAmenity.mutateAsync({ id: amenity.id, societyId: profileQuery.data.society_id, ...value });
      showToast('Amenity updated');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update the amenity'));
    }
  }

  if (!amenity) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.adminCanvas }}>
        <AsyncState
          isLoading={profileQuery.isLoading || amenityQuery.isLoading}
          isError={profileQuery.isError || amenityQuery.isError}
          onRetry={() => {
            profileQuery.refetch();
            amenityQuery.refetch();
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
      }}
      isPending={updateAmenity.isPending}
      onSubmit={handleSubmit}
    />
  );
}

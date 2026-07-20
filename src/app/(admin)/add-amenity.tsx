import { router } from 'expo-router';
import { View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AmenityForm, type AmenityFormValue } from '@/components/amenity-form';
import { AsyncState } from '@/components/async-state';
import { Colors } from '@/constants/commonConstants';
import { useCreateAmenity } from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function AddAmenityScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createAmenity = useCreateAmenity();

  async function handleSubmit(value: AmenityFormValue) {
    if (!profileQuery.data) return;
    try {
      await createAmenity.mutateAsync({ societyId: profileQuery.data.society_id, ...value });
      showToast('Amenity added');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not add the amenity'));
    }
  }

  if (!profileQuery.data) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.adminCanvas }}>
        <AsyncState
          isLoading={profileQuery.isLoading}
          isError={profileQuery.isError}
          onRetry={() => profileQuery.refetch()}
          isEmpty={!profileQuery.isLoading && !profileQuery.isError}
          emptyMessage="Your admin profile isn't available."
        />
      </View>
    );
  }

  return <AmenityForm title="Add amenity" submitLabel="Add amenity" isPending={createAmenity.isPending} onSubmit={handleSubmit} />;
}

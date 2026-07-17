import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useCreateAmenity } from '@/features/amenities/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export default function AddAmenityScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createAmenity = useCreateAmenity();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [openTime, setOpenTime] = useState('07:00');
  const [closeTime, setCloseTime] = useState('21:00');

  const canSave =
    name.trim().length > 1 && TIME_PATTERN.test(openTime) && TIME_PATTERN.test(closeTime) && openTime < closeTime && !!profileQuery.data;

  async function handleSave() {
    if (!canSave || !profileQuery.data) return;
    try {
      await createAmenity.mutateAsync({
        societyId: profileQuery.data.society_id,
        name: name.trim(),
        description: description.trim(),
        openTime,
        closeTime,
      });
      router.back();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add the amenity');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Add amenity</Text>
      </View>

      <Text style={styles.label}>NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Swimming Pool"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="A short note residents will see"
        placeholderTextColor={Colors.textFaint}
        style={[styles.input, styles.textarea]}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>OPENS (24H)</Text>
          <TextInput
            value={openTime}
            onChangeText={setOpenTime}
            placeholder="07:00"
            placeholderTextColor={Colors.textFaint}
            style={styles.input}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>CLOSES (24H)</Text>
          <TextInput
            value={closeTime}
            onChangeText={setCloseTime}
            placeholder="21:00"
            placeholderTextColor={Colors.textFaint}
            style={styles.input}
          />
        </View>
      </View>

      <Pressable
        style={[styles.saveButton, { backgroundColor: canSave ? Colors.green500 : '#DDD8C8' }]}
        onPress={handleSave}
        disabled={!canSave || createAmenity.isPending}>
        {createAmenity.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.saveLabel, { color: canSave ? Colors.textOnDark : '#9B9682' }]}>Add amenity</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  input: {
    marginTop: 8,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontSize: 15.5,
    color: Colors.textPrimary,
  },
  textarea: { minHeight: 80 },
  row: { flexDirection: 'row', gap: 10 },
  saveButton: {
    marginTop: 30,
    height: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  saveLabel: { fontSize: 15.5, fontWeight: '700' },
});

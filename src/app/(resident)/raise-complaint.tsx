import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, ComplaintCategories, FontFamily, Radius } from '@/constants/commonConstants';
import { useCreateComplaint } from '@/features/complaints/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function RaiseComplaintScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createComplaint = useCreateComplaint();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(ComplaintCategories[0]);

  const canSubmit = title.trim().length > 1 && description.trim().length > 1 && !!profileQuery.data?.flat_id;

  async function handleSubmit() {
    if (!canSubmit || !profileQuery.data?.flat_id) return;
    try {
      const complaint = await createComplaint.mutateAsync({
        societyId: profileQuery.data.society_id,
        flatId: profileQuery.data.flat_id,
        title: title.trim(),
        description: description.trim(),
        category,
      });
      router.replace(`/(resident)/complaint/${complaint.id}`);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not raise the complaint'));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Raise a complaint</Text>
      </View>

      <AsyncState isLoading={profileQuery.isLoading} isError={profileQuery.isError} onRetry={() => profileQuery.refetch()} />

      <Text style={styles.label}>TITLE</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Leaking pipe in the basement"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
        maxLength={120}
      />

      <Text style={styles.label}>DESCRIPTION</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Share details that help the admin resolve this faster"
        placeholderTextColor={Colors.textFaint}
        style={[styles.input, styles.textarea]}
        multiline
        maxLength={1000}
        textAlignVertical="top"
      />

      <Text style={styles.label}>CATEGORY</Text>
      <View style={styles.chipsRow}>
        {ComplaintCategories.map((item) => {
          const active = category === item;
          return (
            <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.submitButton, { backgroundColor: canSubmit ? Colors.green500 : '#DDD8C8' }]}
        onPress={handleSubmit}
        disabled={!canSubmit || createComplaint.isPending}
        accessibilityRole="button"
        accessibilityLabel="Submit complaint">
        {createComplaint.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.submitLabel, { color: canSubmit ? Colors.textOnDark : '#9B9682' }]}>Submit complaint</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
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
  textarea: { minHeight: 110 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 14, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 14, fontWeight: '600', color: '#3E4A40' },
  submitButton: {
    marginTop: 30,
    height: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  submitLabel: { fontSize: 15.5, fontWeight: '700' },
});

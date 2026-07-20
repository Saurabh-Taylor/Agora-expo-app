import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { isValidAmenityTimeRange } from '@/commonFunctions';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';

export type AmenityFormValue = {
  name: string;
  description: string;
  openTime: string;
  closeTime: string;
};

type AmenityFormProps = {
  title: string;
  submitLabel: string;
  initialValue?: AmenityFormValue;
  isPending: boolean;
  onSubmit: (value: AmenityFormValue) => Promise<void>;
};

export function AmenityForm({
  title,
  submitLabel,
  initialValue = { name: '', description: '', openTime: '07:00', closeTime: '21:00' },
  isPending,
  onSubmit,
}: AmenityFormProps) {
  const [name, setName] = useState(initialValue.name);
  const [description, setDescription] = useState(initialValue.description);
  const [openTime, setOpenTime] = useState(initialValue.openTime);
  const [closeTime, setCloseTime] = useState(initialValue.closeTime);

  const canSave = name.trim().length > 1 && isValidAmenityTimeRange(openTime, closeTime);

  async function handleSave() {
    if (!canSave || isPending) return;
    await onSubmit({ name: name.trim(), description: description.trim(), openTime, closeTime });
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <Text style={styles.label}>NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Swimming Pool"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
        maxLength={100}
      />

      <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="A short note residents will see"
        placeholderTextColor={Colors.textFaint}
        style={[styles.input, styles.textarea]}
        multiline
        maxLength={500}
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
            maxLength={5}
            keyboardType="numbers-and-punctuation"
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
            maxLength={5}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      {!isValidAmenityTimeRange(openTime, closeTime) && (
        <Text style={styles.validationError}>Use 24-hour HH:MM times, with opening before closing.</Text>
      )}

      <Pressable
        style={[styles.saveButton, { backgroundColor: canSave ? Colors.green500 : '#DDD8C8' }]}
        onPress={handleSave}
        disabled={!canSave || isPending}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}>
        {isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.saveLabel, { color: canSave ? Colors.textOnDark : '#9B9682' }]}>{submitLabel}</Text>
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
  validationError: { marginTop: 10, fontSize: 12.5, color: Colors.danger700 },
  saveButton: {
    marginTop: 30,
    minHeight: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  saveLabel: { fontSize: 15.5, fontWeight: '700' },
});

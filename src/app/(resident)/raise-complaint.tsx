import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import {
  Colors,
  ComplaintCategories,
  COMPLAINT_ATTACHMENT_MAX_BYTES,
  FontFamily,
  Radius,
} from '@/constants/commonConstants';
import {
  useCreateComplaint,
  type ComplaintAttachmentInput,
} from '@/features/complaints/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const AttachmentSources = [
  { value: 'camera', label: 'Take photo' },
  { value: 'library', label: 'Choose photo' },
] as const;

export default function RaiseComplaintScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createComplaint = useCreateComplaint();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(ComplaintCategories[0]);
  const [attachment, setAttachment] = useState<ComplaintAttachmentInput | null>(null);

  const canSubmit =
    title.trim().length > 1 &&
    description.trim().length > 1 &&
    !!profileQuery.data?.flat_id &&
    !!session?.user.id;

  async function selectAttachment(source: (typeof AttachmentSources)[number]['value']) {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          showToast('Camera access is needed. Enable it in your phone settings and try again.');
          return;
        }
      }

      const openPicker =
        source === 'camera'
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync;
      const result = await openPicker({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        base64: true,
        quality: 0.7,
      });

      if (result.canceled) return;
      const selectedImage = result.assets[0];
      if (!selectedImage.base64) {
        showToast('Could not read the selected image. Please choose another photo.');
        return;
      }
      if (selectedImage.fileSize && selectedImage.fileSize > COMPLAINT_ATTACHMENT_MAX_BYTES) {
        showToast('Choose an image smaller than 5 MB');
        return;
      }
      setAttachment({
        uri: selectedImage.uri,
        base64: selectedImage.base64,
        fileSize: selectedImage.fileSize ?? null,
      });
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not open the camera or photo gallery'));
    }
  }

  async function handleSubmit() {
    if (!canSubmit || !profileQuery.data?.flat_id || !session?.user.id) return;
    try {
      const complaint = await createComplaint.mutateAsync({
        societyId: profileQuery.data.society_id,
        flatId: profileQuery.data.flat_id,
        userId: session.user.id,
        title: title.trim(),
        description: description.trim(),
        category,
        attachment: attachment ?? undefined,
      });
      router.replace(`/(resident)/complaint/${complaint.id}`);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not raise the complaint'));
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
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
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.attachmentHeading}>
        <Text style={styles.label}>ATTACHMENT</Text>
        <Text style={styles.optionalLabel}>Optional - max 5 MB</Text>
      </View>
      <View style={styles.attachmentCard}>
        {attachment ? (
          <>
            <Image source={{ uri: attachment.uri }} style={styles.attachmentPreview} contentFit="cover" />
            <View style={styles.attachmentSelectedRow}>
              <View style={styles.attachmentSelectedCopy}>
                <Text style={styles.attachmentTitle}>Photo attached</Text>
                <Text style={styles.attachmentHint}>You can replace or remove it before submitting.</Text>
              </View>
              <Pressable
                style={styles.removeButton}
                onPress={() => setAttachment(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove complaint attachment">
                <Text style={styles.removeLabel}>Remove</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.attachmentEmpty}>
            <Text style={styles.attachmentTitle}>Add visual evidence</Text>
            <Text style={styles.attachmentHint}>A clear photo can help the society team understand the issue faster.</Text>
          </View>
        )}

        <View style={styles.attachmentActions}>
          {AttachmentSources.map((item) => (
            <Pressable
              key={item.value}
              style={styles.attachmentButton}
              onPress={() => selectAttachment(item.value)}
              disabled={createComplaint.isPending}
              accessibilityRole="button"
              accessibilityLabel={item.label}>
              <Text style={styles.attachmentButtonLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        style={[styles.submitButton, { backgroundColor: canSubmit ? Colors.green500 : '#DDD8C8' }]}
        onPress={handleSubmit}
        disabled={!canSubmit || createComplaint.isPending}
        accessibilityRole="button"
        accessibilityLabel="Submit complaint">
        {createComplaint.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.submitLabel, { color: canSubmit ? Colors.textOnDark : '#9B9682' }]}>
          {createComplaint.isPending && attachment ? 'Uploading and submitting...' : 'Submit complaint'}
        </Text>
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
  chip: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 14, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 14, fontWeight: '600', color: '#3E4A40' },
  attachmentHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  optionalLabel: { fontSize: 11.5, color: Colors.textMuted, marginBottom: 1 },
  attachmentCard: {
    overflow: 'hidden',
    marginTop: 9,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  attachmentEmpty: { paddingHorizontal: 16, paddingTop: 17, paddingBottom: 14 },
  attachmentPreview: { width: '100%', height: 180, backgroundColor: Colors.border },
  attachmentSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  attachmentSelectedCopy: { flex: 1 },
  attachmentTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  attachmentHint: { fontSize: 12.5, lineHeight: 18, color: Colors.textMuted, marginTop: 4 },
  removeButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  removeLabel: { fontSize: 13, fontWeight: '700', color: Colors.danger700 },
  attachmentActions: { flexDirection: 'row', gap: 9, padding: 12 },
  attachmentButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.canvas,
  },
  attachmentButtonLabel: { fontSize: 13.5, fontWeight: '700', color: Colors.success700 },
  submitButton: {
    marginTop: 30,
    minHeight: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 18,
  },
  submitLabel: { fontSize: 15.5, fontWeight: '700' },
});

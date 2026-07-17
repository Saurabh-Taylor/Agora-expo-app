import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useCreateNotice, type NoticeCategory } from '@/features/notices/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const CATEGORIES: { value: NoticeCategory; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'WATER', label: 'Water' },
  { value: 'EVENT', label: 'Event' },
  { value: 'BILLING', label: 'Billing' },
  { value: 'SECURITY', label: 'Security' },
];

export default function ComposeNoticeScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createNotice = useCreateNotice();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('GENERAL');

  const canPublish = title.trim().length > 1 && body.trim().length > 1 && !!profileQuery.data;

  async function handlePublish() {
    if (!canPublish || !profileQuery.data) return;
    try {
      await createNotice.mutateAsync({
        societyId: profileQuery.data.society_id,
        title: title.trim(),
        body: body.trim(),
        category,
      });
      router.back();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not publish the notice');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Compose notice</Text>
      </View>

      <Text style={styles.label}>TITLE</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Water supply maintenance"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <Text style={styles.label}>MESSAGE</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Share the details residents need to know"
        placeholderTextColor={Colors.textFaint}
        style={[styles.input, styles.textarea]}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.label}>CATEGORY</Text>
      <View style={styles.chipsRow}>
        {CATEGORIES.map((item) => {
          const active = category === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setCategory(item.value)}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.publishButton, { backgroundColor: canPublish ? Colors.green500 : '#DDD8C8' }]}
        onPress={handlePublish}
        disabled={!canPublish || createNotice.isPending}>
        {createNotice.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.publishLabel, { color: canPublish ? Colors.textOnDark : '#9B9682' }]}>
          Publish now
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
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
  textarea: { minHeight: 120 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 14, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 14, fontWeight: '600', color: '#3E4A40' },
  publishButton: {
    marginTop: 30,
    height: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  publishLabel: { fontSize: 15.5, fontWeight: '700' },
});

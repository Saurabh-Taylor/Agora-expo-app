import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, NoticeCategories, Radius } from '@/constants/commonConstants';
import { useCreateNotice, type NoticeCategory } from '@/features/notices/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function ComposeNoticeScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createNotice = useCreateNotice();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NoticeCategory>('GENERAL');
  const [savingMode, setSavingMode] = useState<'draft' | 'publish' | null>(null);

  const canPublish = title.trim().length > 1 && body.trim().length > 1 && !!profileQuery.data;

  const isPending = createNotice.isPending;

  async function handleSave(publishNow: boolean) {
    if (!canPublish || !profileQuery.data || isPending) return;
    setSavingMode(publishNow ? 'publish' : 'draft');
    try {
      await createNotice.mutateAsync({
        societyId: profileQuery.data.society_id,
        title: title.trim(),
        body: body.trim(),
        category,
        publishNow,
      });
      showToast(publishNow ? 'Notice published' : 'Draft saved');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, publishNow ? 'Could not publish the notice' : 'Could not save the draft'));
    } finally {
      setSavingMode(null);
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
        {NoticeCategories.map((item) => {
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

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.draftButton, !canPublish && styles.disabledButton]}
          onPress={() => handleSave(false)}
          disabled={!canPublish || isPending}>
          <Text style={styles.draftLabel}>{savingMode === 'draft' ? 'Saving...' : 'Save draft'}</Text>
        </Pressable>
        <Pressable
          style={[styles.publishButton, !canPublish && styles.disabledButton]}
          onPress={() => handleSave(true)}
          disabled={!canPublish || isPending}>
          {savingMode === 'publish' && <ActivityIndicator size="small" color={Colors.textOnDark} />}
          <Text style={styles.publishLabel}>{savingMode === 'publish' ? 'Publishing...' : 'Publish now'}</Text>
        </Pressable>
      </View>
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
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 30 },
  draftButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: Radius.card - 2,
    borderWidth: 1,
    borderColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.green500 },
  publishButton: {
    flex: 1.35,
    minHeight: 54,
    borderRadius: Radius.card - 2,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  publishLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.textOnDark },
  disabledButton: { opacity: 0.45 },
});

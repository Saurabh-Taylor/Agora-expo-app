import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDate, getErrorMessage, getNoticeCategoryStyle } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, NoticeCategories, Radius } from '@/constants/commonConstants';
import {
  useArchiveNotice,
  useNoticeDetail,
  usePublishNotice,
  useUpdateNotice,
  type Notice,
  type NoticeCategory,
} from '@/features/notices/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function AdminNoticeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const noticeQuery = useNoticeDetail(id, societyId);
  const isLoading = profileQuery.isLoading || noticeQuery.isLoading;
  const isError = profileQuery.isError || noticeQuery.isError;

  if (isLoading || isError || !noticeQuery.data || !societyId) {
    return (
      <View style={styles.root}>
        <AsyncState
          isLoading={isLoading}
          isError={isError}
          onRetry={() => {
            profileQuery.refetch();
            noticeQuery.refetch();
          }}
          isEmpty={!isLoading && !isError && !noticeQuery.data}
          emptyMessage="Notice not found."
        />
      </View>
    );
  }

  return <NoticeManager key={noticeQuery.data.id} notice={noticeQuery.data} societyId={societyId} />;
}

function NoticeManager({ notice, societyId }: { notice: Notice; societyId: string }) {
  const updateNotice = useUpdateNotice();
  const publishNotice = usePublishNotice();
  const archiveNotice = useArchiveNotice();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(notice.title);
  const [body, setBody] = useState(notice.body);
  const [category, setCategory] = useState<NoticeCategory>(notice.category);
  const categoryStyle = getNoticeCategoryStyle(notice.category);
  const isArchived = !!notice.archived_at;
  const isPending = updateNotice.isPending || publishNotice.isPending || archiveNotice.isPending;
  const canSave =
    title.trim().length > 1 &&
    body.trim().length > 1 &&
    (title.trim() !== notice.title || body.trim() !== notice.body || category !== notice.category);

  async function handleSave() {
    if (!canSave || isArchived) return;
    try {
      await updateNotice.mutateAsync({
        id: notice.id,
        societyId,
        title: title.trim(),
        body: body.trim(),
        category,
      });
      showToast('Notice updated');
      setIsEditing(false);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update the notice'));
    }
  }

  async function handlePublish() {
    try {
      await publishNotice.mutateAsync({ id: notice.id, societyId });
      showToast('Notice published');
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not publish the notice'));
    }
  }

  function confirmArchive() {
    Alert.alert(
      'Archive notice?',
      'Residents will no longer be able to view this notice. Its audit history will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveNotice.mutateAsync({ id: notice.id, societyId });
              showToast('Notice archived');
              router.back();
            } catch (error) {
              showToast(getErrorMessage(error, 'Could not archive the notice'));
            }
          },
        },
      ],
    );
  }

  const stateStyle = isArchived
    ? { label: 'Archived', color: Colors.danger700, backgroundColor: '#F9E4E1' }
    : notice.state === 'PUBLISHED'
      ? { label: 'Published', color: Colors.success600, backgroundColor: '#E3F2E9' }
      : { label: 'Draft', color: '#9A6B14', backgroundColor: '#F6ECD8' };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <View style={styles.flex} />
        {!isArchived && (
          <Pressable style={styles.editButton} onPress={() => setIsEditing((current) => !current)} disabled={isPending}>
            <Text style={styles.editButtonLabel}>{isEditing ? 'Cancel' : 'Edit'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.pillRow}>
        <StatusPill label={categoryStyle.label} color={categoryStyle.color} backgroundColor={categoryStyle.bg} />
        <StatusPill label={stateStyle.label} color={stateStyle.color} backgroundColor={stateStyle.backgroundColor} />
      </View>

      {isEditing ? (
        <View style={styles.editCard}>
          <Text style={styles.label}>TITLE</Text>
          <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Notice title" />
          <Text style={styles.label}>MESSAGE</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            style={[styles.input, styles.textarea]}
            placeholder="Notice message"
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.label}>CATEGORY</Text>
          <View style={styles.chipRow}>
            {NoticeCategories.map((item) => {
              const active = item.value === category;
              return (
                <Pressable
                  key={item.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(item.value)}>
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.primaryButton, !canSave && styles.disabledButton]}
            onPress={handleSave}
            disabled={!canSave || isPending}>
            {updateNotice.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
            <Text style={styles.primaryButtonLabel}>{updateNotice.isPending ? 'Saving...' : 'Save changes'}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.title}>{notice.title}</Text>
          <Text style={styles.meta}>
            {notice.state === 'PUBLISHED' && notice.published_at
              ? `Published ${formatDate(notice.published_at)}`
              : `Created ${formatDate(notice.created_at)}`}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.body}>{notice.body}</Text>
        </>
      )}

      {!isArchived && notice.state !== 'PUBLISHED' && (
        <Pressable style={styles.primaryButton} onPress={handlePublish} disabled={isPending}>
          {publishNotice.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
          <Text style={styles.primaryButtonLabel}>{publishNotice.isPending ? 'Publishing...' : 'Publish notice'}</Text>
        </Pressable>
      )}

      {!isArchived && (
        <Pressable style={styles.archiveButton} onPress={confirmArchive} disabled={isPending}>
          {archiveNotice.isPending && <ActivityIndicator size="small" color={Colors.danger700} />}
          <Text style={styles.archiveButtonLabel}>{archiveNotice.isPending ? 'Archiving...' : 'Archive notice'}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  editButton: {
    minWidth: 58,
    minHeight: 44,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.green500 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 24, lineHeight: 30, marginTop: 18, color: Colors.textPrimary },
  meta: { fontSize: 13, color: Colors.textMuted, marginTop: 10 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 18 },
  body: { fontSize: 15, lineHeight: 24, color: '#2C3830' },
  editCard: { marginTop: 18, padding: 16, borderRadius: Radius.card, backgroundColor: Colors.surface },
  label: { marginTop: 12, fontSize: 11, letterSpacing: 1.4, fontWeight: '700', color: Colors.textMutedAlt },
  input: {
    marginTop: 7,
    minHeight: 50,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  textarea: { minHeight: 120, paddingTop: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  chip: { minHeight: 42, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderAlt, justifyContent: 'center' },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Colors.textPrimary },
  chipLabelActive: { color: Colors.textOnDark },
  primaryButton: {
    marginTop: 22,
    minHeight: 52,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14.5, color: Colors.textOnDark },
  archiveButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.danger700,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  archiveButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.danger700 },
  disabledButton: { opacity: 0.45 },
});

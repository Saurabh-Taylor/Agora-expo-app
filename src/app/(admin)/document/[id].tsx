import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { DocumentMetadataFields } from '@/components/document-metadata-fields';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import {
  type SocietyDocument,
  useArchiveSocietyDocument,
  useSocietyDocuments,
  useUpdateSocietyDocument,
} from '@/features/documents/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

function DocumentEditor({ document, societyId }: { document: SocietyDocument; societyId: string }) {
  const updateDocument = useUpdateSocietyDocument();
  const archiveDocument = useArchiveSocietyDocument();
  const [title, setTitle] = useState(document.title);
  const [description, setDescription] = useState(document.description ?? '');
  const [category, setCategory] = useState(document.category);
  const [audience, setAudience] = useState(document.audience);
  const [published, setPublished] = useState(document.is_published);
  const pending = updateDocument.isPending || archiveDocument.isPending;

  async function save() {
    if (title.trim().length < 2) return;
    try {
      await updateDocument.mutateAsync({
        societyId,
        documentId: document.id,
        title,
        description,
        category,
        audience,
        published,
      });
      showToast('Document settings updated');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not update document'));
    }
  }

  async function archive() {
    try {
      await archiveDocument.mutateAsync({ societyId, documentId: document.id });
      showToast('Document archived');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not archive document'));
    }
  }

  return <><View style={styles.fileCard}><Text style={styles.fileName}>{document.file_name}</Text><Text style={styles.fileMeta}>{Math.max(1, Math.round(document.file_size / 1024))} KB · File replacement is intentionally disabled; upload a new version instead.</Text></View><DocumentMetadataFields title={title} onTitleChange={setTitle} description={description} onDescriptionChange={setDescription} category={category} onCategoryChange={setCategory} audience={audience} onAudienceChange={setAudience} published={published} onPublishedChange={setPublished} /><Pressable accessibilityRole="button" disabled={pending || title.trim().length < 2} onPress={save} style={[styles.saveButton, (pending || title.trim().length < 2) && styles.disabled]}>{updateDocument.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}<Text style={styles.saveLabel}>Save settings</Text></Pressable><Pressable accessibilityRole="button" disabled={pending} onPress={archive} style={[styles.archiveButton, pending && styles.disabled]}>{archiveDocument.isPending && <ActivityIndicator size="small" color={Colors.danger700} />}<Text style={styles.archiveLabel}>Archive document</Text></Pressable></>;
}

export default function ManageDocumentScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const documentsQuery = useSocietyDocuments(societyId);
  const document = (documentsQuery.data ?? []).find((item) => item.id === id);

  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.headerRow}><BackArrowButton onPress={() => router.back()} /><Text accessibilityRole="header" style={styles.title}>Manage document</Text></View><AsyncState isLoading={profileQuery.isLoading || documentsQuery.isLoading} isError={profileQuery.isError || documentsQuery.isError || (!documentsQuery.isLoading && !document)} errorTitle="Document unavailable" errorMessage="This document is archived, missing, or outside your society." onRetry={() => { profileQuery.refetch(); documentsQuery.refetch(); }} />{document && societyId && <DocumentEditor key={`${document.id}:${document.updated_at}`} document={document} societyId={societyId} />}</ScrollView>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.adminCanvas }, content: { paddingHorizontal: 18, paddingBottom: 48 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary }, fileCard: { marginTop: 18, padding: 15, borderRadius: Radius.card, backgroundColor: Colors.categoryWater.bg }, fileName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary }, fileMeta: { marginTop: 5, fontSize: 11.5, lineHeight: 17, color: Colors.textMuted }, saveButton: { minHeight: 54, marginTop: 28, borderRadius: Radius.button, backgroundColor: Colors.green500, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, saveLabel: { fontSize: 15, fontWeight: '700', color: Colors.textOnDark }, archiveButton: { minHeight: 50, marginTop: 10, borderRadius: Radius.button, backgroundColor: '#FCEBE8', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, archiveLabel: { fontSize: 14, fontWeight: '700', color: Colors.danger700 }, disabled: { opacity: 0.45 } });

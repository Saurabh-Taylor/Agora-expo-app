import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { DocumentMetadataFields } from '@/components/document-metadata-fields';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius, SOCIETY_DOCUMENT_MAX_BYTES } from '@/constants/commonConstants';
import { type SocietyDocumentAudience, type SocietyDocumentCategory, useCreateSocietyDocument } from '@/features/documents/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function UploadDocumentScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const createDocument = useCreateSocietyDocument();
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SocietyDocumentCategory>('OTHER');
  const [audience, setAudience] = useState<SocietyDocumentAudience>('ALL');
  const [published, setPublished] = useState(true);
  const canSave = !!societyId && !!asset && title.trim().length >= 2 && !createDocument.isPending;

  async function pickDocument() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (selected.size && selected.size > SOCIETY_DOCUMENT_MAX_BYTES) {
        showToast('Document must be smaller than 10 MB');
        return;
      }
      setAsset(selected);
      if (!title.trim()) setTitle(selected.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not open the document picker'));
    }
  }

  async function upload() {
    if (!canSave || !societyId || !asset) return;
    try {
      await createDocument.mutateAsync({ societyId, asset, title, description, category, audience, published });
      showToast(published ? 'Document uploaded and published' : 'Document saved as draft');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not upload document'));
    }
  }

  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.headerRow}><BackArrowButton onPress={() => router.back()} /><Text accessibilityRole="header" style={styles.title}>Upload document</Text></View><Text style={styles.subtitle}>Accepted: PDF, text, Word, Excel, JPEG, and PNG. Maximum 10 MB.</Text><Pressable accessibilityRole="button" onPress={pickDocument} disabled={createDocument.isPending} style={styles.fileButton}><Text style={styles.fileButtonLabel}>{asset ? 'Change file' : 'Choose file'}</Text><Text style={styles.fileName}>{asset?.name ?? 'No file selected'}</Text></Pressable><DocumentMetadataFields title={title} onTitleChange={setTitle} description={description} onDescriptionChange={setDescription} category={category} onCategoryChange={setCategory} audience={audience} onAudienceChange={setAudience} published={published} onPublishedChange={setPublished} /><Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSave, busy: createDocument.isPending }} disabled={!canSave} onPress={upload} style={[styles.saveButton, !canSave && styles.disabled]}>{createDocument.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}<Text style={styles.saveLabel}>{createDocument.isPending ? 'Uploading...' : published ? 'Upload & publish' : 'Save draft'}</Text></Pressable></ScrollView>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.adminCanvas }, content: { paddingHorizontal: 18, paddingBottom: 48 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary }, subtitle: { marginTop: 10, fontSize: 12.5, lineHeight: 18, color: Colors.textMuted }, fileButton: { minHeight: 76, marginTop: 18, padding: 14, borderRadius: Radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.success700, backgroundColor: Colors.categorySecurity.bg, justifyContent: 'center' }, fileButtonLabel: { fontSize: 14, fontWeight: '700', color: Colors.success700 }, fileName: { marginTop: 4, fontSize: 12, color: Colors.textMuted }, saveButton: { minHeight: 54, marginTop: 28, borderRadius: Radius.button, backgroundColor: Colors.green500, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, saveLabel: { fontSize: 15, fontWeight: '700', color: Colors.textOnDark }, disabled: { opacity: 0.45 } });

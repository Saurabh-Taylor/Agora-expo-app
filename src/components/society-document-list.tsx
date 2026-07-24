import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatDate, getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import {
  Colors,
  FontFamily,
  Radius,
  SOCIETY_DOCUMENT_SIGNED_URL_SECONDS,
  SOCIETY_DOCUMENTS_BUCKET,
} from '@/constants/commonConstants';
import {
  SocietyDocumentCategories,
  type SocietyDocument,
  useSocietyDocumentRealtime,
  useSocietyDocuments,
} from '@/features/documents/api';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/stores/toast-store';

type SocietyDocumentListProps = {
  societyId: string | null | undefined;
  isAdmin?: boolean;
  onEdit?: (document: SocietyDocument) => void;
};

export function SocietyDocumentList({ societyId, isAdmin = false, onEdit }: SocietyDocumentListProps) {
  const documentsQuery = useSocietyDocuments(societyId);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'ALL' | SocietyDocument['category']>('ALL');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  useSocietyDocumentRealtime(societyId);
  const normalizedSearch = search.trim().toLowerCase();
  const documents = (documentsQuery.data ?? []).filter((document) => {
    const matchesCategory = category === 'ALL' || document.category === category;
    const matchesSearch = !normalizedSearch || `${document.title} ${document.description ?? ''} ${document.file_name}`.toLowerCase().includes(normalizedSearch);
    return matchesCategory && matchesSearch;
  });

  async function downloadDocument(document: SocietyDocument) {
    if (!societyId || downloadingId) return;
    if (!document.storage_path.startsWith(`${societyId}/`)) {
      showToast('This document has an invalid society scope');
      return;
    }
    setDownloadingId(document.id);
    try {
      if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) {
        throw new Error('File sharing is not available on this device');
      }
      const { data, error } = await supabase.storage
        .from(SOCIETY_DOCUMENTS_BUCKET)
        .createSignedUrl(document.storage_path, SOCIETY_DOCUMENT_SIGNED_URL_SECONDS);
      if (error) throw error;
      const safeName = document.file_name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const localUri = `${FileSystem.cacheDirectory}${document.id}-${safeName}`;
      await FileSystem.downloadAsync(data.signedUrl, localUri);
      await Sharing.shareAsync(localUri, { dialogTitle: `Save or share ${document.title}`, mimeType: document.mime_type });
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not download document'));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <View>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search title, details, or filename" placeholderTextColor={Colors.textFaint} style={styles.search} returnKeyType="search" accessibilityLabel="Search society documents" />
      <View style={styles.filters}>
        {(['ALL', ...SocietyDocumentCategories] as const).map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: category === item }} onPress={() => setCategory(item)} style={[styles.filter, category === item && styles.filterActive]}><Text style={[styles.filterLabel, category === item && styles.filterLabelActive]}>{item === 'ALL' ? 'All' : item.charAt(0) + item.slice(1).toLowerCase()}</Text></Pressable>)}
      </View>
      <AsyncState
        isLoading={documentsQuery.isLoading}
        isError={documentsQuery.isError}
        isRetrying={documentsQuery.isRefetching}
        onRetry={() => documentsQuery.refetch()}
        isEmpty={!documentsQuery.isLoading && documents.length === 0}
        emptyTitle={search || category !== 'ALL' ? 'No matching documents' : 'No documents available'}
        emptyMessage={search || category !== 'ALL' ? 'Try another search or category.' : isAdmin ? 'Upload the first society record to build this repository.' : 'Your society admin has not published documents for your role.'}
        actionLabel={search || category !== 'ALL' ? 'Clear filters' : undefined}
        onAction={search || category !== 'ALL' ? () => { setSearch(''); setCategory('ALL'); } : undefined}
      />
      <View style={styles.list}>{documents.map((document) => <View key={document.id} style={styles.card}><View style={styles.cardTop}><View style={styles.fileIcon}><Text style={styles.fileIconLabel}>DOC</Text></View><View style={styles.flex}><Text style={styles.title}>{document.title}</Text><Text style={styles.meta}>{document.category} · {Math.max(1, Math.round(document.file_size / 1024))} KB · {formatDate(document.created_at)}</Text></View>{isAdmin && <View style={[styles.status, document.is_published ? styles.published : styles.draft]}><Text style={styles.statusLabel}>{document.is_published ? 'Published' : 'Draft'}</Text></View>}</View>{document.description && <Text style={styles.description}>{document.description}</Text>}<Text style={styles.audience}>Access: {document.audience === 'ALL' ? 'Residents & guards' : document.audience === 'RESIDENT' ? 'Residents' : 'Guards'}</Text><View style={styles.actions}><Pressable accessibilityRole="button" accessibilityState={{ busy: downloadingId === document.id }} disabled={!!downloadingId} onPress={() => downloadDocument(document)} style={styles.downloadButton}>{downloadingId === document.id && <ActivityIndicator size="small" color={Colors.textOnDark} />}<Text style={styles.downloadLabel}>{downloadingId === document.id ? 'Preparing...' : 'Download'}</Text></Pressable>{isAdmin && onEdit && <Pressable accessibilityRole="button" onPress={() => onEdit(document)} style={styles.editButton}><Text style={styles.editLabel}>Manage</Text></Pressable>}</View></View>)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 48, paddingHorizontal: 14, borderRadius: Radius.input, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, color: Colors.textPrimary }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, filter: { minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center' }, filterActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 }, filterLabel: { fontSize: 11.5, fontWeight: '700', color: Colors.textMuted }, filterLabelActive: { color: Colors.textOnDark }, list: { gap: 10, marginTop: 14 }, card: { padding: 15, borderRadius: Radius.card, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, fileIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: Colors.categoryWater.bg, alignItems: 'center', justifyContent: 'center' }, fileIconLabel: { fontSize: 10, fontWeight: '800', color: Colors.categoryWater.text }, flex: { flex: 1, minWidth: 0 }, title: { fontFamily: FontFamily.bodyBold, fontSize: 15, color: Colors.textPrimary }, meta: { marginTop: 3, fontSize: 11.5, color: Colors.textMuted }, description: { marginTop: 10, fontSize: 12.5, lineHeight: 18, color: Colors.textMuted }, audience: { marginTop: 8, fontSize: 11.5, fontWeight: '600', color: Colors.textMutedAlt }, status: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 }, published: { backgroundColor: Colors.categorySecurity.bg }, draft: { backgroundColor: Colors.categoryGeneral.bg }, statusLabel: { fontSize: 10, fontWeight: '700', color: Colors.textPrimary }, actions: { flexDirection: 'row', gap: 8, marginTop: 12 }, downloadButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: Colors.green500, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, downloadLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textOnDark }, editButton: { minWidth: 86, minHeight: 44, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center' }, editLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
});

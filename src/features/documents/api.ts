import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import type { DocumentPickerAsset } from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import {
  assertSocietyRecord,
  assertSocietyRecords,
  getQueryKey,
  invalidateAuditEvents,
  removeRealtimeSubscription,
  subscribeToRealtimeTables,
} from '@/commonFunctions';
import {
  QueryKeyRoots,
  SOCIETY_DOCUMENT_MAX_BYTES,
  SOCIETY_DOCUMENTS_BUCKET,
} from '@/constants/commonConstants';
import { supabase } from '@/lib/supabase';

export const SocietyDocumentCategories = ['BYLAWS', 'MINUTES', 'POLICY', 'NOC', 'FORM', 'NOTICE', 'OTHER'] as const;
export const SocietyDocumentAudiences = ['ALL', 'RESIDENT', 'GUARD'] as const;

export type SocietyDocumentCategory = (typeof SocietyDocumentCategories)[number];
export type SocietyDocumentAudience = (typeof SocietyDocumentAudiences)[number];

export type SocietyDocument = {
  id: string;
  society_id: string;
  title: string;
  description: string | null;
  category: SocietyDocumentCategory;
  audience: SocietyDocumentAudience;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  is_published: boolean;
  uploaded_by: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useSocietyDocuments(societyId: string | null | undefined) {
  return useQuery({
    queryKey: getQueryKey(QueryKeyRoots.documents, societyId, 'list'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('society_documents')
        .select('*')
        .eq('society_id', societyId as string)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return assertSocietyRecords(
        (data ?? []) as SocietyDocument[],
        societyId as string,
        'The server returned documents outside this society',
      );
    },
    enabled: !!societyId,
  });
}

export function useSocietyDocumentRealtime(societyId: string | null | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!societyId) return;
    const channel = subscribeToRealtimeTables(
      `documents:${societyId}`,
      [{ table: 'society_documents', filter: `society_id=eq.${societyId}` }],
      () => queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.documents, societyId) }),
    );
    return () => { void removeRealtimeSubscription(channel); };
  }, [queryClient, societyId]);
}

type CreateSocietyDocumentInput = {
  societyId: string;
  title: string;
  description: string;
  category: SocietyDocumentCategory;
  audience: SocietyDocumentAudience;
  published: boolean;
  asset: DocumentPickerAsset;
};

function getDocumentMimeType(asset: DocumentPickerAsset) {
  if (asset.mimeType) return asset.mimeType;
  const extension = asset.name.split('.').pop()?.toLowerCase();
  const mimeByExtension: Record<string, string> = {
    pdf: 'application/pdf',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };
  return extension ? mimeByExtension[extension] : undefined;
}

function getSafeDocumentFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return normalized || 'document';
}

async function uploadSocietyDocument(input: CreateSocietyDocumentInput) {
  const info = await FileSystem.getInfoAsync(input.asset.uri);
  const fileSize = input.asset.size ?? (info.exists && 'size' in info ? info.size : undefined);
  if (!fileSize || fileSize > SOCIETY_DOCUMENT_MAX_BYTES) {
    throw new Error('Document must be a non-empty file smaller than 10 MB');
  }
  const mimeType = getDocumentMimeType(input.asset);
  if (!mimeType) throw new Error('Choose a PDF, text, Word, Excel, JPEG, or PNG document');
  const storagePath = `${input.societyId}/${Crypto.randomUUID()}-${getSafeDocumentFileName(input.asset.name)}`;
  const base64 = await FileSystem.readAsStringAsync(input.asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  const fileBody = decode(base64);
  if (fileBody.byteLength !== fileSize || fileBody.byteLength > SOCIETY_DOCUMENT_MAX_BYTES) {
    throw new Error('The selected document could not be read safely');
  }
  const { error } = await supabase.storage.from(SOCIETY_DOCUMENTS_BUCKET).upload(storagePath, fileBody, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;
  return { storagePath, fileSize, mimeType };
}

export function useCreateSocietyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSocietyDocumentInput) => {
      let uploadedPath: string | null = null;
      try {
        const uploaded = await uploadSocietyDocument(input);
        uploadedPath = uploaded.storagePath;
        const { data, error } = await supabase.rpc('create_admin_society_document', {
          requested_title: input.title.trim(),
          requested_description: input.description.trim() || null,
          requested_category: input.category,
          requested_audience: input.audience,
          requested_file_name: input.asset.name,
          requested_storage_path: uploaded.storagePath,
          requested_mime_type: uploaded.mimeType,
          requested_file_size: uploaded.fileSize,
          requested_published: input.published,
        });
        if (error) throw error;
        return assertSocietyRecord(
          data as SocietyDocument | null,
          input.societyId,
          'The document could not be created in this society',
        );
      } catch (error) {
        if (uploadedPath) await supabase.storage.from(SOCIETY_DOCUMENTS_BUCKET).remove([uploadedPath]);
        throw error;
      }
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.documents, document.society_id) });
      invalidateAuditEvents(queryClient, document.society_id);
    },
  });
}

type UpdateSocietyDocumentInput = {
  societyId: string;
  documentId: string;
  title: string;
  description: string;
  category: SocietyDocumentCategory;
  audience: SocietyDocumentAudience;
  published: boolean;
};

export function useUpdateSocietyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSocietyDocumentInput) => {
      const { data, error } = await supabase.rpc('update_admin_society_document', {
        target_document_id: input.documentId,
        requested_title: input.title.trim(),
        requested_description: input.description.trim() || null,
        requested_category: input.category,
        requested_audience: input.audience,
        requested_published: input.published,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as SocietyDocument | null,
        input.societyId,
        'The document could not be updated in this society',
      );
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.documents, document.society_id) });
    },
  });
}

export function useArchiveSocietyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { societyId: string; documentId: string }) => {
      const { data, error } = await supabase.rpc('archive_admin_society_document', {
        target_document_id: input.documentId,
      });
      if (error) throw error;
      return assertSocietyRecord(
        data as SocietyDocument | null,
        input.societyId,
        'The document could not be archived in this society',
      );
    },
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: getQueryKey(QueryKeyRoots.documents, document.society_id) });
      invalidateAuditEvents(queryClient, document.society_id);
    },
  });
}

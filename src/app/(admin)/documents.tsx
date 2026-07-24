import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { SocietyDocumentList } from '@/components/society-document-list';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export default function AdminDocumentsScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.headerRow}><BackArrowButton onPress={() => router.back()} /><View style={styles.flex}><Text accessibilityRole="header" style={styles.title}>Society documents</Text><Text style={styles.subtitle}>Private, role-scoped society records</Text></View></View><Pressable accessibilityRole="button" style={styles.uploadButton} onPress={() => router.push('/(admin)/upload-document' as Href)}><Text style={styles.uploadLabel}>+ Upload document</Text></Pressable><SocietyDocumentList societyId={societyId} isAdmin onEdit={(document) => router.push(`/(admin)/document/${document.id}` as Href)} /></ScrollView>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.adminCanvas }, content: { paddingHorizontal: 18, paddingBottom: 48 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, flex: { flex: 1 }, title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary }, subtitle: { marginTop: 2, fontSize: 12.5, color: Colors.textMuted }, uploadButton: { minHeight: 50, marginTop: 18, marginBottom: 14, borderRadius: Radius.button, backgroundColor: Colors.green500, alignItems: 'center', justifyContent: 'center' }, uploadLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.textOnDark } });

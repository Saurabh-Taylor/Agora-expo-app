import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { SocietyDocumentList } from '@/components/society-document-list';
import { Colors, FontFamily } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

export function SocietyDocumentsScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.headerRow}><BackArrowButton onPress={() => router.back()} /><View style={styles.flex}><Text accessibilityRole="header" style={styles.title}>Society documents</Text><Text style={styles.subtitle}>Published records available to your role</Text></View></View><View style={styles.list}><SocietyDocumentList societyId={profileQuery.data?.society_id} /></View></ScrollView>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.canvas }, content: { paddingHorizontal: 16, paddingBottom: 48 }, headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, flex: { flex: 1 }, title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary }, subtitle: { marginTop: 2, fontSize: 12.5, color: Colors.textMuted }, list: { marginTop: 18 } });

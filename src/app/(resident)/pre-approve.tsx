import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius, VisitorCategoryOptions } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useCreatePreApproval, type VisitorCategory } from '@/features/visitors/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function PreApproveScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createPreApproval = useCreatePreApproval();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<VisitorCategory | undefined>(undefined);

  const canCreate = name.trim().length > 1 && !!category;

  async function handleCreate() {
    if (!canCreate || !category || !profileQuery.data?.flat_id) return;
    try {
      const result = await createPreApproval.mutateAsync({
        societyId: profileQuery.data.society_id,
        visitorName: name.trim(),
        category,
      });
      router.replace({
        pathname: '/(resident)/gate-pass',
        params: { id: result.request.id, created: 'true' },
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create the gate pass');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Pre-approve a visitor</Text>
      </View>
      <Text style={styles.subtitle}>The guard lets them in with a pass code - no gate call needed. The pass stays active for 24 hours.</Text>

      <Text style={styles.label}>VISITOR NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Priya Nair"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <Text style={styles.label}>TYPE</Text>
      <View style={styles.chipsRow}>
        {VisitorCategoryOptions.map((item) => {
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
        style={[styles.createButton, { backgroundColor: canCreate ? Colors.green500 : '#DDD8C8' }]}
        onPress={handleCreate}
        disabled={!canCreate || createPreApproval.isPending}>
        {createPreApproval.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.createButtonLabel, { color: canCreate ? Colors.textOnDark : '#9B9682' }]}>Create gate pass</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  subtitle: { fontSize: 13.5, color: Colors.textMuted, marginTop: 10, lineHeight: 20 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  input: {
    marginTop: 8,
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 14, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 14, fontWeight: '600', color: '#3E4A40' },
  createButton: {
    marginTop: 30,
    height: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  createButtonLabel: { fontSize: 15.5, fontWeight: '700' },
});

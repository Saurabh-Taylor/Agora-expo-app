import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useCreateStaff } from '@/features/staff/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const ROLES = ['Security', 'Housekeeping', 'Maintenance', 'Gardener', 'Other'];
const SHIFTS = ['Morning', 'Afternoon', 'Evening', 'Night'];

export default function AddStaffScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createStaff = useCreateStaff();

  const [name, setName] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [shift, setShift] = useState(SHIFTS[0]);
  const [phone, setPhone] = useState('');

  const canSave = name.trim().length > 1 && !!profileQuery.data;

  async function handleSave() {
    if (!canSave || !profileQuery.data) return;
    try {
      await createStaff.mutateAsync({
        societyId: profileQuery.data.society_id,
        name: name.trim(),
        role,
        shift,
        phone: phone.trim(),
      });
      router.back();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not add this staff member');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Add staff member</Text>
      </View>

      <Text style={styles.label}>NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Rajesh Kumar"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <Text style={styles.label}>ROLE</Text>
      <View style={styles.chipsRow}>
        {ROLES.map((item) => {
          const active = role === item;
          return (
            <Pressable key={item} onPress={() => setRole(item)} style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>SHIFT</Text>
      <View style={styles.chipsRow}>
        {SHIFTS.map((item) => {
          const active = shift === item;
          return (
            <Pressable key={item} onPress={() => setShift(item)} style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>PHONE (OPTIONAL)</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="e.g. 98765 43210"
        placeholderTextColor={Colors.textFaint}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <Pressable
        style={[styles.saveButton, { backgroundColor: canSave ? Colors.green500 : '#DDD8C8' }]}
        onPress={handleSave}
        disabled={!canSave || createStaff.isPending}>
        {createStaff.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.saveLabel, { color: canSave ? Colors.textOnDark : '#9B9682' }]}>Add staff member</Text>
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
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 14, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 14, fontWeight: '600', color: '#3E4A40' },
  saveButton: {
    marginTop: 30,
    height: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  saveLabel: { fontSize: 15.5, fontWeight: '700' },
});

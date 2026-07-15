import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useCreateTower } from '@/features/towers/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function AddTowerScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createTower = useCreateTower();

  const [name, setName] = useState('');
  const [floors, setFloors] = useState('');
  const [unitsPerFloor, setUnitsPerFloor] = useState('');
  const [linkResidentNow, setLinkResidentNow] = useState(false);

  const floorsNumber = parseInt(floors, 10) || 0;
  const unitsPerFloorNumber = parseInt(unitsPerFloor, 10) || 0;
  const totalFlats = floorsNumber * unitsPerFloorNumber;
  const canSave = name.trim().length > 1 && totalFlats > 0 && !!profileQuery.data;

  async function handleSave() {
    if (!canSave || !profileQuery.data) return;
    try {
      const tower = await createTower.mutateAsync({
        name: name.trim(),
        floors: floorsNumber,
        unitsPerFloor: unitsPerFloorNumber,
        societyId: profileQuery.data.society_id,
      });
      if (linkResidentNow) {
        router.replace(`/(admin)/add-resident?towerId=${tower.id}`);
      } else {
        router.back();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create the tower');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Add tower</Text>
      </View>

      <Text style={styles.label}>TOWER NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Cedar Tower"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>FLOORS</Text>
          <TextInput
            value={floors}
            onChangeText={setFloors}
            keyboardType="number-pad"
            placeholder="14"
            placeholderTextColor={Colors.textFaint}
            style={styles.input}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>FLATS / FLOOR</Text>
          <TextInput
            value={unitsPerFloor}
            onChangeText={setUnitsPerFloor}
            keyboardType="number-pad"
            placeholder="4"
            placeholderTextColor={Colors.textFaint}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          This will create <Text style={styles.infoBold}>{totalFlats}</Text> flats, numbered by floor. You can link
          residents to each unit next.
        </Text>
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.flex}>
          <Text style={styles.toggleTitle}>Link a resident now</Text>
          <Text style={styles.toggleSub}>Assign the first flat right away</Text>
        </View>
        <Pressable
          style={[styles.toggleTrack, linkResidentNow && styles.toggleTrackOn]}
          onPress={() => setLinkResidentNow(!linkResidentNow)}>
          <View style={[styles.toggleKnob, linkResidentNow && styles.toggleKnobOn]} />
        </Pressable>
      </View>

      <Pressable
        style={[styles.saveButton, { backgroundColor: canSave ? Colors.green500 : '#C9C3B2' }]}
        onPress={handleSave}
        disabled={!canSave || createTower.isPending}>
        {createTower.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={styles.saveLabel}>Create tower</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 18 },
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
  row: { flexDirection: 'row', gap: 10 },
  infoBox: { backgroundColor: '#F6ECD8', borderWidth: 1, borderColor: '#EBD9B4', borderRadius: 14, padding: 13, marginTop: 16 },
  infoText: { fontSize: 13, color: '#5C4408', lineHeight: 19 },
  infoBold: { fontWeight: '800' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
  },
  toggleTitle: { fontSize: 14.5, fontWeight: '700' },
  toggleSub: { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  toggleTrack: { width: 48, height: 28, borderRadius: 999, backgroundColor: '#D8D2C2', justifyContent: 'center' },
  toggleTrackOn: { backgroundColor: Colors.success600 },
  toggleKnob: { width: 22, height: 22, borderRadius: 999, backgroundColor: '#fff', marginLeft: 3 },
  toggleKnobOn: { marginLeft: 23 },
  saveButton: {
    marginTop: 26,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  saveLabel: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
});

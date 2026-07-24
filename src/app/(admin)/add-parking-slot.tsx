import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage } from '@/commonFunctions';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { ParkingSlotTypes, type ParkingSlotType, useCreateParkingSlot } from '@/features/parking/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function AddParkingSlotScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const createSlot = useCreateParkingSlot();
  const [code, setCode] = useState('');
  const [zone, setZone] = useState('');
  const [level, setLevel] = useState('Ground');
  const [row, setRow] = useState('0');
  const [column, setColumn] = useState('0');
  const [slotType, setSlotType] = useState<ParkingSlotType>('CAR');
  const rowIndex = Number(row);
  const columnIndex = Number(column);
  const canSave = !!societyId && code.trim() && zone.trim() && level.trim()
    && Number.isInteger(rowIndex) && rowIndex >= 0 && Number.isInteger(columnIndex) && columnIndex >= 0
    && !createSlot.isPending;

  async function save() {
    if (!canSave || !societyId) return;
    try {
      await createSlot.mutateAsync({ societyId, code, zone, levelLabel: level, rowIndex, columnIndex, slotType });
      showToast('Parking slot added');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not add parking slot'));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}><BackArrowButton onPress={() => router.back()} /><Text accessibilityRole="header" style={styles.title}>Add parking slot</Text></View>
      <Text style={styles.subtitle}>Position values control where this slot appears in its zone and level.</Text>
      <Text style={styles.label}>SLOT CODE</Text><TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="A-101" placeholderTextColor={Colors.textFaint} style={styles.input} />
      <Text style={styles.label}>ZONE</Text><TextInput value={zone} onChangeText={setZone} placeholder="North Wing" placeholderTextColor={Colors.textFaint} style={styles.input} />
      <Text style={styles.label}>LEVEL</Text><TextInput value={level} onChangeText={setLevel} placeholder="Basement 1" placeholderTextColor={Colors.textFaint} style={styles.input} />
      <View style={styles.row}><View style={styles.flex}><Text style={styles.label}>ROW</Text><TextInput value={row} onChangeText={setRow} keyboardType="number-pad" style={styles.input} /></View><View style={styles.flex}><Text style={styles.label}>COLUMN</Text><TextInput value={column} onChangeText={setColumn} keyboardType="number-pad" style={styles.input} /></View></View>
      <Text style={styles.label}>SLOT TYPE</Text>
      <View style={styles.choices}>{ParkingSlotTypes.map((type) => <Pressable key={type} accessibilityRole="radio" accessibilityState={{ checked: slotType === type }} onPress={() => setSlotType(type)} style={[styles.choice, slotType === type && styles.choiceActive]}><Text style={[styles.choiceLabel, slotType === type && styles.choiceLabelActive]}>{type}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSave, busy: createSlot.isPending }} disabled={!canSave} onPress={save} style={[styles.saveButton, !canSave && styles.disabled]}>{createSlot.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}<Text style={styles.saveLabel}>{createSlot.isPending ? 'Adding...' : 'Add slot'}</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas }, content: { paddingHorizontal: 20, paddingBottom: 44 }, flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { marginTop: 10, fontSize: 13, lineHeight: 19, color: Colors.textMuted }, label: { marginTop: 18, fontSize: 11, letterSpacing: 1.4, fontWeight: '700', color: Colors.textMutedAlt },
  input: { minHeight: 50, marginTop: 7, borderRadius: Radius.input, borderWidth: 1.5, borderColor: Colors.borderAlt, backgroundColor: Colors.surface, paddingHorizontal: 14, fontSize: 15, color: Colors.textPrimary },
  row: { flexDirection: 'row', gap: 10 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 }, choice: { minHeight: 44, paddingHorizontal: 14, borderRadius: 13, borderWidth: 1.5, borderColor: Colors.borderAlt, alignItems: 'center', justifyContent: 'center' },
  choiceActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 }, choiceLabel: { fontWeight: '700', color: Colors.textPrimary }, choiceLabelActive: { color: Colors.textOnDark },
  saveButton: { minHeight: 54, marginTop: 30, borderRadius: Radius.button, backgroundColor: Colors.green500, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, saveLabel: { fontWeight: '700', fontSize: 15, color: Colors.textOnDark }, disabled: { opacity: 0.45 },
});

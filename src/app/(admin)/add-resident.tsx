import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { isValidEmail } from '@/commonFunctions';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { TemporaryAccountCredentials } from '@/components/temporary-account-credentials';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { findOrCreateFlat } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useCreateResident } from '@/features/residents/api';
import { useTowers } from '@/features/towers/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type OccupancyType = 'OWNER' | 'TENANT';

function parseFloorFromFlatNumber(number: string) {
  const digitsOnly = number.replace(/\D/g, '');
  if (digitsOnly.length >= 3) return parseInt(digitsOnly.slice(0, -2), 10) || 1;
  return 1;
}

export default function AddResidentScreen() {
  const params = useLocalSearchParams<{ towerId?: string; flatNumber?: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const towersQuery = useTowers(profileQuery.data?.society_id);
  const createResident = useCreateResident();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedTowerId, setSelectedTowerId] = useState<string | undefined>(params.towerId);
  const [flatNumber, setFlatNumber] = useState(params.flatNumber ?? '');
  const [phone, setPhone] = useState('');
  const [occupancyType, setOccupancyType] = useState<OccupancyType>('OWNER');
  const [markVerified, setMarkVerified] = useState(false);
  const [isResolvingFlat, setIsResolvingFlat] = useState(false);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);

  // Defaults to the first tower once towers load, without a selection effect.
  const towerId = selectedTowerId ?? towersQuery.data?.[0]?.id;

  const canSave =
    fullName.trim().length > 1 &&
    isValidEmail(email) &&
    !!towerId &&
    flatNumber.trim().length > 0 &&
    !!profileQuery.data;
  const busy = isResolvingFlat || createResident.isPending;

  async function handleSave() {
    if (!canSave || !profileQuery.data || !towerId) return;
    setIsResolvingFlat(true);
    try {
      const flat = await findOrCreateFlat({
        societyId: profileQuery.data.society_id,
        towerId,
        number: flatNumber.trim(),
        floor: parseFloorFromFlatNumber(flatNumber.trim()),
      });
      setIsResolvingFlat(false);

      const created = await createResident.mutateAsync({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        flatId: flat.id,
        occupancyType,
        isVerified: markVerified,
        societyId: profileQuery.data.society_id,
      });
      setResult({ email: created.email, tempPassword: created.tempPassword });
    } catch (error) {
      setIsResolvingFlat(false);
      showToast(error instanceof Error ? error.message : 'Could not create the resident');
    }
  }

  if (result) {
    return (
      <TemporaryAccountCredentials
        accountLabel="resident"
        email={result.email}
        tempPassword={result.tempPassword}
        onDone={() => router.back()}
      />
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Add resident</Text>
      </View>

      <Text style={styles.label}>FULL NAME</Text>
      <TextInput
        value={fullName}
        onChangeText={setFullName}
        placeholder="e.g. Priya Nair"
        placeholderTextColor={Colors.textFaint}
        style={styles.input}
      />

      <Text style={styles.label}>EMAIL</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="resident@email.com"
        placeholderTextColor={Colors.textFaint}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <Text style={styles.label}>TOWER</Text>
      <View style={styles.chipsRow}>
        {(towersQuery.data ?? []).map((tower) => {
          const active = tower.id === towerId;
          return (
            <Pressable
              key={tower.id}
              onPress={() => setSelectedTowerId(tower.id)}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{tower.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={styles.label}>FLAT NO.</Text>
          <TextInput
            value={flatNumber}
            onChangeText={setFlatNumber}
            placeholder="1204"
            placeholderTextColor={Colors.textFaint}
            style={styles.input}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.label}>PHONE</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="numeric"
            placeholder="98765 43210"
            placeholderTextColor={Colors.textFaint}
            style={styles.input}
          />
        </View>
      </View>

      <Text style={styles.label}>OCCUPANCY</Text>
      <View style={styles.row}>
        {(['OWNER', 'TENANT'] as const).map((type) => {
          const active = occupancyType === type;
          return (
            <Pressable
              key={type}
              onPress={() => setOccupancyType(type)}
              style={[styles.occupancyButton, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>
                {type === 'OWNER' ? 'Owner' : 'Tenant'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.flex}>
          <Text style={styles.toggleTitle}>Mark as verified</Text>
          <Text style={styles.toggleSub}>Skip the pending-review step</Text>
        </View>
        <Pressable style={[styles.toggleTrack, markVerified && styles.toggleTrackOn]} onPress={() => setMarkVerified(!markVerified)}>
          <View style={[styles.toggleKnob, markVerified && styles.toggleKnobOn]} />
        </Pressable>
      </View>

      <Pressable
        style={[styles.saveButton, { backgroundColor: canSave ? Colors.green500 : '#C9C3B2' }]}
        onPress={handleSave}
        disabled={!canSave || busy}>
        {busy && <ActivityIndicator size="small" color="#fff" />}
        <Text style={styles.saveLabel}>Save resident</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
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
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1.5 },
  occupancyButton: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 13, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 13, fontWeight: '600', color: '#3E4A40' },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
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
  successRoot: { flex: 1, backgroundColor: Colors.adminCanvas, padding: 24, paddingTop: 100, alignItems: 'center' },
  successTitle: { fontFamily: FontFamily.headingExtraBold, fontSize: 24, textAlign: 'center' },
  successSubtitle: { fontSize: 13.5, color: Colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  credentialCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card,
    padding: 18,
    marginTop: 22,
  },
  credentialLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt },
  credentialLabelSpaced: { marginTop: 16 },
  credentialValue: { fontFamily: FontFamily.headingBold, fontSize: 18, marginTop: 5 },
  copyButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  copyButtonLabel: { fontSize: 15, fontWeight: '700', color: Colors.green500 },
  doneButton: {
    width: '100%',
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  doneButtonLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.green500 },
});

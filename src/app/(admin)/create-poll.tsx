import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { getErrorMessage } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useProfile } from '@/features/profile/api';
import { useCreatePoll } from '@/features/polls/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const DURATIONS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: 'No limit', days: null },
] as const;

function RemoveIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6L6 18" stroke={Colors.danger700} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export default function CreatePollScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const createPoll = useCreatePoll();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [durationDays, setDurationDays] = useState<number | null>(3);

  const trimmedOptions = options.map((option) => option.trim()).filter((option) => option.length > 0);
  const hasUniqueOptions = new Set(trimmedOptions.map((option) => option.toLowerCase())).size === trimmedOptions.length;
  const canLaunch = question.trim().length > 3 && trimmedOptions.length >= 2 && hasUniqueOptions && !!profileQuery.data;

  function setOptionAt(index: number, value: string) {
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)));
  }

  function removeOptionAt(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleLaunch() {
    if (!canLaunch || !profileQuery.data) return;
    try {
      const closesAt = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString() : null;
      const poll = await createPoll.mutateAsync({
        societyId: profileQuery.data.society_id,
        question: question.trim(),
        options: trimmedOptions,
        closesAt,
      });
      router.replace(`/(admin)/poll/${poll.id}`);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not launch the poll'));
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>New poll</Text>
      </View>

      <AsyncState isLoading={profileQuery.isLoading} isError={profileQuery.isError} onRetry={() => profileQuery.refetch()} />

      <Text style={styles.label}>QUESTION</Text>
      <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder="What should the community decide?"
        placeholderTextColor={Colors.textFaint}
        style={[styles.input, styles.textarea]}
        multiline
        maxLength={240}
        textAlignVertical="top"
      />

      <Text style={styles.label}>OPTIONS</Text>
      <View style={styles.optionsList}>
        {options.map((option, index) => (
          <View key={index} style={styles.optionRow}>
            <TextInput
              value={option}
              onChangeText={(value) => setOptionAt(index, value)}
              placeholder={`Option ${index + 1}`}
              placeholderTextColor={Colors.textFaint}
              style={[styles.input, styles.optionInput]}
              maxLength={80}
            />
            {options.length > 2 && (
              <Pressable style={styles.removeButton} onPress={() => removeOptionAt(index)} hitSlop={6}>
                <RemoveIcon />
              </Pressable>
            )}
          </View>
        ))}
      </View>
      {!hasUniqueOptions && <Text style={styles.validationError}>Options must be unique.</Text>}
      {options.length < 5 && (
        <Pressable onPress={() => setOptions((prev) => [...prev, ''])}>
          <Text style={styles.addOptionLabel}>+ Add option</Text>
        </Pressable>
      )}

      <Text style={styles.label}>DURATION</Text>
      <View style={styles.chipsRow}>
        {DURATIONS.map((item) => {
          const active = durationDays === item.days;
          return (
            <Pressable
              key={item.label}
              onPress={() => setDurationDays(item.days)}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.launchButton, { backgroundColor: canLaunch ? Colors.green500 : '#DDD8C8' }]}
        onPress={handleLaunch}
        disabled={!canLaunch || createPoll.isPending}
        accessibilityRole="button"
        accessibilityLabel="Launch poll">
        {createPoll.isPending && <ActivityIndicator size="small" color="#fff" />}
        <Text style={[styles.launchLabel, { color: canLaunch ? Colors.textOnDark : '#9B9682' }]}>Launch poll</Text>
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
    borderRadius: Radius.input,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontSize: 15.5,
    color: Colors.textPrimary,
  },
  textarea: { marginTop: 8, minHeight: 80 },
  optionsList: { gap: 9, marginTop: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  optionInput: { flex: 1 },
  removeButton: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 12,
    backgroundColor: '#F0E7E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  validationError: { marginTop: 8, fontSize: 12.5, color: Colors.danger700 },
  addOptionLabel: { marginTop: 10, fontSize: 13.5, fontWeight: '700', color: Colors.success700 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 14, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 14, fontWeight: '600', color: '#3E4A40' },
  launchButton: {
    marginTop: 30,
    height: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  launchLabel: { fontSize: 15.5, fontWeight: '700' },
});

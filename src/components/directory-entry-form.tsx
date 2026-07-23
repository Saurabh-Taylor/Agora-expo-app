import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { getErrorMessage, isValidDirectoryPhone } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { useProfile } from '@/features/profile/api';
import {
  useSaveServiceProvider,
  useSaveStaff,
  useServiceProviderDetail,
  useStaffDetail,
} from '@/features/staff/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';
import {
  Colors,
  FontFamily,
  Radius,
  ServiceProviderCategories,
  StaffRoles,
  StaffShifts,
} from '@/constants/commonConstants';

export type DirectoryEntryFormValue = {
  name: string;
  classification: string;
  shift: string;
  phone: string;
};

type DirectoryEntryFormProps = {
  kind: 'staff' | 'provider';
  title: string;
  submitLabel: string;
  initialValue?: DirectoryEntryFormValue;
  isPending: boolean;
  onBack: () => void;
  onSubmit: (value: DirectoryEntryFormValue) => Promise<void>;
};

export function DirectoryEntryForm({
  kind,
  title,
  submitLabel,
  initialValue,
  isPending,
  onBack,
  onSubmit,
}: DirectoryEntryFormProps) {
  const classifications = kind === 'staff' ? StaffRoles : ServiceProviderCategories;
  const [name, setName] = useState(initialValue?.name ?? '');
  const [classification, setClassification] = useState(initialValue?.classification ?? classifications[0]);
  const [shift, setShift] = useState(initialValue?.shift ?? StaffShifts[0]);
  const [phone, setPhone] = useState(initialValue?.phone ?? '');
  const phoneIsValid = isValidDirectoryPhone(phone);
  const canSave = name.trim().length >= 2 && classification.trim().length >= 2 && phoneIsValid && !isPending;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.headerRow}>
          <BackArrowButton onPress={onBack} />
          <Text style={styles.title}>{title}</Text>
        </View>

        <Text style={styles.label}>NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={kind === 'staff' ? 'e.g. Rajesh Kumar' : 'e.g. Sharma Plumbing Works'}
          placeholderTextColor={Colors.textFaint}
          style={styles.input}
          autoCapitalize="words"
          maxLength={80}
          accessibilityLabel="Name"
        />

        <Text style={styles.label}>{kind === 'staff' ? 'ROLE' : 'CATEGORY'}</Text>
        <View style={styles.chipsRow}>
          {classifications.map((item) => {
            const active = classification === item;
            return (
              <Pressable
                key={item}
                onPress={() => setClassification(item)}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}>
                <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        {kind === 'staff' && (
          <>
            <Text style={styles.label}>SHIFT</Text>
            <View style={styles.chipsRow}>
              {StaffShifts.map((item) => {
                const active = shift === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setShift(item)}
                    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}>
                    <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.label}>PHONE (OPTIONAL)</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 98765 43210"
          placeholderTextColor={Colors.textFaint}
          keyboardType="phone-pad"
          style={[styles.input, !phoneIsValid && styles.inputError]}
          maxLength={20}
          accessibilityLabel="Phone number"
        />
        {!phoneIsValid && <Text style={styles.errorText}>Enter at least 7 phone-number characters.</Text>}

        <Pressable
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={() => void onSubmit({ name: name.trim(), classification, shift, phone: phone.trim() })}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave, busy: isPending }}>
          {isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
          <Text style={[styles.saveLabel, !canSave && styles.saveLabelDisabled]}>{submitLabel}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type DirectoryEntryFormScreenProps = {
  kind: 'staff' | 'provider';
  id?: string;
};

export function DirectoryEntryFormScreen({ kind, id }: DirectoryEntryFormScreenProps) {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const staffQuery = useStaffDetail(kind === 'staff' ? id : undefined, societyId);
  const providerQuery = useServiceProviderDetail(kind === 'provider' ? id : undefined, societyId);
  const saveStaff = useSaveStaff();
  const saveProvider = useSaveServiceProvider();
  const isEditing = !!id;
  const detailQuery = kind === 'staff' ? staffQuery : providerQuery;
  const record = detailQuery.data;
  const isPending = saveStaff.isPending || saveProvider.isPending;

  if (profileQuery.isLoading || (isEditing && detailQuery.isLoading) || profileQuery.isError || (isEditing && detailQuery.isError) || (isEditing && !record)) {
    return (
      <View style={styles.stateScreen}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={profileQuery.isLoading || detailQuery.isLoading}
          isError={profileQuery.isError || detailQuery.isError}
          onRetry={() => {
            profileQuery.refetch();
            detailQuery.refetch();
          }}
          isEmpty={isEditing && !profileQuery.isLoading && !detailQuery.isLoading && !profileQuery.isError && !detailQuery.isError && !record}
          emptyMessage="This directory entry isn't available."
        />
      </View>
    );
  }

  const initialValue: DirectoryEntryFormValue | undefined = record
    ? {
        name: record.name,
        classification: kind === 'staff' && 'role' in record ? record.role : 'category' in record ? record.category : '',
        shift: kind === 'staff' && 'shift' in record ? record.shift ?? StaffShifts[0] : StaffShifts[0],
        phone: record.phone ?? '',
      }
    : undefined;

  async function handleSubmit(value: DirectoryEntryFormValue) {
    if (!societyId) return;
    try {
      if (kind === 'staff') {
        await saveStaff.mutateAsync({
          id,
          societyId,
          name: value.name,
          role: value.classification,
          shift: value.shift,
          phone: value.phone,
        });
      } else {
        await saveProvider.mutateAsync({
          id,
          societyId,
          name: value.name,
          category: value.classification,
          phone: value.phone,
        });
      }
      showToast(isEditing ? 'Directory entry updated' : 'Directory entry added');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not save this directory entry'));
    }
  }

  const subject = kind === 'staff' ? 'staff member' : 'service provider';
  return (
    <DirectoryEntryForm
      kind={kind}
      title={`${isEditing ? 'Edit' : 'Add'} ${subject}`}
      submitLabel={`${isEditing ? 'Save' : 'Add'} ${subject}`}
      initialValue={initialValue}
      isPending={isPending}
      onBack={() => router.back()}
      onSubmit={handleSubmit}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  stateScreen: { flex: 1, backgroundColor: Colors.adminCanvas, paddingHorizontal: 20 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 22 },
  input: {
    minHeight: 52,
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
  inputError: { borderColor: Colors.danger500 },
  errorText: { marginTop: 6, fontSize: 12.5, color: Colors.danger700 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { minHeight: 44, paddingVertical: 11, paddingHorizontal: 16, borderRadius: Radius.pill, borderWidth: 1.5, justifyContent: 'center' },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 14, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 14, fontWeight: '600', color: '#3E4A40' },
  saveButton: {
    minHeight: 54,
    marginTop: 30,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  saveButtonDisabled: { backgroundColor: '#DDD8C8' },
  saveLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.textOnDark },
  saveLabelDisabled: { color: '#9B9682' },
});

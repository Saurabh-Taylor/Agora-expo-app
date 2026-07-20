import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatCurrency, formatDate } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useDueDetail, usePayMaintenanceDue } from '@/features/dues/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

const PAY_METHODS = ['UPI', 'Card', 'Netbanking', 'Wallet'];

export default function PayDueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const dueQuery = useDueDetail(id, profileQuery.data?.flat_id, profileQuery.data?.society_id);
  const createPayment = usePayMaintenanceDue();

  const [method, setMethod] = useState(PAY_METHODS[0]);

  const due = dueQuery.data;
  const canPay = !!due && due.status === 'UNPAID' && !!profileQuery.data?.flat_id;

  async function handlePay() {
    if (!canPay || !due || !profileQuery.data?.flat_id) return;
    try {
      const payment = await createPayment.mutateAsync({
        dueId: due.id,
        societyId: profileQuery.data.society_id,
        flatId: profileQuery.data.flat_id,
        method,
      });
      router.replace({
        pathname: '/(resident)/payment-success',
        params: {
          amount: String(due.amount),
          method,
          receiptNo: payment.receipt_no,
          quarterLabel: due.quarter_label,
        },
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not complete this payment');
    }
  }

  if (!due) {
    return (
      <View style={styles.root}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={profileQuery.isLoading || dueQuery.isLoading}
          isError={profileQuery.isError || dueQuery.isError}
          onRetry={() => { profileQuery.refetch(); dueQuery.refetch(); }}
          isEmpty={!profileQuery.isLoading && !dueQuery.isLoading && !profileQuery.isError && !dueQuery.isError}
          emptyMessage="This due isn't available."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Confirm payment</Text>
      </View>

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>{due.quarter_label}</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(due.amount)}</Text>
        </View>
        <Text style={styles.summaryDue}>Due {formatDate(due.due_date)}</Text>
      </View>

      <Text style={styles.label}>PAY WITH</Text>
      <View style={styles.chipsRow}>
        {PAY_METHODS.map((item) => {
          const active = method === item;
          return (
            <Pressable key={item} onPress={() => setMethod(item)} style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
              <Text style={active ? styles.chipLabelActive : styles.chipLabelInactive}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>You&apos;ll be redirected to {method} to authorise. The receipt posts to the society ledger instantly.</Text>

      <Pressable
        style={[styles.payButton, { opacity: canPay ? 1 : 0.5 }]}
        onPress={handlePay}
        disabled={!canPay || createPayment.isPending}>
        {createPayment.isPending && <ActivityIndicator size="small" color={Colors.textOnDark} />}
        <Text style={styles.payButtonLabel}>{createPayment.isPending ? 'Processing…' : `Pay ${formatCurrency(due.amount)}`}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  summaryCard: {
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.cardLarge - 4,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: { fontSize: 13, color: Colors.textMuted },
  summaryAmount: { fontFamily: FontFamily.headingExtraBold, fontSize: 28, marginTop: 4 },
  summaryDue: { fontSize: 12, color: Colors.textFaint },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: Colors.textMutedAlt, marginTop: 24 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingVertical: 12, paddingHorizontal: 17, borderRadius: 999, borderWidth: 1.5 },
  chipActive: { backgroundColor: Colors.green500, borderColor: Colors.green500 },
  chipInactive: { backgroundColor: Colors.surface, borderColor: Colors.borderAlt },
  chipLabelActive: { fontSize: 14, fontWeight: '600', color: Colors.textOnDark },
  chipLabelInactive: { fontSize: 14, fontWeight: '600', color: '#3E4A40' },
  hint: { fontSize: 12.5, color: Colors.textMuted, marginTop: 16, lineHeight: 19 },
  payButton: {
    marginTop: 'auto',
    height: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: Colors.green500,
  },
  payButtonLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.textOnDark },
});

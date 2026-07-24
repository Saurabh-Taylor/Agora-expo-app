import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatCurrency, formatDate } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius, RAZORPAY_RETURN_URL, RAZORPAY_TEST_LABEL } from '@/constants/commonConstants';
import { useCreateRazorpayOrder, useDueDetail, useVerifyRazorpayPayment } from '@/features/dues/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

export default function PayDueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const dueQuery = useDueDetail(id, profileQuery.data?.flat_id, profileQuery.data?.society_id);
  const createOrder = useCreateRazorpayOrder();
  const verifyPayment = useVerifyRazorpayPayment();

  const due = dueQuery.data;
  const canPay = !!due && due.status === 'UNPAID' && !due.cancelled_at && !!profileQuery.data?.flat_id;
  const isProcessing = createOrder.isPending || verifyPayment.isPending;

  async function handlePay() {
    if (!canPay || !due || !profileQuery.data?.flat_id) return;
    try {
      const checkout = await createOrder.mutateAsync({
        dueId: due.id,
        societyId: profileQuery.data.society_id,
        flatId: profileQuery.data.flat_id,
      });
      const result = await WebBrowser.openAuthSessionAsync(checkout.checkoutUrl, RAZORPAY_RETURN_URL);
      if (result.type !== 'success' || !result.url) {
        showToast('Payment cancelled. Your maintenance due is unchanged.');
        return;
      }
      const responseUrl = new URL(result.url);
      if (responseUrl.searchParams.get('status') !== 'success') {
        showToast('Payment cancelled. Your maintenance due is unchanged.');
        return;
      }
      const attemptId = responseUrl.searchParams.get('attempt');
      const razorpayOrderId = responseUrl.searchParams.get('order');
      const razorpayPaymentId = responseUrl.searchParams.get('payment');
      const razorpaySignature = responseUrl.searchParams.get('signature');
      if (!attemptId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new Error('Razorpay returned incomplete verification details');
      }
      if (attemptId !== checkout.attemptId) {
        throw new Error('Razorpay returned a different payment session');
      }
      const payment = await verifyPayment.mutateAsync({
        dueId: due.id,
        societyId: profileQuery.data.society_id,
        flatId: profileQuery.data.flat_id,
        attemptId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      router.replace({
        pathname: '/(resident)/payment-success',
        params: {
          amount: String(due.amount),
          method: RAZORPAY_TEST_LABEL,
          receiptNo: payment.receipt_no,
          quarterLabel: due.quarter_label,
        },
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not complete Razorpay payment');
    }
  }

  if (!due) {
    return (
      <View style={styles.root}>
        <BackArrowButton onPress={() => router.back()} />
        <AsyncState
          isLoading={profileQuery.isLoading || dueQuery.isLoading}
          isError={profileQuery.isError || dueQuery.isError}
          onRetry={() => {
            profileQuery.refetch();
            dueQuery.refetch();
          }}
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
        <Text style={styles.title}>Pay maintenance</Text>
      </View>

      <View style={styles.demoBanner} accessibilityRole="summary">
        <Text style={styles.demoOverline}>TEST MODE  -  NO REAL MONEY</Text>
        <Text style={styles.demoText}>
          Razorpay&apos;s real sandbox checkout is used. Test payment instruments only; no real money is transferred.
        </Text>
      </View>

      {due.cancelled_at && (
        <View style={styles.cancelledBanner} accessibilityRole="alert">
          <Text style={styles.cancelledTitle}>This invoice was cancelled</Text>
          <Text style={styles.cancelledText}>{due.cancel_reason ?? 'Contact the society office for details.'}</Text>
        </View>
      )}

      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>{due.quarter_label}</Text>
          <Text style={styles.summaryAmount}>{formatCurrency(due.amount)}</Text>
        </View>
        <Text style={styles.summaryDue}>Due {formatDate(due.due_date)}</Text>
      </View>

      <View style={styles.gatewayCard}>
        <View style={styles.gatewayMark}>
          <Text style={styles.gatewayMarkLabel}>R</Text>
        </View>
        <View style={styles.gatewayCopy}>
          <Text style={styles.gatewayTitle}>Razorpay Standard Checkout</Text>
          <Text style={styles.gatewaySubtitle}>A secure Test Mode checkout opens, then Agora verifies the signed payment server-side.</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Pay ${formatCurrency(due.amount)} using Razorpay Test Mode`}
        accessibilityState={{ disabled: !canPay || isProcessing, busy: isProcessing }}
        style={[styles.payButton, { opacity: canPay ? 1 : 0.5 }]}
        onPress={handlePay}
        disabled={!canPay || isProcessing}>
        {isProcessing && <ActivityIndicator size="small" color={Colors.textOnDark} />}
        <Text style={styles.payButtonLabel}>
          {createOrder.isPending
            ? 'Creating secure order...'
            : verifyPayment.isPending
              ? 'Verifying payment...'
              : `Pay in Test Mode  -  ${formatCurrency(due.amount)}`}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  content: { paddingTop: 66, paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  demoBanner: {
    marginTop: 20,
    padding: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#E6B85C',
    backgroundColor: '#FFF6DF',
  },
  demoOverline: { fontSize: 10.5, letterSpacing: 1.4, fontWeight: '800', color: '#8A5A00' },
  demoText: { marginTop: 7, fontSize: 13, lineHeight: 19, color: '#684B16' },
  cancelledBanner: { marginTop: 14, padding: 14, borderRadius: Radius.card, backgroundColor: '#F9E4E1' },
  cancelledTitle: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.danger700 },
  cancelledText: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: Colors.danger700 },
  summaryCard: {
    marginTop: 14,
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
  gatewayCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gatewayMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2B55D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatewayMarkLabel: { color: Colors.surface, fontSize: 23, fontWeight: '800' },
  gatewayCopy: { flex: 1 },
  gatewayTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  gatewaySubtitle: { marginTop: 3, fontSize: 12, lineHeight: 17, color: Colors.textMuted },
  payButton: {
    marginTop: 'auto',
    minHeight: 54,
    borderRadius: Radius.card - 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.green500,
  },
  payButtonLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.textOnDark, textAlign: 'center' },
});

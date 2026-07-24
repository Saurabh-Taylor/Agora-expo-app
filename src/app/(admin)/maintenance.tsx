import * as FileSystem from 'expo-file-system/legacy';
import { router, type Href } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { createCsv, formatCurrency, formatDate, getErrorMessage, getMaintenanceDueDisplayStatus } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { StatusPill } from '@/components/status-pill';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import {
  useAdminMaintenanceInvoices,
  useAdminMaintenancePayments,
  useCancelMaintenanceInvoice,
  useSendMaintenanceReminder,
} from '@/features/maintenance/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';
import { showToast } from '@/stores/toast-store';

type MaintenanceTab = 'Invoices' | 'Payments';

export default function AdminMaintenanceScreen() {
  const [tab, setTab] = useState<MaintenanceTab>('Invoices');
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const societyId = profileQuery.data?.society_id;
  const invoicesQuery = useAdminMaintenanceInvoices(societyId);
  const paymentsQuery = useAdminMaintenancePayments(societyId);
  const sendReminder = useSendMaintenanceReminder();
  const cancelInvoice = useCancelMaintenanceInvoice();
  const [invoiceToCancel, setInvoiceToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const invoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);
  const payments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);

  const totals = useMemo(() => {
    const invoiced = invoices.filter((invoice) => getMaintenanceDueDisplayStatus(invoice) !== 'CANCELLED').reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const outstanding = invoices
      .filter((invoice) => getMaintenanceDueDisplayStatus(invoice) === 'UNPAID')
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const collected = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    return { invoiced, outstanding, collected };
  }, [invoices, payments]);

  async function handleReminder(dueId: string) {
    try {
      const sent = await sendReminder.mutateAsync({ dueId });
      const message = sent > 0
        ? ['Reminder sent to ', sent, sent === 1 ? ' device' : ' devices'].join('')
        : 'No enabled notification devices for this flat';
      showToast(message);
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not send the reminder'));
    }
  }

  async function exportReport() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) {
        throw new Error('File sharing is not available on this device');
      }

      const rows: (string | number)[][] = [
        ['Record type', 'Period', 'Flat', 'Date', 'Amount', 'Status or method', 'Reference or reason', 'Resident'],
        ...invoices.map((invoice) => [
          'INVOICE',
          invoice.quarter_label,
          [invoice.flat?.tower?.code ?? '?', '-', invoice.flat?.number ?? '?'].join(''),
          invoice.due_date,
          Number(invoice.amount),
          getMaintenanceDueDisplayStatus(invoice),
          invoice.cancel_reason ?? '',
          '',
        ]),
        ...payments.map((payment) => [
          'PAYMENT',
          payment.due?.quarter_label ?? 'Maintenance payment',
          [payment.flat?.tower?.code ?? '?', '-', payment.flat?.number ?? '?'].join(''),
          payment.paid_at,
          Number(payment.amount),
          payment.method,
          payment.receipt_no,
          payment.payer?.full_name ?? 'Resident',
        ]),
      ];
      const fileUri = FileSystem.cacheDirectory + 'agora-maintenance-report-' + Date.now() + '.csv';
      await FileSystem.writeAsStringAsync(fileUri, createCsv(rows), { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, {
        dialogTitle: 'Share Agora maintenance report',
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (error) {
      showToast(getErrorMessage(error, 'Could not export the maintenance report'));
    } finally {
      setIsExporting(false);
    }
  }

  function openCancelDialog(dueId: string) {
    setInvoiceToCancel(dueId);
    setCancelReason('');
    setCancelError(null);
  }

  function closeCancelDialog() {
    if (cancelInvoice.isPending) return;
    setInvoiceToCancel(null);
    setCancelReason('');
    setCancelError(null);
  }

  async function handleCancelInvoice() {
    if (!invoiceToCancel || !societyId || cancelReason.trim().length < 4) {
      setCancelError('Enter a clear cancellation reason');
      return;
    }

    try {
      await cancelInvoice.mutateAsync({ dueId: invoiceToCancel, societyId, reason: cancelReason });
      showToast('Maintenance invoice cancelled');
      setInvoiceToCancel(null);
      setCancelReason('');
      setCancelError(null);
    } catch (error) {
      setCancelError(getErrorMessage(error, 'Could not cancel the invoice'));
    }
  }

  const activeQuery = tab === 'Invoices' ? invoicesQuery : paymentsQuery;
  const activeRecords = tab === 'Invoices' ? invoices : payments;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text accessibilityRole="header" style={styles.title}>Maintenance billing</Text>
      </View>
      <Text style={styles.subtitle}>Create invoices and track the society demo ledger.</Text>

      <View style={styles.metricRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>INVOICED</Text>
          <Text style={styles.metricValue}>{formatCurrency(totals.invoiced)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>COLLECTED</Text>
          <Text style={[styles.metricValue, styles.collected]}>{formatCurrency(totals.collected)}</Text>
        </View>
      </View>
      <View style={styles.outstandingCard}>
        <Text style={styles.outstandingLabel}>Outstanding</Text>
        <Text style={styles.outstandingValue}>{formatCurrency(totals.outstanding)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: isExporting, disabled: isExporting }}
        disabled={isExporting}
        onPress={() => void exportReport()}
        style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}>
        {isExporting && <ActivityIndicator color={Colors.green500} size="small" />}
        <Text style={styles.exportButtonLabel}>
          {isExporting ? "Preparing CSV..." : "Export CSV report"}
        </Text>
      </Pressable>

      <View style={styles.segmented}>
        {(['Invoices', 'Payments'] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            onPress={() => setTab(item)}
            style={[styles.segment, tab === item && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, tab === item && styles.segmentLabelActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.list}>
        <AsyncState
          isLoading={profileQuery.isLoading || activeQuery.isLoading}
          isError={profileQuery.isError || activeQuery.isError}
          isRetrying={profileQuery.isRefetching || activeQuery.isRefetching}
          onRetry={() => {
            profileQuery.refetch();
            activeQuery.refetch();
          }}
          isEmpty={activeRecords.length === 0}
          emptyTitle={tab === 'Invoices' ? 'No invoices yet' : 'No payments yet'}
          emptyMessage={
            tab === 'Invoices'
              ? 'Create invoices for selected flats or the entire society.'
              : 'Verified resident payment records will appear here.'
          }
          actionLabel={tab === 'Invoices' ? 'Create invoices' : undefined}
          onAction={tab === 'Invoices' ? () => router.push('/(admin)/add-maintenance' as Href) : undefined}
        />

        {tab === 'Invoices' &&
          invoices.map((invoice) => (
            <View key={invoice.id} style={styles.card}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{invoice.quarter_label}</Text>
                <Text style={styles.cardMeta}>
                  {invoice.flat?.tower?.code ?? '?'}-{invoice.flat?.number ?? '?'}  -  Due {formatDate(invoice.due_date)}
                </Text>
                {invoice.cancelled_at && invoice.cancel_reason && (
                  <Text style={styles.invoiceCancelReason} numberOfLines={2}>{invoice.cancel_reason}</Text>
                )}
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardAmount}>{formatCurrency(invoice.amount)}</Text>
                <StatusPill
                  label={getMaintenanceDueDisplayStatus(invoice) === 'PAID' ? 'Paid' : getMaintenanceDueDisplayStatus(invoice) === 'CANCELLED' ? 'Cancelled' : 'Unpaid'}
                  color={getMaintenanceDueDisplayStatus(invoice) === 'PAID' ? Colors.success600 : getMaintenanceDueDisplayStatus(invoice) === 'CANCELLED' ? Colors.danger700 : '#8A5A00'}
                  backgroundColor={getMaintenanceDueDisplayStatus(invoice) === 'PAID' ? Colors.categorySecurity.bg : getMaintenanceDueDisplayStatus(invoice) === 'CANCELLED' ? '#F9E4E1' : Colors.categoryBilling.bg}
                />
                {getMaintenanceDueDisplayStatus(invoice) === 'UNPAID' && (
                  <Pressable
                    accessibilityRole='button'
                    disabled={sendReminder.isPending}
                    style={[styles.reminderButton, sendReminder.isPending && styles.reminderButtonDisabled]}
                    onPress={() => void handleReminder(invoice.id)}>
                    <Text style={styles.reminderButtonLabel}>
                      {sendReminder.isPending && sendReminder.variables?.dueId === invoice.id ? 'Sending...' : 'Remind'}
                    </Text>
                  </Pressable>
                )}
                {getMaintenanceDueDisplayStatus(invoice) === 'UNPAID' && (
                  <Pressable
                    accessibilityRole='button'
                    disabled={cancelInvoice.isPending}
                    style={styles.cancelInvoiceButton}
                    onPress={() => openCancelDialog(invoice.id)}>
                    <Text style={styles.cancelInvoiceLabel}>Cancel</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}

        {tab === 'Payments' &&
          payments.map((payment) => (
            <View key={payment.id} style={styles.card}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{payment.due?.quarter_label ?? 'Maintenance payment'}</Text>
                <Text style={styles.cardMeta}>
                  {payment.flat?.tower?.code ?? '?'}-{payment.flat?.number ?? '?'}  -  {payment.payer?.full_name ?? 'Resident'}
                </Text>
                <Text style={styles.demoReference}>{payment.receipt_no}</Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.cardAmount}>{formatCurrency(payment.amount)}</Text>
                <StatusPill
                  label={payment.gateway === 'RAZORPAY' && payment.is_test ? 'Razorpay Test' : payment.method}
                  color="#8A5A00"
                  backgroundColor={Colors.categoryBilling.bg}
                />
              </View>
            </View>
          ))}

        {tab === 'Invoices' && invoices.length > 0 && (
          <Pressable
            accessibilityRole="button"
            style={styles.addButton}
            onPress={() => router.push('/(admin)/add-maintenance' as Href)}>
            <Text style={styles.addButtonLabel}>+ Create maintenance invoices</Text>
          </Pressable>
        )}
      </View>
      <ConfirmationDialog
        visible={!!invoiceToCancel}
        icon={<Text style={styles.cancelDialogIcon}>!</Text>}
        title='Cancel this invoice?'
        message='The resident will see it as cancelled and it can no longer be paid.'
        confirmLabel='Cancel invoice'
        isPending={cancelInvoice.isPending}
        errorMessage={cancelError}
        onCancel={closeCancelDialog}
        onConfirm={() => void handleCancelInvoice()}>
        <TextInput
          value={cancelReason}
          onChangeText={setCancelReason}
          placeholder='Reason, for example duplicate invoice'
          placeholderTextColor={Colors.textFaint}
          maxLength={160}
          multiline
          style={styles.cancelReasonInput}
          accessibilityLabel='Invoice cancellation reason'
        />
      </ConfirmationDialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  flex: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: FontFamily.headingExtraBold, fontSize: 22, color: Colors.textPrimary },
  subtitle: { marginTop: 8, marginLeft: 48, fontSize: 13, color: Colors.textMuted },
  metricRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  metricCard: {
    flex: 1,
    minHeight: 90,
    padding: 14,
    borderRadius: Radius.card - 2,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  metricLabel: { fontSize: 10.5, letterSpacing: 1.1, fontWeight: '700', color: Colors.textMutedAlt },
  metricValue: { marginTop: 8, fontFamily: FontFamily.headingBold, fontSize: 20, color: Colors.textPrimary },
  collected: { color: Colors.success700 },
  outstandingCard: {
    marginTop: 10,
    minHeight: 50,
    paddingHorizontal: 15,
    borderRadius: Radius.input,
    backgroundColor: Colors.categoryBilling.bg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  outstandingLabel: { fontSize: 13, fontWeight: '700', color: '#8A5A00' },
  outstandingValue: { fontFamily: FontFamily.headingBold, fontSize: 17, color: '#8A5A00' },
  exportButton: {
    minHeight: 48,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.green500,
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
  },
  exportButtonDisabled: { opacity: 0.6 },
  exportButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14, color: Colors.green500 },
  segmented: { flexDirection: 'row', backgroundColor: '#EBE6D8', borderRadius: 14, padding: 4, marginTop: 18 },
  segment: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: Colors.green500 },
  segmentLabel: { fontSize: 14, fontWeight: '700', color: Colors.textMuted },
  segmentLabelActive: { color: Colors.textOnDark },
  list: { gap: 10, marginTop: 12 },
  card: {
    minHeight: 78,
    padding: 14,
    borderRadius: Radius.card - 2,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  cardMeta: { marginTop: 3, fontSize: 12.5, color: Colors.textMuted },
  invoiceCancelReason: { maxWidth: 220, marginTop: 4, fontSize: 11.5, lineHeight: 16, color: Colors.danger700 },
  demoReference: { marginTop: 3, fontSize: 10.5, color: Colors.textFaint },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  reminderButton: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderButtonDisabled: { opacity: 0.6 },
  reminderButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: Colors.green500 },
  cancelInvoiceButton: { minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center' },
  cancelInvoiceLabel: { fontFamily: FontFamily.bodyBold, fontSize: 12, color: Colors.danger700 },
  cancelDialogIcon: { fontFamily: FontFamily.headingExtraBold, fontSize: 24, color: Colors.textOnDark },
  cancelReasonInput: {
    width: '100%',
    minHeight: 88,
    marginTop: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    borderRadius: Radius.input,
    backgroundColor: Colors.adminCanvas,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
  cardAmount: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  addButton: {
    minHeight: 52,
    marginTop: 6,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: '#C9BE9F',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  addButtonLabel: { fontSize: 14.5, fontWeight: '700', color: Colors.success700 },
});

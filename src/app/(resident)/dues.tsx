import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatCurrency, formatDate } from '@/commonFunctions';
import { AsyncState } from '@/components/async-state';
import { BackArrowButton } from '@/components/icons/back-arrow-button';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { useDuesRealtimeSync, useFlatDues } from '@/features/dues/api';
import { useFlatWithTower } from '@/features/flats/api';
import { useProfile } from '@/features/profile/api';
import { useAuthStore } from '@/stores/auth-store';

function CheckCircleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 12.5l5 5L19.5 7" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function DuesScreen() {
  const session = useAuthStore((state) => state.session);
  const profileQuery = useProfile(session?.user.id);
  const flatQuery = useFlatWithTower(profileQuery.data?.flat_id, profileQuery.data?.society_id);
  const duesQuery = useFlatDues(profileQuery.data?.flat_id, profileQuery.data?.society_id);

  useDuesRealtimeSync(profileQuery.data?.flat_id, profileQuery.data?.society_id);

  const dues = duesQuery.data ?? [];
  const unpaid = dues.filter((d) => d.status === 'UNPAID').sort((a, b) => a.due_date.localeCompare(b.due_date));
  const currentDue = unpaid[0];
  const history = dues.filter((d) => d.id !== currentDue?.id);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BackArrowButton onPress={() => router.back()} />
        <Text style={styles.title}>Maintenance</Text>
      </View>
      {!!flatQuery.data && (
        <Text style={styles.subtitle}>
          {flatQuery.data.tower ? `${flatQuery.data.tower.code}-${flatQuery.data.number} · ${flatQuery.data.tower.name}` : flatQuery.data.number}
        </Text>
      )}

      <AsyncState
        isLoading={profileQuery.isLoading || flatQuery.isLoading || duesQuery.isLoading}
        isError={profileQuery.isError || flatQuery.isError || duesQuery.isError}
        onRetry={() => { profileQuery.refetch(); flatQuery.refetch(); duesQuery.refetch(); }}
        isEmpty={dues.length === 0}
        emptySymbol={null}
        emptyTitle="No maintenance dues"
        emptyMessage="Your society has not added any maintenance dues for this flat yet."
      />

      {currentDue && (
        <View style={styles.dueCard}>
          <Text style={styles.dueOverline}>{currentDue.quarter_label.toUpperCase()}</Text>
          <Text style={styles.dueAmount}>{formatCurrency(currentDue.amount)}</Text>
          <Text style={styles.dueMeta}>Due by {formatDate(currentDue.due_date)}</Text>
          <Pressable style={styles.payButton} onPress={() => router.push(`/(resident)/pay-due/${currentDue.id}`)}>
            <Text style={styles.payButtonLabel}>Pay now</Text>
          </Pressable>
        </View>
      )}

      {!currentDue && dues.length > 0 && (
        <View style={styles.clearedCard}>
          <View style={styles.clearedIconWrap}>
            <CheckCircleIcon />
          </View>
          <View style={styles.flex}>
            <Text style={styles.clearedTitle}>All dues cleared</Text>
            <Text style={styles.clearedSub}>You&apos;re all caught up on maintenance.</Text>
          </View>
        </View>
      )}

      {history.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Payment history</Text>
          <View style={styles.list}>
            {history.map((due) => (
              <View key={due.id} style={styles.historyCard}>
                <View>
                  <Text style={styles.historyLabel}>{due.quarter_label}</Text>
                  <Text style={styles.historySub}>Due {formatDate(due.due_date)}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyAmount}>{formatCurrency(due.amount)}</Text>
                  <View style={[styles.statusPill, due.status === 'PAID' ? styles.statusPillPaid : styles.statusPillUnpaid]}>
                    <Text style={[styles.statusPillLabel, due.status === 'PAID' ? styles.statusPillLabelPaid : styles.statusPillLabelUnpaid]}>
                      {due.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas },
  flex: { flex: 1 },
  content: { paddingTop: 66, paddingHorizontal: 16, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 22 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 8, marginLeft: 48 },
  dueCard: { marginTop: 16, backgroundColor: Colors.green500, borderRadius: Radius.cardLarge, padding: 20 },
  dueOverline: { fontSize: 10.5, letterSpacing: 2, fontWeight: '700', color: Colors.gold },
  dueAmount: { fontFamily: FontFamily.headingExtraBold, fontSize: 38, color: Colors.textOnDark, marginTop: 10 },
  dueMeta: { fontSize: 13, color: 'rgba(247,244,236,0.65)', marginTop: 4 },
  payButton: { marginTop: 18, height: 50, borderRadius: Radius.button, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  payButtonLabel: { fontSize: 15, fontWeight: '700', color: Colors.green500 },
  clearedCard: {
    marginTop: 16,
    backgroundColor: '#E3F2E9',
    borderWidth: 1,
    borderColor: '#BFE0CE',
    borderRadius: Radius.cardLarge,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  clearedIconWrap: { width: 44, height: 44, borderRadius: 999, backgroundColor: Colors.success600, alignItems: 'center', justifyContent: 'center' },
  clearedTitle: { fontSize: 16, fontWeight: '700', color: '#14532D' },
  clearedSub: { fontSize: 13, color: '#3E6B50', marginTop: 2 },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: 17, marginTop: 26 },
  list: { gap: 10, marginTop: 12 },
  historyCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.card - 2,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyLabel: { fontSize: 14.5, fontWeight: '600' },
  historySub: { fontSize: 12.5, color: Colors.textMuted, marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historyAmount: { fontSize: 14.5, fontWeight: '700' },
  statusPill: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, marginTop: 3 },
  statusPillPaid: { backgroundColor: '#E3F2E9' },
  statusPillUnpaid: { backgroundColor: '#F6ECD8' },
  statusPillLabel: { fontSize: 10.5, fontWeight: '700' },
  statusPillLabelPaid: { color: Colors.success600 },
  statusPillLabelUnpaid: { color: '#9A6B14' },
});

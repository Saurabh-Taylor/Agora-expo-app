import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors, FontFamily } from '@/constants/commonConstants';

function CheckIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 12.5l5 5L19.5 7" stroke={Colors.success400} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function PaymentSuccessScreen() {
  const { amount, method, receiptNo, quarterLabel } = useLocalSearchParams<{
    amount: string;
    method: string;
    receiptNo: string;
    quarterLabel: string;
  }>();

  const amountNumber = Number(amount) || 0;

  return (
    <View style={styles.root}>
      <View style={styles.spacerTop} />
      <View style={styles.iconWrap}>
        <CheckIcon />
      </View>
      <Text style={styles.title}>{formatCurrency(amountNumber)} paid</Text>
      <Text style={styles.subtitle}>{quarterLabel} maintenance cleared</Text>

      <View style={styles.receiptCard}>
        <Text style={styles.receiptOverline}>RECEIPT</Text>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptKey}>Receipt no.</Text>
          <Text style={styles.receiptValue}>{receiptNo}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptKey}>Paid via</Text>
          <Text style={styles.receiptValue}>{method}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptKey}>Date</Text>
          <Text style={styles.receiptValue}>{new Date().toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptKey}>Period</Text>
          <Text style={styles.receiptValue}>{quarterLabel}</Text>
        </View>
      </View>

      <View style={styles.spacerBottom} />
      <Pressable style={styles.doneButton} onPress={() => router.replace('/(resident)/dues')}>
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F2C1F',
    paddingTop: 78,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  spacerTop: { flex: 0.7 },
  spacerBottom: { flex: 1 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 999,
    backgroundColor: 'rgba(31,157,92,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 25, color: Colors.textOnDark, marginTop: 20 },
  subtitle: { fontSize: 13.5, color: 'rgba(247,244,236,0.6)', marginTop: 6 },
  receiptCard: {
    width: '100%',
    marginTop: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(231,163,60,0.55)',
    borderStyle: 'dashed',
    borderRadius: 22,
    padding: 20,
    backgroundColor: 'rgba(231,163,60,0.06)',
  },
  receiptOverline: { fontSize: 10.5, letterSpacing: 3, fontWeight: '700', color: Colors.gold },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  receiptKey: { fontSize: 13.5, color: 'rgba(247,244,236,0.6)' },
  receiptValue: { fontSize: 13.5, fontWeight: '700', color: Colors.textOnDark },
  doneButton: {
    width: '100%',
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
  },
  doneLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.green500 },
});

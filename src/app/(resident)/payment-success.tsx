import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatCurrency } from '@/commonFunctions';
import { Colors, FontFamily } from '@/constants/commonConstants';

function CheckIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path d="M4.5 12.5l5 5L19.5 7" stroke={Colors.success400} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
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
      <Text accessibilityRole="header" style={styles.title}>Payment verified</Text>
      <Text style={styles.amount}>{formatCurrency(amountNumber)}</Text>
      <Text style={styles.subtitle}>Razorpay Test Mode confirmed the payment. No real money was transferred.</Text>

      <View style={styles.receiptCard}>
        <Text style={styles.receiptOverline}>TEST MODE RECEIPT  -  NOT PROOF OF PAYMENT</Text>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptKey}>Receipt reference</Text>
          <Text style={styles.receiptValue}>{receiptNo}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptKey}>Mode</Text>
          <Text style={styles.receiptValue}>{method}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptKey}>Recorded</Text>
          <Text style={styles.receiptValue}>
            {new Date().toLocaleString([], {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={styles.receiptKey}>Period</Text>
          <Text style={styles.receiptValue}>{quarterLabel}</Text>
        </View>
      </View>

      <View style={styles.spacerBottom} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Return to maintenance dues"
        style={styles.doneButton}
        onPress={() => router.replace('/(resident)/dues')}>
        <Text style={styles.doneLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.green600,
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
  title: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 25,
    color: Colors.textOnDark,
    marginTop: 20,
    textAlign: 'center',
  },
  amount: { fontFamily: FontFamily.headingBold, fontSize: 20, color: Colors.gold, marginTop: 7 },
  subtitle: {
    maxWidth: 330,
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(247,244,236,0.68)',
    marginTop: 8,
    textAlign: 'center',
  },
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
  receiptOverline: { fontSize: 10, letterSpacing: 1.8, fontWeight: '700', color: Colors.gold },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 12 },
  receiptKey: { fontSize: 13.5, color: 'rgba(247,244,236,0.6)' },
  receiptValue: { flexShrink: 1, fontSize: 13.5, fontWeight: '700', color: Colors.textOnDark, textAlign: 'right' },
  doneButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
  },
  doneLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.green500 },
});

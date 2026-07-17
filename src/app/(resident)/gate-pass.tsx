import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { titleCase } from '@/commonFunctions';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';
import { showToast } from '@/stores/toast-store';

function CheckIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 12.5l5 5L19.5 7" stroke={Colors.success400} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CopyIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Rect x={8} y={8} width={12} height={12} rx={2.5} stroke={Colors.green500} strokeWidth={2} />
      <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke={Colors.green500} strokeWidth={2} />
    </Svg>
  );
}

export default function GatePassScreen() {
  const params = useLocalSearchParams<{ code: string; visitorName: string; category: string }>();

  async function handleCopy() {
    const text = `Agora gate pass ${params.code} for ${params.visitorName} at your society. Share this code with the guard at the gate.`;
    await Clipboard.setStringAsync(text);
    showToast('Pass copied — share it with your guest');
  }

  return (
    <View style={styles.root}>
      <View style={styles.spacerTop} />
      <View style={styles.iconWrap}>
        <CheckIcon />
      </View>
      <Text style={styles.title}>Gate pass created</Text>
      <Text style={styles.sub}>Share the code — the guard will match it at the gate</Text>

      <View style={styles.codeCard}>
        <Text style={styles.codeOverline}>AGORA GATE PASS</Text>
        <Text style={styles.code}>{params.code}</Text>
        <Text style={styles.codeName}>{params.visitorName}</Text>
        <Text style={styles.codeMeta}>{params.category ? titleCase(params.category) : ''}</Text>
      </View>

      <View style={styles.spacerBottom} />

      <Pressable style={styles.copyButton} onPress={handleCopy}>
        <CopyIcon />
        <Text style={styles.copyButtonLabel}>Copy code to share</Text>
      </Pressable>
      <Pressable style={styles.doneButton} onPress={() => router.replace('/(resident)/(tabs)')}>
        <Text style={styles.doneButtonLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.green600, paddingHorizontal: 24, paddingTop: 78, paddingBottom: 40, alignItems: 'center' },
  spacerTop: { flex: 0.6 },
  spacerBottom: { flex: 1 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: 'rgba(31,157,92,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 23, color: Colors.textOnDark, marginTop: 18 },
  sub: { fontSize: 13.5, color: 'rgba(247,244,236,0.6)', marginTop: 6, textAlign: 'center' },
  codeCard: {
    width: '100%',
    marginTop: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(231,163,60,0.55)',
    borderStyle: 'dashed',
    borderRadius: Radius.cardLarge - 2,
    paddingVertical: 24,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(231,163,60,0.06)',
    alignItems: 'center',
  },
  codeOverline: { fontSize: 10.5, letterSpacing: 2, fontWeight: '700', color: Colors.gold },
  code: { fontFamily: FontFamily.headingExtraBold, fontSize: 40, letterSpacing: 2, color: Colors.textOnDark, marginTop: 10 },
  codeName: { fontSize: 15, fontWeight: '600', color: Colors.textOnDark, marginTop: 12 },
  codeMeta: { fontSize: 13, color: 'rgba(247,244,236,0.6)', marginTop: 4, textTransform: 'capitalize' },
  copyButton: {
    width: '100%',
    height: 54,
    borderRadius: Radius.card - 2,
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  copyButtonLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.green500 },
  doneButton: { width: '100%', height: 50, marginTop: 10, alignItems: 'center', justifyContent: 'center' },
  doneButtonLabel: { fontSize: 14.5, fontWeight: '600', color: 'rgba(247,244,236,0.75)' },
});

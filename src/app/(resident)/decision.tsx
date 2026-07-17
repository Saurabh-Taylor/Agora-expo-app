import { router, useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatTime } from '@/commonFunctions';
import { Colors, FontFamily, Radius } from '@/constants/commonConstants';

type Outcome = 'APPROVED' | 'REJECTED' | 'LEFT_AT_GATE';

function ApprovedIcon() {
  return (
    <Svg width={42} height={42} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 12.5l5 5L19.5 7" stroke={Colors.success600} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function DeniedIcon() {
  return (
    <Svg width={38} height={38} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={Colors.danger500} strokeWidth={2.8} strokeLinecap="round" />
    </Svg>
  );
}

function GateIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8l8-4 8 4v9l-8 4-8-4V8z" stroke="#9A6B14" strokeWidth={1.9} strokeLinejoin="round" />
      <Path d="M4 8l8 4 8-4M12 12v9" stroke="#9A6B14" strokeWidth={1.9} strokeLinejoin="round" />
    </Svg>
  );
}

const OUTCOME_COPY: Record<
  Outcome,
  { title: (name: string) => string; sub: (flat: string) => string; bg: string; icon: () => ReactElement }
> = {
  APPROVED: {
    title: (name) => `${name.split(' ')[0]} is on the way up`,
    sub: (flat) => `The gate has been notified — they can head up to ${flat || 'your flat'}.`,
    bg: '#E3F2E9',
    icon: ApprovedIcon,
  },
  REJECTED: {
    title: () => 'Turned away at the gate',
    sub: () => 'The gate has been notified. No entry was logged.',
    bg: '#F9E4E1',
    icon: DeniedIcon,
  },
  LEFT_AT_GATE: {
    title: () => "They'll leave it at the gate",
    sub: (flat) => `The guard will hold the package for ${flat || 'your flat'} — pick it up whenever convenient.`,
    bg: '#F6ECD8',
    icon: GateIcon,
  },
};

export default function DecisionScreen() {
  const params = useLocalSearchParams<{ outcome: Outcome; visitorName: string; flatLabel: string }>();
  const copy = OUTCOME_COPY[params.outcome] ?? OUTCOME_COPY.APPROVED;
  const Icon = copy.icon;
  const now = formatTime(new Date().toISOString());

  return (
    <View style={styles.root}>
      <View style={styles.spacerTop} />
      <View style={[styles.iconWrap, { backgroundColor: copy.bg }]}>
        <Icon />
      </View>
      <Text style={styles.title}>{copy.title(params.visitorName ?? 'Visitor')}</Text>
      <Text style={styles.sub}>{copy.sub(params.flatLabel ?? '')}</Text>
      <View style={styles.metaChip}>
        <Text style={styles.metaLabel}>Decision logged · {now}</Text>
      </View>
      <View style={styles.spacerBottom} />
      <Pressable style={styles.doneButton} onPress={() => router.replace('/(resident)/(tabs)')}>
        <Text style={styles.doneButtonLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.canvas, paddingHorizontal: 24, paddingTop: 78, paddingBottom: 40, alignItems: 'center' },
  spacerTop: { flex: 1 },
  spacerBottom: { flex: 1.4 },
  iconWrap: { width: 96, height: 96, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 25, marginTop: 24, textAlign: 'center' },
  sub: { fontSize: 14.5, color: Colors.textMuted, marginTop: 10, textAlign: 'center', lineHeight: 21, maxWidth: 280 },
  metaChip: {
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  metaLabel: { fontSize: 12.5, fontWeight: '600', color: '#3E4A40' },
  doneButton: {
    width: '100%',
    height: 54,
    borderRadius: Radius.card - 2,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonLabel: { fontSize: 15.5, fontWeight: '700', color: Colors.textOnDark },
});

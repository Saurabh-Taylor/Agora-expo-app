import { StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Colors, FontFamily, Radius } from '@/constants/commonConstants';

function EmailIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5.5} width={18} height={13} rx={2.5} stroke={Colors.gold} strokeWidth={1.8} />
      <Path d="M4 7l8 6 8-6" stroke={Colors.gold} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type AuthEmailFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
};

export function AuthEmailField({ value, onChangeText, autoFocus = false }: AuthEmailFieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.iconWrap}>
        <EmailIcon />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="you@email.com"
          placeholderTextColor={Colors.textFaint}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          autoFocus={autoFocus}
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(247,244,236,0.12)',
    borderRadius: Radius.card - 2,
    padding: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(31,157,92,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  label: { fontFamily: FontFamily.bodyBold, fontSize: 11, letterSpacing: 1.5, color: 'rgba(247,244,236,0.5)' },
  input: { fontFamily: FontFamily.bodyRegular, fontSize: 16, color: Colors.textOnDark, marginTop: 4, padding: 0 },
});

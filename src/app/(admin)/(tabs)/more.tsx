import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily } from '@/constants/commonConstants';
import { confirmSignOut } from '@/stores/auth-store';

const MODULES = [
  { label: 'Amenities', sub: 'Bookings & spaces', iconBg: '#E4EFF5', glyph: '🏊', go: () => router.push('/(admin)/amenities') },
  { label: 'Polls & Surveys', sub: 'Community voting', iconBg: '#EFEAF7', glyph: '▤', go: () => router.push('/(admin)/polls') },
  { label: 'Staff & Services', sub: 'Directory', iconBg: '#F6ECD8', glyph: '👷', go: () => router.push('/(admin)/staff-services') },
  { label: 'Visitor History', sub: 'Read-only gate records', iconBg: '#E9F1EC', glyph: '↕', go: () => router.push('/(admin)/visitor-history' as Href) },
  { label: 'Audit trail', sub: 'All logged actions', iconBg: '#EEEDE4', glyph: '≡', go: () => router.push('/(admin)/audit') },
  { label: 'Sign out', sub: 'End this session', iconBg: '#F0E7E4', glyph: '⎋', go: confirmSignOut },
];

export default function MoreScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Manage</Text>
      <Text style={styles.subtitle}>All admin modules</Text>
      <View style={styles.grid}>
        {MODULES.map((module) => (
          <Pressable key={module.label} style={styles.card} onPress={module.go}>
            <View style={[styles.iconWrap, { backgroundColor: module.iconBg }]}>
              <Text style={styles.glyph}>{module.glyph}</Text>
            </View>
            <Text style={styles.cardLabel}>{module.label}</Text>
            <Text style={styles.cardSub}>{module.sub}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas, paddingTop: 66, paddingHorizontal: 16, paddingBottom: 108 },
  title: { fontFamily: FontFamily.headingExtraBold, fontSize: 26 },
  subtitle: { fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, marginTop: 18 },
  card: { width: '47.5%', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 18 },
  cardLabel: { fontSize: 14.5, fontWeight: '700', marginTop: 12 },
  cardSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});

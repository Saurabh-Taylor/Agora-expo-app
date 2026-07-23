import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AgoraSymbol, type AgoraSymbolName } from '@/components/icons/agora-symbol';
import {
  AdminDashboardTones,
  type AdminDashboardTone,
  Colors,
  FontFamily,
  Radius,
} from '@/constants/commonConstants';

type DashboardSectionProps = {
  title: string;
  subtitle?: string;
  icon?: AgoraSymbolName;
  tone?: AdminDashboardTone;
  children: ReactNode;
};

export function AdminDashboardSection({
  title,
  subtitle,
  icon,
  tone = 'green',
  children,
}: DashboardSectionProps) {
  const colors = AdminDashboardTones[tone];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon && (
          <View style={[styles.sectionIcon, { backgroundColor: colors.background }]}>
            <AgoraSymbol name={icon} color={colors.foreground} size={19} />
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

export function AdminDashboardGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

type DashboardMetricCardProps = {
  icon: AgoraSymbolName;
  tone: AdminDashboardTone;
  value: string | number;
  label: string;
  supportingText: string;
  onPress?: () => void;
};

export function AdminDashboardMetricCard({
  icon,
  tone,
  value,
  label,
  supportingText,
  onPress,
}: DashboardMetricCardProps) {
  const colors = AdminDashboardTones[tone];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label + ': ' + value}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.metricCard, pressed && styles.pressed]}>
      <View style={[styles.metricIcon, { backgroundColor: colors.background }]}>
        <AgoraSymbol name={icon} color={colors.foreground} size={21} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricSupporting}>{supportingText}</Text>
    </Pressable>
  );
}

type DashboardActionCardProps = {
  icon: AgoraSymbolName;
  tone: AdminDashboardTone;
  label: string;
  supportingText: string;
  onPress: () => void;
};

export function AdminDashboardActionCard({
  icon,
  tone,
  label,
  supportingText,
  onPress,
}: DashboardActionCardProps) {
  const colors = AdminDashboardTones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
      <View style={styles.actionTop}>
        <View style={[styles.actionIcon, { backgroundColor: colors.background }]}>
          <AgoraSymbol name={icon} color={colors.foreground} size={22} />
        </View>
        <AgoraSymbol name="chevronRight" color={Colors.textFaint} size={17} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSupporting} numberOfLines={1}>
        {supportingText}
      </Text>
    </Pressable>
  );
}

export function AdminDashboardPanel({ children }: { children: ReactNode }) {
  return <View style={styles.panel}>{children}</View>;
}

type DashboardListRowProps = {
  icon: AgoraSymbolName;
  tone: AdminDashboardTone;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
};

export function AdminDashboardListRow({
  icon,
  tone,
  title,
  subtitle,
  trailing,
  onPress,
  showChevron = false,
  isLast = false,
}: DashboardListRowProps) {
  const colors = AdminDashboardTones[tone];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, !isLast && styles.listRowDivider, pressed && styles.pressed]}>
      <View style={[styles.listIcon, { backgroundColor: colors.background }]}>
        <AgoraSymbol name={icon} color={colors.foreground} size={20} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {trailing}
      {showChevron && <AgoraSymbol name="chevronRight" color={Colors.textFaint} size={17} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 26 },
  sectionHeader: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  sectionTitle: { fontFamily: FontFamily.headingBold, fontSize: 18, color: Colors.textPrimary },
  sectionSubtitle: { marginTop: 2, fontFamily: FontFamily.bodyRegular, fontSize: 12.5, color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  metricCard: {
    width: '48%',
    minHeight: 152,
    padding: 15,
    borderRadius: Radius.cardLarge - 4,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  metricIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  metricValue: {
    marginTop: 13,
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 25,
    lineHeight: 28,
    color: Colors.textPrimary,
  },
  metricLabel: { marginTop: 2, fontFamily: FontFamily.bodyBold, fontSize: 13, color: Colors.textPrimary },
  metricSupporting: {
    marginTop: 2,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  actionCard: {
    width: '48%',
    minHeight: 126,
    padding: 14,
    borderRadius: Radius.cardLarge - 4,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  actionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  actionLabel: { marginTop: 12, fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: Colors.textPrimary },
  actionSupporting: {
    marginTop: 2,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  panel: {
    overflow: 'hidden',
    borderRadius: Radius.cardLarge - 2,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  listRow: {
    minHeight: 70,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  listRowDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  listIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  listTitle: { fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: Colors.textPrimary },
  listSubtitle: {
    marginTop: 2,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});

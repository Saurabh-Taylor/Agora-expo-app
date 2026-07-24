import { router, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AdminDashboardListRow,
  AdminDashboardPanel,
  AdminDashboardSection,
} from '@/components/admin-dashboard';
import { AdminTabHeader } from '@/components/admin-tab-header';
import { Colors } from '@/constants/commonConstants';
import { confirmSignOut } from '@/stores/auth-store';

export default function MoreScreen() {
  return (
    <View style={styles.root}>
      <AdminTabHeader title="More" subtitle="Your complete administration workspace" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never">
        <AdminDashboardSection
          title="Community management"
          subtitle="Content, facilities, and trusted services"
          icon="more"
          tone="green">
          <AdminDashboardPanel>
            <AdminDashboardListRow
              icon="amenity"
              tone="blue"
              title="Amenities & bookings"
              subtitle="Manage spaces, schedules, and requests"
              onPress={() => router.push('/(admin)/amenities')}
              showChevron
            />
            <AdminDashboardListRow
              icon="poll"
              tone="purple"
              title="Polls & surveys"
              subtitle="Create votes and review community results"
              onPress={() => router.push('/(admin)/polls')}
              showChevron
            />
            <AdminDashboardListRow
              icon="staff"
              tone="gold"
              title="Staff & service directory"
              subtitle="Manage staff, vendors, and verification"
              onPress={() => router.push('/(admin)/staff-services')}
              showChevron
            />
            <AdminDashboardListRow
              icon="maintenance"
              tone="green"
              title="Maintenance billing"
              subtitle="Create invoices and track demo collections"
              onPress={() => router.push('/(admin)/maintenance' as Href)}
              showChevron
            />
            <AdminDashboardListRow
              icon="parking"
              tone="blue"
              title="Parking & vehicles"
              subtitle="Manage the live layout and resident assignments"
              onPress={() => router.push('/(admin)/parking' as Href)}
              showChevron
            />
            <AdminDashboardListRow
              icon="documents"
              tone="purple"
              title="Society documents"
              subtitle="Publish private, role-scoped records and forms"
              onPress={() => router.push('/(admin)/documents' as Href)}
              showChevron
            />
            <AdminDashboardListRow
              icon="tasks"
              tone="gold"
              title="Daily operations"
              subtitle="Assign and track staff, committee, and guard tasks"
              onPress={() => router.push('/(admin)/tasks' as Href)}
              showChevron
              isLast
            />
          </AdminDashboardPanel>
        </AdminDashboardSection>

        <AdminDashboardSection
          title="Records & oversight"
          subtitle="Review activity across your society"
          icon="audit"
          tone="neutral">
          <AdminDashboardPanel>
            <AdminDashboardListRow
              icon="visitorHistory"
              tone="green"
              title="Visitor history"
              subtitle="Read-only society gate records"
              onPress={() => router.push('/(admin)/visitor-history' as Href)}
              showChevron
            />
            <AdminDashboardListRow
              icon="audit"
              tone="neutral"
              title="Audit trail"
              subtitle="Trace administrative actions and changes"
              onPress={() => router.push('/(admin)/audit')}
              showChevron
              isLast
            />
          </AdminDashboardPanel>
        </AdminDashboardSection>

        <AdminDashboardSection
          title="Account & security"
          subtitle="Manage this authenticated session"
          icon="account"
          tone="red">
          <AdminDashboardPanel>
            <AdminDashboardListRow
              icon="guards"
              tone="green"
              title="Security guard accounts"
              subtitle="Create, activate, and deactivate gate accounts"
              onPress={() => router.push('/(admin)/guard-accounts' as Href)}
              showChevron
            />
            <AdminDashboardListRow
              icon="signOut"
              tone="red"
              title="Sign out"
              subtitle="Securely end this session on this device"
              onPress={confirmSignOut}
              showChevron
              isLast
            />
          </AdminDashboardPanel>
        </AdminDashboardSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.adminCanvas },
  content: {
    paddingHorizontal: 16,
  },
});

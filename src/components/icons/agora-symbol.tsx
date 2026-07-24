import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const AgoraSymbolNames = {
  attention: { ios: 'exclamationmark.triangle.fill', android: 'report_problem' },
  verification: { ios: 'person.badge.plus.fill', android: 'manage_accounts' },
  complaint: { ios: 'exclamationmark.bubble.fill', android: 'feedback' },
  booking: { ios: 'calendar.badge.checkmark', android: 'event_available' },
  residents: { ios: 'person.3.fill', android: 'groups' },
  guards: { ios: 'shield.lefthalf.filled', android: 'shield_person' },
  maintenance: { ios: 'indianrupeesign.circle.fill', android: 'payments' },
  parking: { ios: 'parkingsign.circle.fill', android: 'local_parking' },
  vehicle: { ios: 'car.fill', android: 'directions_car' },
  documents: { ios: 'doc.text.fill', android: 'folder' },
  tasks: { ios: 'checklist', android: 'task_alt' },
  flats: { ios: 'building.2.fill', android: 'apartment' },
  addResident: { ios: 'person.badge.plus', android: 'person_add' },
  notice: { ios: 'megaphone.fill', android: 'campaign' },
  poll: { ios: 'chart.bar.fill', android: 'poll' },
  staff: { ios: 'wrench.and.screwdriver.fill', android: 'engineering' },
  amenity: { ios: 'building.2.fill', android: 'home_work' },
  audit: { ios: 'clock.arrow.circlepath', android: 'history' },
  visitorHistory: { ios: 'door.left.hand.open', android: 'door_front' },
  admin: { ios: 'checkmark.shield.fill', android: 'admin_panel_settings' },
  account: { ios: 'person.crop.circle.fill', android: 'account_circle' },
  signOut: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  more: { ios: 'square.grid.2x2.fill', android: 'grid_view' },
  success: { ios: 'checkmark.seal.fill', android: 'task_alt' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
} as const satisfies Record<string, SymbolName>;

export type AgoraSymbolName = keyof typeof AgoraSymbolNames;

type AgoraSymbolProps = {
  name: AgoraSymbolName;
  color: ColorValue;
  size?: number;
};

export function AgoraSymbol({ name, color, size = 22 }: AgoraSymbolProps) {
  return <SymbolView name={AgoraSymbolNames[name]} size={size} tintColor={color} />;
}

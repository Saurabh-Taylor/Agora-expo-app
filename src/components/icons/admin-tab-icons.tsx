import Svg, { Circle, Path, Rect } from 'react-native-svg';

type TabIconProps = { color: string };

export function HomeTabIcon({ color }: TabIconProps) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path d="M12 3.5l8 6.8V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.7l8-6.8z" fill={color} />
    </Svg>
  );
}

export function CommunityTabIcon({ color }: TabIconProps) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Circle cx={9} cy={8} r={3.2} fill={color} />
      <Path d="M3.2 19.5c0-3.1 2.6-5.2 5.8-5.2s5.8 2.1 5.8 5.2v0.5H3.2v-0.5z" fill={color} />
      <Circle cx={16.8} cy={9} r={2.6} fill={color} opacity={0.55} />
      <Path d="M15.9 14.6c2.9 0.1 4.9 2 4.9 4.6v0.8h-4.2c0-2.1-0.2-3.9-0.7-5.4z" fill={color} opacity={0.55} />
    </Svg>
  );
}

export function OperationsTabIcon({ color }: TabIconProps) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3} fill="none" stroke={color} strokeWidth={1.9} />
    </Svg>
  );
}

export function CommunicationTabIcon({ color }: TabIconProps) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path d="M4 5h16v11H8l-4 4V5z" fill={color} />
    </Svg>
  );
}

export function MoreTabIcon({ color }: TabIconProps) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Rect x={4} y={6} width={16} height={2.2} rx={1.1} fill={color} />
      <Rect x={4} y={11} width={16} height={2.2} rx={1.1} fill={color} />
      <Rect x={4} y={16} width={16} height={2.2} rx={1.1} fill={color} />
    </Svg>
  );
}

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
      <Path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" fill={color} />
      <Path
        d="M19.8 13.6l1.8-1.1-1-3-2.1.3a6.9 6.9 0 0 0-1.2-1.2l.3-2.1-3-1-1.1 1.8a7 7 0 0 0-1.7 0L10.7 4.5l-3 1 .3 2.1c-.45.35-.85.75-1.2 1.2l-2.1-.3-1 3 1.8 1.1a7 7 0 0 0 0 1.7l-1.8 1.1 1 3 2.1-.3c.35.45.75.85 1.2 1.2l-.3 2.1 3 1 1.1-1.8a7 7 0 0 0 1.7 0l1.1 1.8 3-1-.3-2.1c.45-.35.85-.75 1.2-1.2l2.1.3 1-3-1.8-1.1a7 7 0 0 0 0-1.7z"
        fill={color}
        opacity={0.5}
      />
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

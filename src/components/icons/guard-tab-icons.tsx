import Svg, { Circle, Path } from 'react-native-svg';

type TabIconProps = { color: string };

export function MovementTabIcon({ color }: TabIconProps) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path d="M4 12h4l2-6 4 12 2-6h4" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={4} cy={12} r={1.4} fill={color} />
      <Circle cx={20} cy={12} r={1.4} fill={color} />
    </Svg>
  );
}

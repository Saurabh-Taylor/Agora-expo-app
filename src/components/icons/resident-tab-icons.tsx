import Svg, { Path } from 'react-native-svg';

type TabIconProps = { color: string };

export function GateTabIcon({ color }: TabIconProps) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path
        d="M12 2l8 3.6v5.2c0 5.2-3.4 8.9-8 10.6-4.6-1.7-8-5.4-8-10.6V5.6L12 2z"
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      <Path d="M8.6 11.5l2.3 2.3 4.5-4.6" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

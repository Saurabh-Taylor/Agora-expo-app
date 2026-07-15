import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const ASPECT_RATIO = 66 / 74;
const LOGO_PATH =
  'M31.6 4.7a6 6 0 0 1 10.8 0l29.4 52.9c2.2 4-0.7 8.9-5.4 8.9H7.6c-4.7 0-7.6-4.9-5.4-8.9L31.6 4.7ZM37 26.5 26.1 46.1c-1.1 2 0.3 4.4 2.7 4.4h16.4c2.4 0 3.8-2.4 2.7-4.4L37 26.5Z';

type AgoraLogoProps = {
  size?: number;
  gradientId?: string;
};

export function AgoraLogo({ size = 74, gradientId = 'agora-logo-gradient' }: AgoraLogoProps) {
  return (
    <Svg width={size} height={size * ASPECT_RATIO} viewBox="0 0 74 66" fill="none">
      <Defs>
        <LinearGradient id={gradientId} x1="10" y1="0" x2="64" y2="66" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#F3B75B" />
          <Stop offset="1" stopColor="#D0871F" />
        </LinearGradient>
      </Defs>
      <Path fillRule="evenodd" clipRule="evenodd" fill={`url(#${gradientId})`} d={LOGO_PATH} />
    </Svg>
  );
}

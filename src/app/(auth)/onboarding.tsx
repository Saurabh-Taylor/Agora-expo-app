import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { markOnboardingComplete } from '@/commonFunctions';
import { AgoraLogo } from '@/components/icons/agora-logo';
import { AuthRoutes, Colors, FontFamily, Radius } from '@/constants/commonConstants';

const SLIDE_COUNT = 4;

function ArrowRightIcon({ color = '#10261B', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ShieldCheckIcon({ color = '#E7A33C', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l8 3.6v5.2c0 5.2-3.4 8.9-8 10.6-4.6-1.7-8-5.4-8-10.6V5.6L12 2z" stroke={color} strokeWidth={1.8} />
      <Path d="M8.6 12l2.3 2.3 4.5-4.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function GatePassIcon({ color = '#10261B', size = 27 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8l8-4 8 4v9l-8 4-8-4V8z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M4 8l8 4 8-4M12 12v9" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M8 6l8 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function DenyIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke="#C0392B" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

function ApproveIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M4.5 12.5l5 5L19.5 7" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const OVERLAY_STOPS = {
  hero: { colors: ['rgba(10,26,18,0.62)', 'rgba(10,26,18,0.15)', 'rgba(10,26,18,0.35)', 'rgba(10,26,18,0.9)'], locations: [0, 0.26, 0.58, 0.88] as const },
  approve: { colors: ['rgba(10,26,18,0.5)', 'rgba(10,26,18,0.12)', 'rgba(10,26,18,0.5)', 'rgba(10,26,18,0.93)'], locations: [0, 0.24, 0.6, 0.9] as const },
  plain: { colors: ['rgba(10,26,18,0.45)', 'rgba(10,26,18,0.1)', 'rgba(10,26,18,0.5)', 'rgba(10,26,18,0.93)'], locations: [0, 0.22, 0.58, 0.9] as const },
};

function SlideBackground({ source, contentFit, overlay }: { source: number; contentFit: 'cover' | 'contain'; overlay: keyof typeof OVERLAY_STOPS }) {
  const stops = OVERLAY_STOPS[overlay];
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit={contentFit} />
      <LinearGradient
        colors={stops.colors as unknown as [string, string, ...string[]]}
        locations={stops.locations as unknown as [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollX] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ScrollView>(null);
  const isLast = activeIndex === SLIDE_COUNT - 1;

  const slideMotionStyles = useMemo(
    () =>
      Array.from({ length: SLIDE_COUNT }, (_, index) => {
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
        return {
          foreground: {
            opacity: scrollX.interpolate({
              inputRange,
              outputRange: [0.58, 1, 0.58],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                translateY: scrollX.interpolate({
                  inputRange,
                  outputRange: [10, 0, 10],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        };
      }),
    [scrollX, width],
  );

  function goToSlide(index: number) {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setActiveIndex(index);
  }

  async function finishOnboarding() {
    await markOnboardingComplete();
    router.replace(AuthRoutes.login);
  }

  function handlePrimary() {
    if (isLast) {
      void finishOnboarding();
      return;
    }
    goToSlide(activeIndex + 1);
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  }

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        disableIntervalMomentum
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.flex}>
        {/* Slide 1 */}
        <View style={[styles.slide, { width }]}>
          <SlideBackground source={require('@/assets/images/onboarding/hero-gate-night.png')} contentFit="cover" overlay="hero" />
          <Animated.View style={[styles.slide1Content, slideMotionStyles[0].foreground]}>
            <AgoraLogo size={72} />
            <Text style={styles.wordmarkLarge}>Agora</Text>
            <Text style={styles.slideHeadingSmall}>One Community. One App.</Text>
            <Text style={styles.slideBodyCentered}>Powering safer, smarter and connected societies.</Text>
            <View style={styles.flex} />
            <View style={styles.trustCard}>
              <View style={styles.trustIconWrap}>
                <ShieldCheckIcon />
              </View>
              <View>
                <Text style={styles.trustTitle}>Trusted by 1000+ communities</Text>
                <Text style={styles.trustSub}>to simplify daily operations</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Slide 2 */}
        <View style={[styles.slide, { width }]}>
          <SlideBackground source={require('@/assets/images/onboarding/slide2-hologram.png')} contentFit="cover" overlay="approve" />
          <Animated.View style={[styles.slide2Content, { paddingTop: insets.top + 68 }, slideMotionStyles[1].foreground]}>
            <View style={styles.gateCard}>
              <View style={styles.gateCardTopRow}>
                <View style={styles.liveDot} />
                <Text style={styles.gateCardLabel}>GATE 1 · WAITING NOW</Text>
              </View>
              <View style={styles.gateCardVisitorRow}>
                <View style={styles.gateCardAvatar}>
                  <GatePassIcon />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.gateCardName}>Ravi Kumar</Text>
                  <Text style={styles.gateCardSub}>Swiggy · Food delivery</Text>
                </View>
              </View>
              <View style={styles.gateCardActions}>
                <View style={styles.denyPill}>
                  <DenyIcon />
                  <Text style={styles.denyLabel}>Deny</Text>
                </View>
                <View style={styles.approvePill}>
                  <ApproveIcon />
                  <Text style={styles.approveLabel}>Approve</Text>
                </View>
              </View>
            </View>
            <View style={styles.flex} />
            <View style={styles.bottomTextBlock}>
              <Text style={styles.slideHeading}>Approve visitors in a tap</Text>
              <Text style={styles.slideBody}>
                Every guest, delivery and cab is verified at the gate — you clear them from your phone in seconds.
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Slide 3 */}
        <View style={[styles.slide, { width }]}>
          <SlideBackground source={require('@/assets/images/onboarding/slide3-community.png')} contentFit="cover" overlay="plain" />
          <Animated.View style={[styles.slideBottomOnly, slideMotionStyles[2].foreground]}>
            <Text style={styles.slideHeading}>Your community, in one place</Text>
            <Text style={styles.slideBody}>Notices, polls and society updates land in a single shared feed — never miss what matters.</Text>
          </Animated.View>
        </View>

        {/* Slide 4 */}
        <View style={[styles.slide, { width }]}>
          <SlideBackground source={require('@/assets/images/onboarding/slide4-dues.png')} contentFit="cover" overlay="plain" />
          <Animated.View style={[styles.slideBottomOnly, { paddingBottom: 168 }, slideMotionStyles[3].foreground]}>
            <Text style={styles.slideHeading}>Dues, minus the hassle</Text>
            <Text style={styles.slideBody}>Pay maintenance and keep every receipt in one place — no paperwork, no follow-ups.</Text>
          </Animated.View>
        </View>
      </Animated.ScrollView>

      {!isLast && (
        <Pressable
          style={[styles.skip, { top: insets.top + 10 }]}
          onPress={finishOnboarding}
          hitSlop={8}>
          <Text style={styles.skipLabel}>Skip</Text>
        </Pressable>
      )}

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View style={styles.dotsRow}>
            {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
              <Pressable key={i} onPress={() => goToSlide(i)} hitSlop={8}>
                <View style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
              </Pressable>
            ))}
          </View>
          {!isLast && (
            <Pressable style={styles.circleButton} onPress={handlePrimary}>
              <ArrowRightIcon size={22} />
            </Pressable>
          )}
        </View>
        {isLast && (
          <Pressable style={styles.primaryButton} onPress={handlePrimary}>
            <Text style={styles.primaryButtonLabel}>Get started</Text>
            <ArrowRightIcon />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.green600 },
  flex: { flex: 1 },
  slide: { overflow: 'hidden' },
  slide1Content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 78,
    paddingHorizontal: 26,
    paddingBottom: 150,
  },
  slide2Content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 92,
    paddingHorizontal: 26,
    paddingBottom: 150,
  },
  slideBottomOnly: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 26,
    paddingBottom: 150,
  },
  bottomTextBlock: { alignItems: 'center' },
  wordmarkLarge: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 54,
    color: '#FDFBF5',
    marginTop: 14,
  },
  slideHeadingSmall: {
    fontFamily: FontFamily.headingBold,
    fontSize: 21,
    color: Colors.textOnDark,
    marginTop: 14,
    textAlign: 'center',
  },
  slideHeading: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 28,
    lineHeight: 32,
    color: Colors.textOnDark,
    textAlign: 'center',
  },
  slideBody: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(247,244,236,0.66)',
    marginTop: 12,
    maxWidth: 290,
    textAlign: 'center',
  },
  slideBodyCentered: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15.5,
    lineHeight: 23,
    color: 'rgba(247,244,236,0.72)',
    marginTop: 10,
    maxWidth: 270,
    textAlign: 'center',
  },
  trustCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.cardLarge,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  trustIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F6ECD8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 16.5,
    color: Colors.textPrimary,
  },
  trustSub: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  gateCard: {
    width: '100%',
    backgroundColor: '#F7F4EC',
    borderRadius: 24,
    padding: 18,
  },
  gateCardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: Colors.gold },
  gateCardLabel: { fontFamily: FontFamily.bodyBold, fontSize: 10, letterSpacing: 1.6, color: '#9A6B14' },
  gateCardVisitorRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 14 },
  gateCardAvatar: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateCardName: { fontFamily: FontFamily.bodyBold, fontSize: 16.5, color: Colors.textPrimary },
  gateCardSub: { fontFamily: FontFamily.bodyRegular, fontSize: 13, color: Colors.textMuted, marginTop: 1 },
  gateCardActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  denyPill: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F0E7E4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  denyLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14.5, color: '#C0392B' },
  approvePill: {
    flex: 1.3,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.success600,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  approveLabel: { fontFamily: FontFamily.bodyBold, fontSize: 14.5, color: '#FFFFFF' },
  skip: {
    position: 'absolute',
    right: 22,
    padding: 6,
    zIndex: 1,
  },
  skipLabel: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    color: 'rgba(247,244,236,0.7)',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dotsRow: { flexDirection: 'row', gap: 7 },
  dot: { height: 8, borderRadius: 999 },
  dotActive: { width: 26, backgroundColor: Colors.gold },
  dotInactive: { width: 8, backgroundColor: 'rgba(247,244,236,0.28)' },
  circleButton: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 20,
    marginBottom: 20,
  },
  primaryButtonLabel: { fontFamily: FontFamily.bodyBold, fontSize: 16, color: '#10261B' },
});

import { useNetInfo } from "@react-native-community/netinfo";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, FontFamily, Radius } from "@/constants/commonConstants";

export function NetworkStatusBanner() {
  const network = useNetInfo();
  const insets = useSafeAreaInsets();
  const isOffline = network.isConnected === false || network.isInternetReachable === false;

  if (!isOffline) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.banner, { top: insets.top + 8 }]}>
      <Text style={styles.label}>You are offline. Updates will resume when connected.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: Radius.input,
    backgroundColor: Colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textOnDark,
    textAlign: "center",
  },
});

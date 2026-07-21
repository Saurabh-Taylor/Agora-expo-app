import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, Radius } from '@/constants/commonConstants';

type AsyncStateProps = {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  isRetrying?: boolean;
  loadingMessage?: string;
  emptyTitle?: string | null;
  emptyMessage?: string;
  emptySymbol?: string | null;
  errorTitle?: string;
  errorMessage?: string;
  actionLabel?: string;
  onAction?: () => void;
  onRetry?: () => void;
};

// One consistent, accessible state surface for all server-backed lists/details.
// A null result means the caller can render its successful content.
export function AsyncState({
  isLoading,
  isError,
  isEmpty,
  isRetrying = false,
  loadingMessage = 'Loading…',
  emptyTitle = null,
  emptyMessage = 'New activity will appear here.',
  emptySymbol = null,
  errorTitle = 'Couldn’t load this right now',
  errorMessage = 'Try again. If the problem continues, return to this screen in a moment.',
  actionLabel,
  onAction,
  onRetry,
}: AsyncStateProps) {
  if (isLoading) {
    return (
      <View style={styles.center} accessibilityRole="progressbar" accessibilityLiveRegion="polite">
        <ActivityIndicator color={Colors.success700} />
        <Text style={styles.supportingText}>{loadingMessage}</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center} accessibilityLiveRegion="assertive">
        <Text style={styles.symbol} accessibilityElementsHidden>
          !
        </Text>
        <Text style={styles.title}>{errorTitle}</Text>
        <Text style={styles.supportingText}>{errorMessage}</Text>
        {onRetry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try loading again"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={onRetry}
            disabled={isRetrying}>
            {isRetrying && <ActivityIndicator size="small" color={Colors.textOnDark} />}
            <Text style={styles.primaryLabel}>{isRetrying ? 'Trying again…' : 'Try again'}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.center}>
        {emptySymbol && (
          <Text style={styles.symbol} accessibilityElementsHidden>
            {emptySymbol}
          </Text>
        )}
        {emptyTitle && <Text style={styles.title}>{emptyTitle}</Text>}
        <Text style={styles.supportingText}>{emptyMessage}</Text>
        {actionLabel && onAction && (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={onAction}>
            <Text style={styles.secondaryLabel}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  symbol: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.canvas,
    color: Colors.green500,
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    lineHeight: 36,
    textAlign: 'center',
    marginBottom: 2,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  supportingText: {
    maxWidth: 280,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 20,
    borderRadius: Radius.button,
    backgroundColor: Colors.green500,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: Colors.textOnDark },
  secondaryButton: {
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 18,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: Colors.green500 },
  buttonPressed: { opacity: 0.78 },
});

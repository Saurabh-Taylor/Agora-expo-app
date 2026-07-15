import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily } from '@/constants/commonConstants';

type AsyncStateProps = {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
};

// Shared loading/error/empty renderer for list & detail screens. Returns null
// when none apply, meaning the caller should render its real content instead.
export function AsyncState({
  isLoading,
  isError,
  isEmpty,
  emptyMessage = 'Nothing here yet.',
  errorMessage = 'Something went wrong loading this.',
  onRetry,
}: AsyncStateProps) {
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.success700} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{errorMessage}</Text>
        {onRetry && (
          <Pressable style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{emptyMessage}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 12 },
  message: { fontFamily: FontFamily.bodyRegular, fontSize: 13.5, color: Colors.textMuted, textAlign: 'center' },
  retryButton: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: Colors.green500 },
  retryLabel: { fontFamily: FontFamily.bodyBold, fontSize: 13.5, color: Colors.textOnDark },
});

import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Colors, FontFamily, Radius } from '@/constants/commonConstants';

type ConfirmationDialogProps = {
  visible: boolean;
  icon: ReactNode;
  title: string;
  message: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  isPending?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

const DIALOG_TRANSITION_DURATION = 220;

export function ConfirmationDialog({
  visible,
  icon,
  title,
  message,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  isPending = false,
  errorMessage,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}>
      <View style={styles.root}>
        <Animated.View
          entering={FadeIn.duration(DIALOG_TRANSITION_DURATION)}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="Close confirmation"
        />
        <Animated.View
          entering={FadeIn.duration(DIALOG_TRANSITION_DURATION)}
          style={styles.card}
          accessibilityViewIsModal>
          <View style={styles.iconWrap}>{icon}</View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {children}

          {!!errorMessage && (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
              onPress={onCancel}
              disabled={isPending}
              accessibilityRole="button">
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.confirmButton,
                pressed && styles.buttonPressed,
                isPending && styles.buttonDisabled,
              ]}
              onPress={onConfirm}
              disabled={isPending}
              accessibilityRole="button">
              {isPending ? (
                <ActivityIndicator size="small" color={Colors.textOnDark} />
              ) : (
                <Text style={styles.confirmLabel}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: { backgroundColor: 'rgba(9,24,16,0.72)' },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: Radius.cardLarge,
    padding: 24,
    alignItems: 'center',
    shadowColor: Colors.green900,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 36,
    elevation: 12,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: Colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FontFamily.headingExtraBold,
    fontSize: 22,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 18,
  },
  message: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 290,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#F9E4E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
  },
  errorText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.danger700,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: Colors.borderAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: Radius.button,
    backgroundColor: Colors.danger700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  confirmLabel: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    color: Colors.textOnDark,
  },
  buttonPressed: { opacity: 0.82 },
  buttonDisabled: { opacity: 0.62 },
});

/**
 * Sheet - the modal shell the B-List's filter and edit sheets share.
 *
 * Both needed the same three things and neither is free: a backdrop that
 * dismisses, a card that does not, and an Android back button that closes the
 * sheet rather than the screen underneath it.
 *
 * The backdrop is a SIBLING of the card, not its parent. Making it a Pressable
 * that wraps the card means every tap inside - on a field, on a chip - bubbles
 * out to the backdrop and dismisses the sheet while you are using it.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';

type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Pinned under the content, outside the scroll area. */
  footer?: React.ReactNode;
};

export function Sheet({ visible, title, onClose, children, footer }: SheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Without this, Android's back button closes the screen behind the sheet
      // instead of the sheet.
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropTouch}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        {/*
          From react-native-keyboard-controller, NOT react-native. A sheet that
          sits at the bottom is exactly where the keyboard lands, and RN's
          KeyboardAvoidingView renders a plain View on Android - which would put
          the keyboard straight over the field you just tapped.
        */}
        <KeyboardAvoidingView behavior="padding" pointerEvents="box-none">
          <View
            style={[
              styles.card,
              { paddingBottom: Math.max(insets.bottom, spacing.xl) },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {children}

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    // Same dim as the fitness picker, so the two sheets read as one thing.
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,

    // Never taller than most of the screen: the list behind it is the context
    // for what you are choosing, and covering all of it loses that.
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { ...typography.title, fontSize: 16 },
  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
}));

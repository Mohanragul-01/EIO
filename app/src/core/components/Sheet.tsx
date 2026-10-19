/**
 * Sheet - the bottom sheet every module's pickers, filters and quick edits use.
 *
 * It started in the B-List and moved here when other modules needed it. Each
 * needed the same three things and none is free: a backdrop that dismisses, a
 * card that does not, and an Android back button that closes the sheet rather
 * than the screen underneath it.
 *
 * The grabber does what it looks like: drag the grabber or the title row down
 * and the sheet follows your finger, closing past a short distance or a
 * flick. Only that strip drags, so it never competes with scrolling the
 * content. Backdrop, the close button and Back still dismiss it too.
 *
 * ITS OWN GESTURE ROOT. A Modal is a separate native window, and the
 * GestureHandlerRootView at the top of the app does not reach into it. Without
 * one here, every gesture-handler gesture inside a sheet - the drag above, a
 * swipeable row - would silently do nothing on Android.
 *
 * A toast shown while a sheet is open draws UNDER it (the toast lives in the
 * app's window). Close the sheet, then show the toast.
 *
 * The backdrop is a SIBLING of the card, not its parent. Making it a Pressable
 * that wraps the card means every tap inside - on a field, on a chip - bubbles
 * out to the backdrop and dismisses the sheet while you are using it.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo } from 'react';
import { Animated, Modal, Pressable, Text, useAnimatedValue, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '../ThemeContext';
import { radius, spacing } from '../theme';

/** How far down a drag must travel, or how fast a flick, to close the sheet. */
const CLOSE_DISTANCE = 96;
const CLOSE_VELOCITY = 900;

type SheetProps = {
  visible: boolean;
  title: string;
  /** One line under the title, for context such as the date being edited. */
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Pinned under the content, outside the scroll area. */
  footer?: React.ReactNode;
};

export function Sheet({ visible, title, subtitle, onClose, children, footer }: SheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dragY = useAnimatedValue(0);

  // Every opening starts from rest, wherever the last one was let go.
  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [visible, dragY]);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        // Plain JS callbacks: the sheet animates with RN's Animated, not
        // Reanimated worklets.
        .runOnJS(true)
        // Activates only on a clear downward pull, so a tap on the close
        // button is still a tap.
        .activeOffsetY(8)
        .onUpdate((event) => dragY.setValue(Math.max(0, event.translationY)))
        .onEnd((event) => {
          if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) {
            onClose();
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
            }).start();
          }
        }),
    [dragY, onClose],
  );

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
      <GestureHandlerRootView style={styles.root} testID="sheet-gesture-root">
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
            <Animated.View
              style={[
                styles.card,
                { paddingBottom: Math.max(insets.bottom, spacing.xl) },
                { transform: [{ translateY: dragY }] },
              ]}
            >
              <GestureDetector gesture={drag}>
                <View>
                  <View style={styles.grabber} />
                  <View style={styles.header}>
                    <View style={styles.heading}>
                      <Text style={styles.title} accessibilityRole="header">
                        {title}
                      </Text>
                      {subtitle ? (
                        <Text style={styles.subtitle} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={onClose}
                      accessibilityRole="button"
                      accessibilityLabel="Close"
                      style={styles.close}
                    >
                      <Ionicons name="close" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              </GestureDetector>

              {children}

              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  root: { flex: 1 },
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
    paddingTop: spacing.sm,

    // Never taller than most of the screen: the list behind it is the context
    // for what you are choosing, and covering all of it loses that.
    maxHeight: '85%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBorderStrong,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heading: { flex: 1 },
  title: { ...typography.title, fontSize: 16 },
  subtitle: { ...typography.caption, marginTop: 2 },
  // A full 48dp target, pulled into the corner so the icon lines up with the
  // card's padding rather than sitting 14dp inside it.
  close: {
    width: 48,
    height: 48,
    marginRight: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
}));

/**
 * Toast - a short message at the foot of the screen, usually with an Undo.
 *
 * Undo instead of "Are you sure?" for anything reversible: a confirm dialog
 * asks every time to protect against the rare mistake, while an undo costs
 * nothing until the mistake actually happens. Confirmations stay for what
 * cannot be undone.
 *
 * Use it from anywhere below the provider:
 *
 *   const toast = useToast();
 *   toast.show({ message: 'Set deleted', actionLabel: 'Undo', onAction: restore });
 *
 * The rules (one at a time, a newer one replaces an older one, an action runs
 * at most once, an old timer cannot dismiss a newer toast) live in
 * core/toastState.ts, where they are tested. This file only draws it and owns
 * the clock.
 *
 * NOT FROM INSIDE AN OPEN SHEET. A Sheet (or any RN Modal) is a separate
 * native window drawn above the app, and this toast is drawn in the app, so
 * a toast shown while a sheet is open sits UNDER it, its Undo hidden while
 * its five seconds run. When an action happens in a sheet, close the sheet
 * first, then show the toast.
 *
 * It floats one gap above the add button every list screen has (see
 * theme.layout), rises with the keyboard, and is spoken by TalkBack.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  Text,
  useAnimatedValue,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '../ThemeContext';
import { layout, radius, spacing } from '../theme';
import {
  initialToastState,
  toastReducer,
  type ToastAction,
  type ToastOptions,
  type ToastState,
} from '../toastState';

type ToastApi = {
  show: (options: ToastOptions) => void;
  hide: () => void;
};

type LiveToast = NonNullable<ToastState['current']>;

const ToastContext = createContext<ToastApi | undefined>(undefined);

const ENTER_MS = 180;
// Leaving faster than arriving reads as responsive rather than sluggish.
const EXIT_MS = 140;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // The reducer's state lives in a ref, updated synchronously, rather than in
  // useState. Two taps on Undo inside one frame both run before React
  // re-renders; with state they would both see the toast still there and both
  // undo. With a ref the second tap sees the first one's result.
  const stateRef = useRef<ToastState>(initialToastState);
  // What is drawn. It outlives the live toast by the length of the fade-out,
  // which is why it is not simply stateRef.current.current.
  const [shown, setShown] = useState<LiveToast | null>(null);
  const opacity = useAnimatedValue(0);

  const dispatch = useCallback((action: ToastAction): ToastState => {
    const before = stateRef.current;
    stateRef.current = toastReducer(before, action);
    return before;
  }, []);

  const fadeOut = useCallback(
    (id: number) => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        // A newer toast starting its fade-in interrupts this one; it must
        // not then be erased by the old toast's exit finishing late.
        if (finished) setShown((current) => (current?.id === id ? null : current));
      });
    },
    [opacity],
  );

  const hideId = useCallback(
    (id: number) => {
      const before = dispatch({ type: 'hide', id });
      if (before !== stateRef.current) fadeOut(id);
    },
    [dispatch, fadeOut],
  );

  const act = useCallback(
    (id: number) => {
      const before = dispatch({ type: 'act', id });
      // Unchanged state means this toast was already acted on, dismissed or
      // replaced, so its action must not run.
      if (before === stateRef.current) return;
      fadeOut(id);
      before.current?.onAction?.();
    },
    [dispatch, fadeOut],
  );

  const show = useCallback(
    (options: ToastOptions) => {
      dispatch({ type: 'show', options });
      setShown(stateRef.current.current);
      // From zero every time, including when it replaces a toast with the
      // same words ("Completed · Undo" twice): without the blink, the second
      // tick would look as if nothing happened.
      opacity.setValue(0);
      // Spoken explicitly rather than left to the live region: a region that
      // appears together with its message is often read late or not at all.
      AccessibilityInfo.announceForAccessibility(
        options.actionLabel && options.onAction
          ? `${options.message}. ${options.actionLabel} available.`
          : options.message,
      );
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
    [dispatch, opacity],
  );

  const hide = useCallback(() => {
    const id = stateRef.current.current?.id;
    if (id !== undefined) hideId(id);
  }, [hideId]);

  // One timer per toast, keyed to its id. Replacing the toast clears this
  // timer and starts the next one's, and even a timer that somehow survived
  // would name a stale id, which the reducer ignores.
  const shownId = shown?.id;
  const shownDuration = shown?.durationMs;
  useEffect(() => {
    if (shownId === undefined || shownDuration === undefined) return;
    const timer = setTimeout(() => hideId(shownId), shownDuration);
    return () => clearTimeout(timer);
  }, [shownId, shownDuration, hideId]);

  const api = useMemo<ToastApi>(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {shown ? <ToastPill toast={shown} opacity={opacity} onAction={act} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return context;
}

function ToastPill({
  toast,
  opacity,
  onAction,
}: {
  toast: LiveToast;
  opacity: Animated.Value;
  onAction: (id: number) => void;
}) {
  const styles = useStyles();
  const { elevation } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    // box-none: the strip spans the screen width, but only the pill itself
    // should catch touches. Taps beside it fall through to the screen.
    // KeyboardStickyView lifts it with the keyboard, which would otherwise
    // cover it.
    <KeyboardStickyView
      pointerEvents="box-none"
      style={[styles.dock, { bottom: insets.bottom + layout.aboveFab }]}
    >
      <Animated.View
        style={[
          styles.pill,
          elevation.floating,
          {
            opacity,
            transform: [
              { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            ],
          },
        ]}
        // Read out by TalkBack without moving focus off what you were doing.
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.actionLabel && toast.onAction ? (
          <Pressable
            onPress={() => onAction(toast.id)}
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
            // The visible label is short; the touch area is not.
            hitSlop={{ top: 8, bottom: 8 }}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionLabel}>{toast.actionLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </KeyboardStickyView>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  dock: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    // Solid, not glass: a toast floats over arbitrary content and must stay
    // legible whatever is behind it. Inverse, so it stands out in both themes.
    backgroundColor: colors.inverseSurface,
  },
  message: {
    ...typography.body,
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.onInverseSurface,
  },
  action: {
    minWidth: 64,
    minHeight: 48,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: {
    backgroundColor: colors.glassStrong,
  },
  actionLabel: {
    ...typography.title,
    color: colors.inversePrimary,
  },
}));

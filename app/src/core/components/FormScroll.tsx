/**
 * FormScroll - a scroll view that keeps the focused input above the keyboard.
 *
 * WHY THIS EXISTS. Every form in this app was wrapped in:
 *
 *     <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
 *
 * which on Android is a no-op. KeyboardAvoidingView with no `behavior` renders
 * a plain View and adjusts nothing, so on the platform this app actually ships
 * to, NONE of the ten forms moved out of the keyboard's way. The symptom is
 * exactly what you would expect and easy to misread as a one-screen bug: you
 * tap a field near the bottom, the keyboard covers it, and you type blind.
 *
 * The usual next move is `behavior="height"` on Android, which fights
 * `windowSoftInputMode` and produces its own jumpiness. Expo SDK 57 ships
 * react-native-keyboard-controller instead, which reads the real keyboard
 * frame from the OS on both platforms and scrolls the focused input into view.
 * It works in Expo Go, so this needs no new build.
 *
 * `bottomOffset` is the gap left between the input and the top of the
 * keyboard. Without it the field sits flush against the keyboard, which is
 * technically visible and still feels wrong - and it hides whatever helper
 * text or error sits under the field, which is usually the thing you need to
 * read at that exact moment.
 */
import React from 'react';
import type { ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

/**
 * Everything a ScrollView takes, since this replaces one - pull-to-refresh
 * included, which two of the screens using it rely on.
 */
type FormScrollProps = ScrollViewProps & {
  children: React.ReactNode;
  /**
   * Extra room under the focused field. Raise it on screens where the field
   * has an error line or a helper under it.
   */
  bottomOffset?: number;
};

export function FormScroll({
  children,
  bottomOffset = 24,
  showsVerticalScrollIndicator = false,
  ...rest
}: FormScrollProps) {
  return (
    <KeyboardAwareScrollView
      {...rest}
      bottomOffset={bottomOffset}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      // A tap on a button while the keyboard is open should press the button,
      // not be swallowed by dismissing the keyboard. Without this every such
      // tap costs two: one to close the keyboard, one to actually hit it.
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

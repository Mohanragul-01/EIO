/**
 * MarkdownEditor - the body field in edit mode, and the bar above the keyboard.
 *
 * The body is stored as typed, so the editor is a plain multiline input; what
 * it adds is the two things that make Markdown bearable on a phone keyboard:
 *
 *   - Enter carries a list on: after "- milk" it starts "- ", after "3." it
 *     starts "4.", after a box a fresh empty box; Enter on an empty item ends
 *     the list (markdownEdit.continueList).
 *   - A formatting bar riding on top of the keyboard: box, bullet, number,
 *     heading, bold, italic, link, and hide-keyboard. It shows only while the
 *     body is focused and the keyboard is up, and each button undoes itself
 *     when pressed again.
 *
 * The bar is react-native-keyboard-controller's KeyboardStickyView rather
 * than its KeyboardToolbar: the toolbar is 42dp tall and built around
 * Prev/Next arrows this screen does not need, while the sticky view rides the
 * keyboard the same way and lets every button be a full 48dp.
 *
 * The caret is tracked from onSelectionChange and handed back through the
 * `selection` prop only when an edit moved it, then released, so ordinary
 * typing is never fighting a controlled caret.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import {
  KeyboardController,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import {
  continueList,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
  type Edit,
  type Selection,
} from '../markdownEdit';

export type FormatAction = 'task' | 'bullet' | 'numbered' | 'heading' | 'bold' | 'italic' | 'link';

/** Height of the bar, so the scroll view can keep the caret clear of it. */
export const FORMAT_BAR_HEIGHT = 56;

/**
 * Editor state for one body: hand `inputProps` to MarkdownInput and `format`
 * to FormatBar.
 */
export function useMarkdownEditor(value: string, onChange: (text: string) => void) {
  const selection = useRef<Selection>({ start: value.length, end: value.length });
  const [forced, setForced] = useState<Selection | undefined>(undefined);
  const [focused, setFocused] = useState(false);

  const apply = (edit: Edit) => {
    selection.current = edit.selection;
    setForced(edit.selection);
    onChange(edit.text);
  };

  const onChangeText = (next: string) => {
    const { start, end } = selection.current;
    const edit = continueList(value, next, start === end ? start : undefined);
    if (edit) {
      apply(edit);
    } else {
      if (forced) setForced(undefined);
      onChange(next);
    }
  };

  const onSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    selection.current = event.nativeEvent.selection;
    if (forced) setForced(undefined);
  };

  const format = (action: FormatAction) => {
    const sel = selection.current;
    switch (action) {
      case 'task':
      case 'bullet':
      case 'numbered':
      case 'heading':
        apply(toggleLinePrefix(value, sel, action));
        return;
      case 'bold':
        apply(wrapSelection(value, sel, '**'));
        return;
      case 'italic':
        apply(wrapSelection(value, sel, '*'));
        return;
      case 'link':
        apply(insertLink(value, sel));
        return;
    }
  };

  return {
    focused,
    format,
    inputProps: {
      value,
      onChangeText,
      onSelectionChange,
      selection: forced,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}

type MarkdownInputProps = ReturnType<typeof useMarkdownEditor>['inputProps'] & {
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  focused: boolean;
};

/** The body field: the same glass field as TextField, with the editor wired in. */
export function MarkdownInput({ label, placeholder, autoFocus, focused, ...input }: MarkdownInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <TextInput
          {...input}
          multiline
          autoFocus={autoFocus}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          style={styles.input}
          accessibilityLabel={label}
          accessibilityHint="Markdown: - [ ] for a box, - for a bullet, # for a heading"
        />
      </View>
      <Text style={styles.hint}>
        - [ ] box · - bullet · 1. number · # heading · **bold** · *italic*
      </Text>
    </View>
  );
}

const BUTTONS: { action: FormatAction; label: string; icon?: keyof typeof Ionicons.glyphMap; text?: string }[] = [
  { action: 'task', label: 'Checkbox', icon: 'checkbox-outline' },
  { action: 'bullet', label: 'Bulleted list', icon: 'list-outline' },
  { action: 'numbered', label: 'Numbered list', text: '1.' },
  { action: 'heading', label: 'Heading', text: 'H' },
  { action: 'bold', label: 'Bold', text: 'B' },
  { action: 'italic', label: 'Italic', text: 'I' },
  { action: 'link', label: 'Link', icon: 'link-outline' },
];

/**
 * The bar above the keyboard. Render it last on the screen, outside the
 * scroll view: it positions itself at the bottom and rides the keyboard up.
 */
export function FormatBar({ visible, onFormat }: { visible: boolean; onFormat: (action: FormatAction) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardState((state) => state.isVisible);

  if (!visible || !keyboardOpen) return null;

  return (
    <KeyboardStickyView style={styles.dock} offset={{ closed: 0, opened: 0 }}>
      <View
        style={[styles.bar, { paddingLeft: insets.left + spacing.sm, paddingRight: insets.right + spacing.sm }]}
        accessibilityRole="toolbar"
        accessibilityLabel="Formatting"
      >
        {/* Scrolls only on a narrow phone; "always" so a tap formats rather
            than first being spent on dismissing the keyboard. */}
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.buttons}
          style={styles.scroll}
        >
          {BUTTONS.map((button) => (
            <Pressable
              key={button.action}
              onPress={() => onFormat(button.action)}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel={button.label}
            >
              {button.icon ? (
                <Ionicons name={button.icon} size={21} color={colors.text} />
              ) : (
                <Text
                  style={[
                    styles.glyph,
                    button.action === 'bold' && styles.glyphBold,
                    button.action === 'italic' && styles.glyphItalic,
                  ]}
                >
                  {button.text}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.divider} />
        <Pressable
          onPress={() => KeyboardController.dismiss()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Hide keyboard"
        >
          <Ionicons name="chevron-down" size={21} color={colors.text} />
        </Pressable>
      </View>
    </KeyboardStickyView>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  field: {
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
  },
  fieldFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.glassStrong,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15.5,
    lineHeight: 22,
    color: colors.text,
    paddingVertical: 14,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  hint: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: spacing.sm,
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    height: FORMAT_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  scroll: { flex: 1 },
  buttons: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.glassStrong,
  },
  glyph: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.text,
  },
  glyphBold: {
    fontFamily: fonts.bold,
  },
  glyphItalic: {
    fontStyle: 'italic',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.glassBorder,
    marginHorizontal: spacing.xs,
  },
}));

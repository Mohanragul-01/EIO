/**
 * NoteEditScreen - one screen for writing, checklists and journal entries.
 *
 * Same create-or-edit-by-param pattern as the other modules:
 *   navigate('NoteEdit', {})                    -> new note
 *   navigate('NoteEdit', { quick: true })       -> quick capture
 *   navigate('NoteEdit', { type: 'checklist' }) -> new checklist
 *   navigate('NoteEdit', { id })                -> edit
 *
 * One screen for three types rather than three screens, because they differ in
 * exactly one region: what sits where the body goes. Title, tags, saving,
 * deleting and the unsaved-changes guard are identical, and three copies of
 * that would drift apart.
 *
 * QUICK CAPTURE is why the title is no longer required. The point is to get a
 * thought down before it evaporates, so anything that must be filled in first
 * defeats it. A note saved with neither title nor tags lands in the inbox.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  Button,
  DateField,
  FadeInView,
  GlassCard,
  Screen,
  SegmentedControl,
  TextField,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { todayISO } from '../../../core/date';
import { spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { ChecklistEditor } from '../components/ChecklistEditor';
import {
  NOTE_TYPE_LABEL,
  belongsInInbox,
  formatTags,
  parseTags,
  readChecklistItems,
  type ChecklistItem,
  type NoteType,
} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NoteEdit'>;
type Route = RouteProp<RootStackParamList, 'NoteEdit'>;

const TYPES: NoteType[] = ['note', 'checklist', 'journal'];

export function NoteEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const editingId = route.params?.id;
  const isEditing = !!editingId;
  const isQuickCapture = !!route.params?.quick;

  const [noteType, setNoteType] = useState<NoteType>(route.params?.type ?? 'note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  // Journals default to today and can be backdated: writing up last night this
  // morning is the normal case, not the exception.
  const [entryDate, setEntryDate] = useState<string | null>(todayISO());

  const [contentError, setContentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Snapshot of what was loaded, for the unsaved-changes guard. A ref, because
   * comparing against it must never itself cause a render.
   */
  const original = useRef({ title: '', body: '', tagsText: '', items: '[]' });
  const justSaved = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing
        ? `Edit ${NOTE_TYPE_LABEL[noteType].toLowerCase()}`
        : NOTE_TYPE_LABEL[noteType],
    });
  }, [navigation, isEditing, noteType]);

  useEffect(() => {
    if (!editingId) return;

    let active = true;
    (async () => {
      try {
        const note = await api.getNote(editingId);
        if (!active) return;
        const tags = formatTags(note.tags);
        const loadedItems = readChecklistItems(note.checklist_items);

        setNoteType(note.note_type);
        setTitle(note.title);
        setBody(note.body);
        setTagsText(tags);
        setItems(loadedItems);
        setEntryDate(note.entry_date ?? todayISO());
        original.current = {
          title: note.title,
          body: note.body,
          tagsText: tags,
          items: JSON.stringify(loadedItems),
        };
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Could not load this note');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [editingId]);

  /**
   * beforeRemove covers the back arrow, the Android back button and the swipe
   * gesture in one place, which is why it beats overriding the header button.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const dirty =
        title !== original.current.title ||
        body !== original.current.body ||
        tagsText !== original.current.tagsText ||
        JSON.stringify(items) !== original.current.items;

      if (!dirty || justSaved.current) return;

      event.preventDefault();
      Alert.alert('Discard this?', 'Your changes will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });

    return unsubscribe;
  }, [navigation, title, body, tagsText, items]);

  /**
   * There is no required field any more, so "is this worth saving" replaces
   * "is the title filled in". Something entirely empty is the one case worth
   * refusing: it would sit in the list as a blank row you cannot identify.
   */
  const hasContent = useMemo(() => {
    if (title.trim() || body.trim()) return true;
    return noteType === 'checklist' && items.some((item) => item.text.trim());
  }, [title, body, items, noteType]);

  const handleSave = async () => {
    if (!hasContent) {
      setContentError(noteType === 'checklist' ? 'Add an item first' : 'Write something first');
      return;
    }
    setContentError(null);
    setSaving(true);

    try {
      const tags = parseTags(tagsText);
      const trimmedTitle = title.trim();

      const input = {
        title: trimmedTitle,
        body: body.trim(),
        tags,
        note_type: noteType,
        // Recomputed on every save, so adding a title or a tag files the note
        // out of the inbox without needing a separate action.
        is_inbox: belongsInInbox({ title: trimmedTitle, tags, note_type: noteType }),
        entry_date: noteType === 'journal' ? (entryDate ?? todayISO()) : null,
        // Empty lines are dropped rather than stored: they are almost always a
        // half-typed item that was abandoned.
        checklist_items:
          noteType === 'checklist' ? items.filter((item) => item.text.trim()) : null,
      };

      if (isEditing) {
        await api.updateNote(editingId, input);
      } else {
        await api.createNote(input);
      }
      justSaved.current = true; // let the guard through
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    Alert.alert('Delete', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteNote(editingId);
            justSaved.current = true; // nothing left to discard
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={26} color={colors.danger} />
          <Text style={styles.loadError}>{loadError}</Text>
          <Button label="Go back" variant="glass" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  // The type picker is hidden during quick capture and when editing: mid-capture
  // it is one more decision in the way, and after the fact switching type would
  // strand a checklist's items.
  const showTypePicker = !isEditing && !isQuickCapture;

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView>
            <GlassCard>
              {showTypePicker ? (
                <SegmentedControl
                  label="Type"
                  options={TYPES}
                  value={noteType}
                  onChange={setNoteType}
                  renderLabel={(t) => NOTE_TYPE_LABEL[t]}
                />
              ) : null}

              {noteType === 'journal' ? (
                <DateField
                  label="Entry for"
                  value={entryDate}
                  onChange={setEntryDate}
                  // 'event': a journal entry is about a day that has happened.
                  mode="event"
                  allowClear={false}
                  style={showTypePicker ? styles.field : undefined}
                />
              ) : null}

              <TextField
                label="Title"
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (contentError) setContentError(null);
                }}
                placeholder={noteType === 'journal' ? 'Optional' : 'What is this about?'}
                maxLength={200}
                returnKeyType="next"
                style={showTypePicker || noteType === 'journal' ? styles.field : undefined}
              />

              {noteType === 'checklist' ? (
                <View style={styles.field}>
                  <ChecklistEditor
                    items={items}
                    onChange={(next) => {
                      setItems(next);
                      if (contentError) setContentError(null);
                    }}
                  />
                </View>
              ) : (
                <TextField
                  label={noteType === 'journal' ? 'Entry' : 'Note'}
                  value={body}
                  onChangeText={(text) => {
                    setBody(text);
                    if (contentError) setContentError(null);
                  }}
                  placeholder={
                    noteType === 'journal'
                      ? 'How was it?'
                      : 'Write as much or as little as you like'
                  }
                  multiline
                  // Quick capture opens straight into the body: the thought is
                  // the point, everything else can wait.
                  autoFocus={isQuickCapture}
                  style={styles.field}
                />
              )}

              <TextField
                label="Tags"
                value={tagsText}
                onChangeText={setTagsText}
                placeholder="work, ideas, follow-up"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.field}
              />
              <Text style={styles.hint}>
                {isQuickCapture
                  ? 'Skip these and it lands in the inbox to file later.'
                  : 'Separate with commas. Lowercased and de-duplicated on save.'}
              </Text>

              {contentError ? <Text style={styles.error}>{contentError}</Text> : null}
            </GlassCard>
          </FadeInView>

          <FadeInView delay={80}>
            <Button
              label={isEditing ? 'Save changes' : 'Save'}
              icon="checkmark"
              onPress={handleSave}
              loading={saving}
              style={styles.save}
            />

            {isEditing ? (
              <Button
                label="Delete"
                icon="trash-outline"
                variant="ghost"
                onPress={handleDelete}
                style={styles.delete}
              />
            ) : null}
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104, // clears the transparent nav header
    paddingBottom: spacing.xxxl,
  },
  field: {
    marginTop: spacing.xxl,
  },
  hint: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
  },
  save: {
    marginTop: spacing.xxl,
  },
  delete: {
    marginTop: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  loadError: {
    ...typography.body,
    textAlign: 'center',
  },
}));

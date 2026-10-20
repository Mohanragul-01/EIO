/**
 * NoteEditScreen - one screen for writing, checklists and journal entries.
 *
 * Same create-or-edit-by-param pattern as the other modules:
 *   navigate('NoteEdit', {})                         -> new note
 *   navigate('NoteEdit', { quick: true })            -> quick capture
 *   navigate('NoteEdit', { type: 'checklist' })      -> new checklist
 *   navigate('NoteEdit', { type: 'journal', prompt }) -> new entry from a prompt
 *   navigate('NoteEdit', { id })                     -> read, then edit
 *
 * One screen for three types rather than three screens, because they differ in
 * exactly one region: what sits where the body goes. Title, tags, saving,
 * deleting and the unsaved-changes guard are identical, and three copies of
 * that would drift apart.
 *
 * QUICK CAPTURE is why the title is not required. The point is to get a
 * thought down before it evaporates, so anything that must be filled in first
 * defeats it. A note saved with neither title nor tags lands in the inbox.
 *
 * DELETE IS "MOVE TO TRASH" since v3: no "are you sure", because it is not
 * permanent. The screen closes and the list offers Undo for five seconds; the
 * Trash keeps the note for 30 days after that.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import {
  Button,
  DateField,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  SegmentedControl,
  TextField,
  useToast,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate, todayISO } from '../../../core/date';
import { tap } from '../../../core/haptics';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { ActionSheet } from '../components/ActionSheet';
import { ChecklistEditor } from '../components/ChecklistEditor';
import { ChecklistRead } from '../components/ChecklistRead';
import { ColorPicker } from '../components/ColorPicker';
import {
  FORMAT_BAR_HEIGHT,
  FormatBar,
  MarkdownInput,
  useMarkdownEditor,
} from '../components/MarkdownEditor';
import { MarkdownView } from '../components/MarkdownView';
import { TRASH_DAYS } from '../library';
import { toggleTask } from '../markdown';
import { readNoteColor, type NoteColorKey } from '../noteColors';
import { notesChanged } from '../notesEvents';
import {
  NOTE_TYPE_LABEL,
  belongsInInbox,
  deleteTicked,
  formatTags,
  parseTags,
  readChecklistItems,
  toggleItem,
  uncheckAll,
  withDraftItem,
  type ChecklistItem,
  type NoteType,
} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NoteEdit'>;
type Route = RouteProp<RootStackParamList, 'NoteEdit'>;

const TYPES: NoteType[] = ['note', 'checklist', 'journal'];

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const countItems = (n: number) => (n === 1 ? '1 item' : `${n} items`);

/** Where the background undo of an action taken here reports a failure: nowhere to show it, so the list reloads. */
const afterUndo = (write: Promise<void>) => {
  write.then(notesChanged).catch(notesChanged);
};

export function NoteEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const toast = useToast();

  const editingId = route.params?.id;
  const isEditing = !!editingId;
  const isQuickCapture = !!route.params?.quick;

  // A prompt answered from the Journal starts the entry as a quote, so the
  // question stays with the answer when it is read back next year.
  const prefill = route.params?.prompt ? `> ${route.params.prompt}\n\n` : '';

  const [noteType, setNoteType] = useState<NoteType>(route.params?.type ?? 'note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(prefill);
  const [tagsText, setTagsText] = useState('');
  const [items, setItems] = useState<ChecklistItem[]>([]);
  /** "Add an item" as typed: Save keeps it, and leaving asks about it. */
  const [itemDraft, setItemDraft] = useState('');
  // Journals default to today and can be backdated: writing up last night this
  // morning is the normal case, not the exception.
  const [entryDate, setEntryDate] = useState<string | null>(todayISO());

  // The note's place in the library. Not part of the form: like a tick, each
  // of these saves the moment it changes and is never "discarded".
  const [pinnedAt, setPinnedAt] = useState<string | null>(null);
  const [color, setColor] = useState<NoteColorKey | null>(null);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [deletedAt, setDeletedAt] = useState<string | null>(null);

  /**
   * Read or edit.
   *
   * An EXISTING note opens in read mode; a new one opens straight into edit,
   * because there is nothing to read yet. In read mode a tick - on a
   * checklist, or on a `- [ ]` box in a note - is the only thing you can
   * change, and it writes immediately, which is what a checklist is for.
   * Every other edit is a deliberate act and belongs behind Edit, where Save
   * and Discard mean something.
   */
  const [mode, setMode] = useState<'read' | 'edit'>(route.params?.id ? 'read' : 'edit');
  const [tickError, setTickError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [contentError, setContentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const editor = useMarkdownEditor(body, (text) => {
    setBody(text);
    if (contentError) setContentError(null);
  });

  /**
   * Snapshot of what was loaded, for the unsaved-changes guard. A ref, because
   * comparing against it must never itself cause a render.
   */
  const original = useRef({
    title: '',
    body: prefill,
    tagsText: '',
    items: '[]',
    // Type and entry date are part of the note too. Leaving them out of the
    // snapshot meant changing only a journal's date, or switching a note to a
    // checklist, and pressing back discarded it with no prompt at all.
    noteType: (route.params?.type ?? 'note') as NoteType,
    entryDate: todayISO() as string | null,
  });
  const justSaved = useRef(false);

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
        setPinnedAt(note.pinned_at);
        setColor(readNoteColor(note.color)?.key ?? null);
        setArchivedAt(note.archived_at);
        setDeletedAt(note.deleted_at);
        original.current = {
          title: note.title,
          body: note.body,
          tagsText: tags,
          items: JSON.stringify(loadedItems),
          noteType: note.note_type,
          entryDate: note.entry_date ?? todayISO(),
        };
      } catch (e) {
        if (active) setLoadError(message(e, 'Could not load this note'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [editingId]);

  /* READ-MODE WRITES ------------------------------------------------------- */

  /**
   * Write a checklist straight away, optimistically.
   *
   * The box fills the instant you press it, because a checklist is used
   * standing in a shop and a round trip per tick would feel broken. A failure
   * puts the list back and says so, rather than leaving the screen claiming
   * something the database does not agree with.
   *
   * `original` is updated too, or the dirty check would think the note had
   * unsaved changes and offer to discard work that is already saved.
   */
  const writeItems = useCallback(
    async (next: ChecklistItem[], previous: ChecklistItem[], failure: string) => {
      if (!editingId) return false;
      setItems(next);
      setTickError(null);
      try {
        await api.setChecklistItems(editingId, next);
        original.current = { ...original.current, items: JSON.stringify(next) };
        return true;
      } catch (e) {
        setItems(previous);
        setTickError(message(e, failure));
        return false;
      }
    },
    [editingId],
  );

  /** An Undo of a mass checklist change, which may run after this screen has gone. */
  const restoreItems = useCallback(
    (previous: ChecklistItem[]) => {
      if (!editingId) return;
      setItems(previous);
      original.current = { ...original.current, items: JSON.stringify(previous) };
      afterUndo(api.setChecklistItems(editingId, previous));
    },
    [editingId],
  );

  const onUncheckAll = useCallback(async () => {
    const previous = items;
    const count = previous.filter((i) => i.done).length;
    if (await writeItems(uncheckAll(previous), previous, 'Could not uncheck the list')) {
      toast.show({
        message: `Unchecked ${countItems(count)}`,
        actionLabel: 'Undo',
        onAction: () => restoreItems(previous),
      });
    }
  }, [items, writeItems, restoreItems, toast]);

  const onDeleteTicked = useCallback(async () => {
    const previous = items;
    const count = previous.filter((i) => i.done).length;
    if (await writeItems(deleteTicked(previous), previous, 'Could not delete the ticked items')) {
      toast.show({
        message: `Deleted ${countItems(count)}`,
        actionLabel: 'Undo',
        onAction: () => restoreItems(previous),
      });
    }
  }, [items, writeItems, restoreItems, toast]);

  /** Tick a `- [ ]` box in a note's body: the same rule as a checklist tick. */
  const toggleBodyTask = useCallback(
    async (line: number) => {
      if (!editingId) return;
      const previous = body;
      const next = toggleTask(previous, line);
      if (next === previous) return;
      setBody(next);
      setTickError(null);
      try {
        await api.setBody(editingId, next);
        original.current = { ...original.current, body: next };
      } catch (e) {
        setBody(previous);
        setTickError(message(e, 'Could not save that tick'));
      }
    },
    [editingId, body],
  );

  const togglePin = useCallback(async () => {
    if (!editingId) return;
    const previous = pinnedAt;
    const next = previous ? null : new Date().toISOString();
    tap();
    setPinnedAt(next);
    try {
      await api.setPinned([editingId], next);
    } catch (e) {
      setPinnedAt(previous);
      setTickError(message(e, 'Could not change the pin'));
    }
  }, [editingId, pinnedAt]);

  const pickColor = useCallback(
    async (next: NoteColorKey | null) => {
      if (!editingId) return;
      setMenuOpen(false);
      const previous = color;
      setColor(next);
      try {
        await api.setColor([editingId], next);
      } catch (e) {
        setColor(previous);
        setTickError(message(e, 'Could not change the colour'));
      }
    },
    [editingId, color],
  );

  /** Leave, then offer Undo from the list: the toast outlives this screen. */
  const leaveWithUndo = useCallback(
    (text: string, undo: () => Promise<void>) => {
      justSaved.current = true; // nothing left to discard
      navigation.goBack();
      toast.show({ message: text, actionLabel: 'Undo', onAction: () => afterUndo(undo()) });
    },
    [navigation, toast],
  );

  const moveToTrash = useCallback(async () => {
    if (!editingId) return;
    setMenuOpen(false);
    try {
      await api.trashNotes([editingId], new Date().toISOString());
      leaveWithUndo('Moved to Trash', () => api.restoreNotes([editingId]));
    } catch (e) {
      Alert.alert('Could not move it to the Trash', message(e, 'Please try again.'));
    }
  }, [editingId, leaveWithUndo]);

  const toggleArchive = useCallback(async () => {
    if (!editingId) return;
    setMenuOpen(false);
    const previous = archivedAt;
    try {
      if (previous) {
        await api.setArchived([editingId], null);
        setArchivedAt(null);
        toast.show({
          message: 'Moved back to Notes',
          actionLabel: 'Undo',
          onAction: () => {
            setArchivedAt(previous);
            afterUndo(api.setArchived([editingId], previous));
          },
        });
      } else {
        await api.setArchived([editingId], new Date().toISOString());
        leaveWithUndo('Archived', () => api.setArchived([editingId], null));
      }
    } catch (e) {
      Alert.alert('Could not change the archive', message(e, 'Please try again.'));
    }
  }, [editingId, archivedAt, leaveWithUndo, toast]);

  const restoreFromTrash = useCallback(async () => {
    if (!editingId) return;
    try {
      await api.restoreNotes([editingId]);
      setDeletedAt(null);
      notesChanged();
      toast.show({ message: 'Restored' });
    } catch (e) {
      Alert.alert('Could not restore it', message(e, 'Please try again.'));
    }
  }, [editingId, toast]);

  /* HEADER ----------------------------------------------------------------- */

  const inTrash = deletedAt !== null;

  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        !isEditing || mode === 'edit'
          ? isEditing
            ? `Edit ${NOTE_TYPE_LABEL[noteType].toLowerCase()}`
            : NOTE_TYPE_LABEL[noteType]
          : inTrash
            ? 'In the Trash'
            : NOTE_TYPE_LABEL[noteType],
      // Read mode only; in edit mode the footer already has Save, and two
      // competing commit points is one too many. A note in the Trash is
      // read-only until it is restored, as in Notion.
      headerRight:
        isEditing && mode === 'read' && !loading && !loadError && !inTrash
          ? () => (
              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => void togglePin()}
                  style={styles.headerButton}
                  accessibilityRole="button"
                  accessibilityLabel={pinnedAt ? 'Unpin' : 'Pin to top'}
                  accessibilityState={{ selected: !!pinnedAt }}
                >
                  <Ionicons name={pinnedAt ? 'pin' : 'pin-outline'} size={20} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => setMenuOpen(true)}
                  style={styles.headerButton}
                  accessibilityRole="button"
                  accessibilityLabel="More: colour, archive, move to Trash"
                >
                  <Ionicons name="ellipsis-vertical" size={19} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => setMode('edit')}
                  style={styles.headerButton}
                  accessibilityRole="button"
                  accessibilityLabel="Edit this note"
                >
                  <Ionicons name="create-outline" size={20} color={colors.text} />
                </Pressable>
              </View>
            )
          : undefined,
    });
  }, [
    navigation,
    isEditing,
    noteType,
    mode,
    loading,
    loadError,
    inTrash,
    pinnedAt,
    togglePin,
    colors.text,
    styles.headerActions,
    styles.headerButton,
  ]);

  /**
   * beforeRemove covers the back arrow, the Android back button and the swipe
   * gesture in one place, which is why it beats overriding the header button.
   */
  useEffect(() => {
    // Read mode has nothing buffered - ticks are already written - so the
    // discard prompt would be asking about changes that do not exist.
    if (mode === 'read') return;

    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const dirty =
        title !== original.current.title ||
        body !== original.current.body ||
        tagsText !== original.current.tagsText ||
        JSON.stringify(items) !== original.current.items ||
        (noteType === 'checklist' && itemDraft.trim() !== '') ||
        noteType !== original.current.noteType ||
        entryDate !== original.current.entryDate;

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
    // `mode` belongs here: without it the effect kept a stale copy and the
    // guard's registration lagged a render behind the switch into edit mode.
  }, [navigation, title, body, tagsText, items, itemDraft, noteType, entryDate, mode]);

  /**
   * There is no required field, so "is this worth saving" replaces "is the
   * title filled in". Something entirely empty is the one case worth refusing:
   * it would sit in the list as a blank row you cannot identify. An untouched
   * prompt counts as empty - the question alone is not an entry.
   */
  const hasContent = useMemo(() => {
    if (title.trim()) return true;
    if (body.trim() && body !== prefill) return true;
    return noteType === 'checklist' && withDraftItem(items, itemDraft).some((item) => item.text.trim());
  }, [title, body, prefill, items, itemDraft, noteType]);

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
        // trimEnd, not trim: leading spaces can be a nested list's indent.
        body: body.replace(/^\n+/, '').trimEnd(),
        tags,
        note_type: noteType,
        // Recomputed on every save, so adding a title or a tag files the note
        // out of the inbox without needing a separate action.
        is_inbox: belongsInInbox({ title: trimmedTitle, tags, note_type: noteType }),
        entry_date: noteType === 'journal' ? (entryDate ?? todayISO()) : null,
        // Empty lines are dropped rather than stored: they are almost always a
        // half-typed item that was abandoned. A line typed into "Add an item"
        // and saved without pressing Add is the opposite, and is kept.
        checklist_items:
          noteType === 'checklist'
            ? withDraftItem(items, itemDraft).filter((item) => item.text.trim())
            : null,
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
      Alert.alert('Could not save', message(e, 'Please try again.'));
    }
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
  const showTypePicker = !isEditing && !isQuickCapture && !route.params?.prompt;
  const noteColor = readNoteColor(color);

  if (mode === 'read') {
    // Words, not just the stripe: a colour on its own says nothing to TalkBack
    // or to anyone who cannot tell two of them apart.
    const status = [
      pinnedAt ? 'Pinned' : null,
      noteColor ? noteColor.label : null,
      archivedAt ? 'Archived' : null,
    ].filter(Boolean);

    return (
      <Screen padded={false}>
        <FormScroll contentContainerStyle={styles.scroll}>
          <FadeInView>
            {inTrash ? (
              <GlassCard style={styles.trashBanner}>
                <View style={styles.errorRow}>
                  <Ionicons name="trash-outline" size={17} color={colors.textSecondary} />
                  <Text style={styles.trashText}>
                    This note is in the Trash and is deleted for good {TRASH_DAYS} days after it was moved
                    there. Restore it to change it.
                  </Text>
                </View>
                <Button
                  label="Restore"
                  icon="arrow-undo-outline"
                  variant="glass"
                  onPress={() => void restoreFromTrash()}
                  style={styles.field}
                />
              </GlassCard>
            ) : null}

            <GlassCard padded={false}>
              {noteColor ? (
                <View pointerEvents="none" style={[styles.stripe, { backgroundColor: noteColor.swatch }]} />
              ) : null}
              <View style={styles.readBody}>
                {noteType === 'journal' && entryDate ? (
                  <Text style={styles.readDate}>{formatEventDate(entryDate)}</Text>
                ) : null}

                {title ? <Text style={styles.readTitle}>{title}</Text> : null}
                {status.length > 0 ? <Text style={styles.readStatus}>{status.join(' · ')}</Text> : null}

                {noteType === 'checklist' ? (
                  <View style={title ? styles.gap : undefined}>
                    {items.length === 0 ? (
                      <Text style={styles.readEmpty}>
                        This list has no items yet. Tap Edit to add some.
                      </Text>
                    ) : (
                      <>
                        <ChecklistRead
                          items={items}
                          onToggle={
                            inTrash
                              ? undefined
                              : (index) => void writeItems(toggleItem(items, index), items, 'Could not save that tick')
                          }
                          onUncheckAll={inTrash ? undefined : () => void onUncheckAll()}
                          onDeleteTicked={inTrash ? undefined : () => void onDeleteTicked()}
                        />
                        <Text style={styles.readProgress}>
                          {items.filter((i) => i.done).length} of {items.length} done
                          {inTrash ? '' : ' · saved as you tick'}
                        </Text>
                      </>
                    )}
                  </View>
                ) : body ? (
                  <View style={title ? styles.gap : undefined}>
                    <MarkdownView
                      body={body}
                      onToggleTask={inTrash ? undefined : (line) => void toggleBodyTask(line)}
                    />
                  </View>
                ) : (
                  <Text style={styles.readEmpty}>This note is empty. Tap Edit to write something.</Text>
                )}

                {tagsText.trim() ? <Text style={styles.readTags}>{tagsText}</Text> : null}
              </View>
            </GlassCard>

            {tickError ? (
              <GlassCard style={[styles.field, styles.errorCard]}>
                <View style={styles.errorRow}>
                  <Ionicons name="warning-outline" size={17} color={colors.danger} />
                  <Text style={styles.errorText}>{tickError}</Text>
                </View>
              </GlassCard>
            ) : null}
          </FadeInView>
        </FormScroll>

        <ActionSheet
          visible={menuOpen}
          title={title || NOTE_TYPE_LABEL[noteType]}
          subtitle="Colour, archive or move to Trash"
          onClose={() => setMenuOpen(false)}
          actions={[
            {
              key: 'archive',
              label: archivedAt ? 'Unarchive' : 'Archive',
              detail: archivedAt ? 'Back to its tab' : 'Kept, but out of the tabs and search',
              icon: archivedAt ? 'arrow-undo-outline' : 'archive-outline',
              onPress: () => void toggleArchive(),
            },
            {
              key: 'trash',
              label: 'Move to Trash',
              detail: `Kept for ${TRASH_DAYS} days, then deleted`,
              icon: 'trash-outline',
              onPress: () => void moveToTrash(),
            },
          ]}
        >
          <Text style={styles.menuLabel}>Colour</Text>
          <ColorPicker value={color} onPick={(next) => void pickColor(next)} />
        </ActionSheet>
      </Screen>
    );
  }

  const barVisible = editor.focused && noteType !== 'checklist';

  return (
    <Screen padded={false}>
      <FormScroll
        contentContainerStyle={styles.scroll}
        // Room for the formatting bar as well as the usual gap, or the line
        // being typed would sit underneath it.
        bottomOffset={barVisible ? 24 + FORMAT_BAR_HEIGHT : 24}
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
                  draft={itemDraft}
                  onDraftChange={(text) => {
                    setItemDraft(text);
                    if (contentError) setContentError(null);
                  }}
                />
              </View>
            ) : (
              <View style={styles.field}>
                <MarkdownInput
                  {...editor.inputProps}
                  focused={editor.focused}
                  label={noteType === 'journal' ? 'Entry' : 'Note'}
                  placeholder={
                    noteType === 'journal' ? 'How was it?' : 'Write as much or as little as you like'
                  }
                  // Quick capture and a prompt open straight into the body:
                  // the thought is the point, everything else can wait.
                  autoFocus={isQuickCapture || !!route.params?.prompt}
                />
              </View>
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
              label="Move to Trash"
              icon="trash-outline"
              variant="ghost"
              onPress={() => void moveToTrash()}
              style={styles.delete}
            />
          ) : null}
        </FadeInView>
      </FormScroll>

      <FormatBar visible={barVisible} onFormat={editor.format} />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginRight: -spacing.sm,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  readBody: {
    padding: 18,
  },
  readTitle: {
    ...typography.title,
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  readStatus: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  readDate: {
    ...typography.overline,
    marginBottom: spacing.xs,
  },
  readEmpty: {
    ...typography.body,
    color: colors.textMuted,
  },
  readTags: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  readProgress: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  gap: {
    marginTop: spacing.md,
  },
  trashBanner: {
    marginBottom: spacing.md,
  },
  trashText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  menuLabel: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  errorCard: {
    borderColor: colors.danger,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
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

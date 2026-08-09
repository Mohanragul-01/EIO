/**
 * NoteEditScreen - one screen for both writing and editing a note.
 *
 * Same create-or-edit-by-param pattern as TodoEditScreen:
 *   navigate('NoteEdit', {})            -> new note
 *   navigate('NoteEdit', { id: '...' })   -> edit
 *
 * One thing here that the Todo form didn't need: an UNSAVED-CHANGES GUARD.
 * A note is something you spend minutes typing, so silently discarding it on a
 * back-swipe would be genuinely bad. A task title isn't worth the same
 * ceremony. Matching the friction to what's at stake is a judgement call worth
 * making per screen rather than applying one rule everywhere.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button, FadeInView, GlassCard, Screen, TextField } from '../../../core/components';
import { spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { formatTags, parseTags } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NoteEdit'>;
type Route = RouteProp<RootStackParamList, 'NoteEdit'>;

export function NoteEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;
  const isEditing = !!editingId;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsText, setTagsText] = useState('');

  const [titleError, setTitleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * A snapshot of what was loaded, so we can tell whether anything actually
   * changed. A ref, not state: comparing against it must never itself cause a
   * re-render.
   */
  const original = useRef({ title: '', body: '', tagsText: '' });
  // Set on a successful save so the guard doesn't fire on the way out.
  const justSaved = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit note' : 'New note' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!editingId) return;

    let active = true;
    (async () => {
      try {
        const note = await api.getNote(editingId);
        if (!active) return;
        const tags = formatTags(note.tags);
        setTitle(note.title);
        setBody(note.body);
        setTagsText(tags);
        original.current = { title: note.title, body: note.body, tagsText: tags };
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
   * beforeRemove fires when the screen is about to leave the stack - the back
   * arrow, the Android back button, AND the iOS swipe gesture. That's why it's
   * the right hook for this rather than overriding the header button: it
   * covers every exit route at once.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const dirty =
        title !== original.current.title ||
        body !== original.current.body ||
        tagsText !== original.current.tagsText;

      if (!dirty || justSaved.current) return;

      // Stop the navigation, then re-issue it only if the user confirms.
      event.preventDefault();
      Alert.alert('Discard note?', 'Your changes will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });

    return unsubscribe;
  }, [navigation, title, body, tagsText]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Give the note a title');
      return;
    }
    setTitleError(null);
    setSaving(true);

    try {
      const input = { title: trimmedTitle, body: body.trim(), tags: parseTags(tagsText) };
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
    Alert.alert('Delete note', 'This cannot be undone.', [
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
              <TextField
                label="Title"
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (titleError) setTitleError(null);
                }}
                placeholder="What's this about?"
                error={titleError}
                autoFocus={!isEditing}
                maxLength={200}
                returnKeyType="next"
              />

              <TextField
                label="Note"
                value={body}
                onChangeText={setBody}
                placeholder="Write as much or as little as you like..."
                // multiline turns this into a growing text area - see the
                // inputMultiline style in TextField.
                multiline
                style={styles.field}
              />

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
                Separate with commas. They're lowercased and de-duplicated on save.
              </Text>
            </GlassCard>
          </FadeInView>

          <FadeInView delay={80}>
            <Button
              label={isEditing ? 'Save changes' : 'Save note'}
              icon="checkmark"
              onPress={handleSave}
              loading={saving}
              style={styles.save}
            />

            {isEditing ? (
              <Button
                label="Delete note"
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
    paddingTop: 104,
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

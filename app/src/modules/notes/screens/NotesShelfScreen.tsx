/**
 * NotesShelfScreen - the Trash, or the Archive: the notes the tabs hide.
 *
 * THE TRASH replaces "This cannot be undone". Deleting a note moves it here,
 * where it waits 30 days before it is deleted for good - long enough to notice
 * a mistake, short enough that the Trash does not become a second archive.
 * Notes here are read-only, as in Notion: tap one to Restore it or Delete it
 * forever. Those two, and Empty trash, are the only confirms in Notes,
 * because they are the only things in Notes that cannot be undone.
 *
 * THE ARCHIVE is "done with it, keep it": an old packing list, a finished
 * project. Archived notes open as usual; holding one offers Unarchive or Move
 * to Trash, both with Undo.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, FadeInView, GlassCard, Screen, useToast } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { warning } from '../../../core/haptics';
import { layout, motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { ActionSheet } from '../components/ActionSheet';
import { NoteCard } from '../components/NoteCard';
import { TRASH_DAYS, purgeLabel } from '../library';
import { stripMarkdown } from '../markdown';
import * as api from '../api';
import type { Note } from '../types';
import { useNotesShelf } from '../useNotes';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotesShelf'>;
type Route = RouteProp<RootStackParamList, 'NotesShelf'>;

const nameOf = (note: Note) =>
  note.title || stripMarkdown(note.body).replace(/\s+/g, ' ').trim().slice(0, 60) || 'Untitled note';

export function NotesShelfScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { shelf } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const isTrash = shelf === 'trash';

  const { notes, loading, error, reload, restore, deleteForever, unarchive, trash, putBack, emptyTrash } =
    useNotesShelf(shelf);

  const [acting, setActing] = useState<Note | null>(null);
  // The clock, read when the list is drawn, so "Deletes in 12 days" is a pure
  // function of the rows and this moment.
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void reload();
    }, [reload]),
  );

  const confirmEmpty = useCallback(() => {
    if (notes.length === 0) return;
    warning();
    Alert.alert(
      'Empty the Trash?',
      `${notes.length === 1 ? '1 note' : `${notes.length} notes`} will be deleted for good. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty trash',
          style: 'destructive',
          onPress: () => {
            void emptyTrash().then((ok) => {
              if (ok) toast.show({ message: 'Trash emptied' });
            });
          },
        },
      ],
    );
  }, [notes.length, emptyTrash, toast]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isTrash ? 'Trash' : 'Archive',
      headerRight:
        isTrash && notes.length > 0
          ? () => (
              <Pressable
                onPress={confirmEmpty}
                style={styles.headerAction}
                accessibilityRole="button"
                accessibilityLabel="Empty trash"
              >
                <Text style={styles.headerActionText}>Empty</Text>
              </Pressable>
            )
          : undefined,
    });
  }, [navigation, isTrash, notes.length, confirmEmpty, styles.headerAction, styles.headerActionText]);

  /* ACTIONS ---------------------------------------------------------------- */

  const doRestore = async (note: Note) => {
    setActing(null);
    if (await restore([note.id])) {
      toast.show({
        message: 'Restored',
        actionLabel: 'Undo',
        onAction: () => putBack([note], () => api.trashNotes([note.id], note.deleted_at ?? new Date().toISOString())),
      });
    }
  };

  const doDeleteForever = (note: Note) => {
    setActing(null);
    warning();
    Alert.alert('Delete forever?', `"${nameOf(note)}" will be deleted for good. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: () => void deleteForever([note.id]),
      },
    ]);
  };

  const doUnarchive = async (note: Note) => {
    setActing(null);
    if (await unarchive([note.id])) {
      toast.show({
        message: 'Moved back to Notes',
        actionLabel: 'Undo',
        onAction: () => putBack([note], () => api.setArchived([note.id], note.archived_at ?? new Date().toISOString())),
      });
    }
  };

  const doTrash = async (note: Note) => {
    setActing(null);
    if (await trash([note.id])) {
      toast.show({
        message: 'Moved to Trash',
        actionLabel: 'Undo',
        onAction: () => putBack([note], () => api.restoreNotes([note.id])),
      });
    }
  };

  const actions = !acting
    ? []
    : isTrash
      ? [
          {
            key: 'restore',
            label: 'Restore',
            detail: acting.archived_at ? 'Back to the Archive' : 'Back where it was',
            icon: 'arrow-undo-outline' as const,
            onPress: () => void doRestore(acting),
          },
          {
            key: 'delete',
            label: 'Delete forever',
            detail: 'Cannot be undone',
            icon: 'trash-outline' as const,
            tone: 'danger' as const,
            onPress: () => doDeleteForever(acting),
          },
        ]
      : [
          {
            key: 'open',
            label: 'Open',
            icon: 'document-text-outline' as const,
            onPress: () => {
              setActing(null);
              navigation.navigate('NoteEdit', { id: acting.id });
            },
          },
          {
            key: 'unarchive',
            label: 'Unarchive',
            detail: 'Back to its tab',
            icon: 'arrow-undo-outline' as const,
            onPress: () => void doUnarchive(acting),
          },
          {
            key: 'trash',
            label: 'Move to Trash',
            detail: `Kept for ${TRASH_DAYS} days`,
            icon: 'trash-outline' as const,
            onPress: () => void doTrash(acting),
          },
        ];

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={notes}
        keyExtractor={(note) => note.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, notes.length === 0 && styles.listEmpty]}
        ListHeaderComponent={
          notes.length > 0 ? (
            <View style={styles.banner}>
              <Ionicons
                name={isTrash ? 'time-outline' : 'archive-outline'}
                size={17}
                color={colors.textSecondary}
              />
              <Text style={styles.bannerText}>
                {isTrash
                  ? `Notes in the Trash are deleted for good ${TRASH_DAYS} days after they were moved here. Tap one to restore it.`
                  : 'Archived notes are kept but left out of the tabs and search. Hold one to unarchive it.'}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={isTrash ? 'trash-outline' : 'archive-outline'}
            accent={colors.accentAmber}
            title={isTrash ? 'Nothing in the Trash' : 'Nothing archived'}
            message={
              isTrash
                ? `Notes you delete wait here for ${TRASH_DAYS} days, so a mistake can be undone.`
                : 'Archive a note you are done with but want to keep. Hold a note in any tab to archive it.'
            }
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <NoteCard
              note={item}
              meta={isTrash && item.deleted_at ? purgeLabel(item.deleted_at, now) : undefined}
              onPress={() => (isTrash ? setActing(item) : navigation.navigate('NoteEdit', { id: item.id }))}
              onLongPress={() => setActing(item)}
              longPressHint={isTrash ? 'Hold for Restore or Delete forever' : 'Hold to unarchive or move to Trash'}
            />
          </FadeInView>
        )}
      />

      {error ? (
        <FadeInView style={[styles.errorWrap, { bottom: insets.bottom + layout.aboveFab }]}>
          <GlassCard style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Ionicons name="warning-outline" size={17} color={colors.danger} />
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            </View>
          </GlassCard>
        </FadeInView>
      ) : null}

      <ActionSheet
        visible={acting !== null}
        title={acting ? nameOf(acting) : ''}
        subtitle={
          acting && isTrash && acting.deleted_at
            ? purgeLabel(acting.deleted_at, now)
            : acting
              ? 'Archived'
              : undefined
        }
        actions={actions}
        onClose={() => setActing(null)}
      />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104, // clears the transparent nav header
    paddingBottom: layout.aboveFab + 64,
  },
  listEmpty: { flexGrow: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  bannerText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  headerAction: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    ...typography.title,
    fontSize: 15,
    color: colors.danger,
  },
  errorWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
  },
  errorCard: { borderColor: colors.danger + '55' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  errorText: { ...typography.caption, color: colors.text, flex: 1 },
}));

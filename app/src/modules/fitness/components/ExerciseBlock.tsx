/**
 * ExerciseBlock - one exercise in a session: its header and its set table.
 *
 *   SET · PREVIOUS · LOAD · REPS (or TIME) · ✓
 *
 * The table is the whole logging loop. Each row starts as a draft with
 * GHOST values - the routine's target, or last time's matching set - drawn
 * faint in the cells, and ticking a row with empty cells commits the ghosts.
 * So the common case, "same as last time", is one tap per set.
 *
 * A ticked row is saved at once and tinted with `completed` (plus a filled
 * check, so the state is never colour alone). Ticking it again unticks it:
 * the set is deleted and its values come back as a draft to edit. Swipe a
 * row left to delete it; "Remove" in the set's sheet does the same without
 * a gesture. This screen is a full-screen route, not inside the tab pager,
 * which is why a row swipe is allowed here.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { GlassCard } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { DraftRow } from '../blocks';
import { formatHoldShort, formatLoadChip, formatSetShort, setLabels, type SetFact } from '../load';
import { primaryRecord, type RecordHit } from '../records';
import type { BlockState, Ghost, Row } from '../sessionState';
import { formatDuration, type Band, type Exercise, type SetType } from '../types';

type Props = {
  block: BlockState;
  exercise: Exercise | undefined;
  bandsById: Record<string, Band>;
  records: Record<string, RecordHit[]>;
  restSeconds: number;
  previousFor: (index: number) => SetFact | null;
  ghostFor: (index: number) => Ghost;
  onOpenExercise: () => void;
  onMenu: () => void;
  onRest: () => void;
  onTick: (key: string) => void;
  onUntick: (key: string) => void;
  onSetMenu: (key: string) => void;
  onLoad: (key: string) => void;
  onChangeDraft: (key: string, patch: Partial<Omit<DraftRow, 'key'>>) => void;
  onDelete: (key: string) => void;
  onAddSet: () => void;
  onNoteBlur: (note: string) => void;
};

const typeOf = (row: Row): SetType =>
  row.kind === 'saved' ? row.set.set_type : row.draft.set_type;

/** "60", "62.5"; a ghost of 0 shows nothing rather than a misleading "0". */
const fmt = (n: number | null) =>
  n === null || n === 0 ? '' : Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

export function ExerciseBlock(props: Props) {
  const { block, exercise } = props;
  const styles = useStyles();
  const { colors } = useTheme();
  const [note, setNote] = useState(block.sessionExercise?.note ?? '');

  const timed = exercise?.tracking_type === 'time';
  const bodyweight = exercise?.load_mode === 'bodyweight';
  const labels = setLabels(block.rows.map((row) => ({ set_type: typeOf(row) })));
  const name = exercise?.name ?? 'Exercise';

  return (
    <GlassCard style={styles.card} padded={false}>
      <View style={styles.head}>
        <Pressable
          onPress={props.onOpenExercise}
          accessibilityRole="link"
          accessibilityLabel={`${name}, open its history`}
          style={styles.titleHit}
        >
          <Text style={styles.title} numberOfLines={2}>
            {name}
          </Text>
        </Pressable>
        <Pressable
          onPress={props.onRest}
          accessibilityRole="button"
          accessibilityLabel={
            props.restSeconds > 0
              ? `Rest ${formatDuration(props.restSeconds)} after each set. Change`
              : 'No rest timer. Change'
          }
          style={({ pressed }) => [styles.restChip, pressed && styles.pressed]}
        >
          <Ionicons name="timer-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.restLabel}>
            {props.restSeconds > 0 ? formatDuration(props.restSeconds) : 'Off'}
          </Text>
        </Pressable>
        <Pressable
          onPress={props.onMenu}
          accessibilityRole="button"
          accessibilityLabel={`More for ${name}`}
          style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {exercise?.pinned_note ? (
        <View style={styles.pinned}>
          <Ionicons name="pin" size={13} color={colors.warning} />
          <Text style={styles.pinnedText}>{exercise.pinned_note}</Text>
        </View>
      ) : null}

      <TextInput
        value={note}
        onChangeText={setNote}
        onBlur={() => props.onNoteBlur(note)}
        placeholder="Note for today"
        placeholderTextColor={colors.textFaint}
        style={styles.note}
        accessibilityLabel={`Note for ${name} today`}
      />

      <View style={styles.headerRow} importantForAccessibility="no-hide-descendants">
        <Text style={[styles.th, styles.colSet]}>SET</Text>
        <Text style={[styles.th, styles.colPrev]}>PREVIOUS</Text>
        <Text style={[styles.th, styles.colLoad]}>{bodyweight ? 'LOAD' : 'KG'}</Text>
        <Text style={[styles.th, styles.colValue]}>{timed ? 'TIME' : 'REPS'}</Text>
        <View style={styles.colTick}>
          <Ionicons name="checkmark" size={14} color={colors.textMuted} />
        </View>
      </View>

      {block.rows.map((row, index) => (
        <SetRow
          key={row.key}
          row={row}
          index={index}
          label={labels[index]}
          exercise={exercise}
          bandsById={props.bandsById}
          hits={row.kind === 'saved' ? (props.records[row.set.id] ?? []) : []}
          previous={props.previousFor(index)}
          ghost={props.ghostFor(index)}
          onTick={props.onTick}
          onUntick={props.onUntick}
          onSetMenu={props.onSetMenu}
          onLoad={props.onLoad}
          onChangeDraft={props.onChangeDraft}
          onDelete={props.onDelete}
        />
      ))}

      <Pressable
        onPress={props.onAddSet}
        accessibilityRole="button"
        accessibilityLabel={`Add a set of ${name}`}
        style={({ pressed }) => [styles.addSet, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={styles.addSetLabel}>Add set</Text>
      </Pressable>
    </GlassCard>
  );
}

function SetRow({
  row,
  index,
  label,
  exercise,
  bandsById,
  hits,
  previous,
  ghost,
  onTick,
  onUntick,
  onSetMenu,
  onLoad,
  onChangeDraft,
  onDelete,
}: {
  row: Row;
  index: number;
  label: string;
  exercise: Exercise | undefined;
  bandsById: Record<string, Band>;
  hits: RecordHit[];
  previous: SetFact | null;
  ghost: Ghost;
  onTick: (key: string) => void;
  onUntick: (key: string) => void;
  onSetMenu: (key: string) => void;
  onLoad: (key: string) => void;
  onChangeDraft: (key: string, patch: Partial<Omit<DraftRow, 'key'>>) => void;
  onDelete: (key: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const timed = exercise?.tracking_type === 'time';
  const bodyweight = exercise?.load_mode === 'bodyweight';
  const shape = { load_mode: exercise?.load_mode ?? 'external' } as const;
  const type = typeOf(row);
  const saved = row.kind === 'saved';
  const record = primaryRecord(hits);

  const letterColor: Record<SetType, string> = {
    warmup: colors.warning,
    normal: saved ? colors.text : colors.textSecondary,
    failure: colors.danger,
    drop: colors.info,
  };

  const previousText = previous
    ? formatSetShort({ ...previous, band_id: null, side: null }, shape)
    : '—';

  // LOAD: a kg field for an external lift; a chip for bodyweight.
  let loadCell: React.ReactNode;
  if (bodyweight) {
    const source =
      row.kind === 'saved'
        ? row.set
        : {
            weight_kg: Number(row.draft.weight.replace(',', '.')) || 0,
            assist_kg: Number(row.draft.assist.replace(',', '.')) || null,
            band_id: row.draft.band_id,
          };
    const band = source.band_id ? bandsById[source.band_id] : undefined;
    const chip = formatLoadChip(source, shape, band?.label) ?? 'BW';
    loadCell = (
      <Pressable
        onPress={() => !saved && onLoad(row.key)}
        disabled={saved}
        accessibilityRole="button"
        accessibilityLabel={`Load ${chip === 'BW' ? 'bodyweight' : chip}${saved ? '' : '. Change'}`}
        style={[styles.colLoad, styles.loadChip]}
      >
        {band ? <View style={[styles.bandDot, { backgroundColor: band.color }]} /> : null}
        <Text style={[styles.cellText, saved && styles.savedText]} numberOfLines={1}>
          {chip}
        </Text>
      </Pressable>
    );
  } else if (row.kind === 'saved') {
    loadCell = (
      <Text style={[styles.colLoad, styles.cellText, styles.savedText]}>
        {fmt(row.set.weight_kg) || '0'}
      </Text>
    );
  } else {
    loadCell = (
      <TextInput
        value={row.draft.weight}
        onChangeText={(weight) => onChangeDraft(row.key, { weight })}
        placeholder={fmt(ghost.weight)}
        placeholderTextColor={colors.textFaint}
        keyboardType="decimal-pad"
        selectTextOnFocus
        editable={row.kind === 'draft'}
        style={[styles.colLoad, styles.input]}
        accessibilityLabel={`Set ${label} weight in kilograms`}
      />
    );
  }

  let valueCell: React.ReactNode;
  if (row.kind === 'saved') {
    const value = timed
      ? formatHoldShort(row.set.duration_seconds ?? 0)
      : String(row.set.reps ?? 0);
    valueCell = <Text style={[styles.colValue, styles.cellText, styles.savedText]}>{value}</Text>;
  } else {
    valueCell = (
      <TextInput
        value={timed ? row.draft.seconds : row.draft.reps}
        onChangeText={(text) => onChangeDraft(row.key, timed ? { seconds: text } : { reps: text })}
        placeholder={timed ? fmt(ghost.seconds) : fmt(ghost.reps)}
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        selectTextOnFocus
        editable={row.kind === 'draft'}
        style={[styles.colValue, styles.input]}
        accessibilityLabel={`Set ${label} ${timed ? 'seconds' : 'reps'}`}
      />
    );
  }

  return (
    <ReanimatedSwipeable
      enabled={row.kind !== 'pending'}
      friction={2}
      rightThreshold={72}
      overshootRight={false}
      onSwipeableOpen={() => onDelete(row.key)}
      renderRightActions={() => (
        <View style={styles.deleteAction}>
          <Ionicons name="trash-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.deleteLabel}>Delete</Text>
        </View>
      )}
    >
      <View style={[styles.row, index % 2 === 1 && styles.zebra, saved && styles.savedRow]}>
        <Pressable
          onPress={() => onSetMenu(row.key)}
          accessibilityRole="button"
          accessibilityLabel={`Set ${label}${record ? `, record: ${record.label}` : ''}. Change type or remove`}
          style={styles.colSet}
        >
          {record ? (
            <View style={styles.medal}>
              <Ionicons name="trophy" size={13} color={colors.warning} />
              <Text style={[styles.setLabel, { color: letterColor[type] }]}>{label}</Text>
            </View>
          ) : (
            <Text style={[styles.setLabel, { color: letterColor[type] }]}>{label}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            if (!previous || row.kind !== 'draft') return;
            onChangeDraft(row.key, {
              weight: fmt(previous.weight_kg),
              assist: fmt(previous.assist_kg),
              ...(timed
                ? { seconds: previous.duration_seconds ? String(previous.duration_seconds) : '' }
                : { reps: previous.reps !== null ? String(previous.reps) : '' }),
            });
          }}
          disabled={!previous || row.kind !== 'draft'}
          accessibilityRole="button"
          accessibilityLabel={previous ? `Last time ${previousText}. Copy` : 'No previous set'}
          style={styles.colPrev}
        >
          <Text style={[styles.prevText, saved && styles.prevSaved]} numberOfLines={1}>
            {previousText}
          </Text>
        </Pressable>

        {loadCell}
        {valueCell}

        <Pressable
          onPress={() => (row.kind === 'saved' ? onUntick(row.key) : onTick(row.key))}
          disabled={row.kind === 'pending'}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: saved, busy: row.kind === 'pending' }}
          accessibilityLabel={saved ? `Set ${label} done. Untick` : `Complete set ${label}`}
          style={styles.colTick}
        >
          {row.kind === 'pending' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View style={[styles.tickBox, saved && styles.tickBoxDone]}>
              <Ionicons
                name="checkmark"
                size={18}
                color={saved ? colors.onPrimary : colors.textMuted}
              />
            </View>
          )}
        </Pressable>
      </View>
    </ReanimatedSwipeable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: { marginTop: spacing.md, paddingVertical: spacing.md },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  titleHit: { flex: 1, minHeight: 48, justifyContent: 'center' },
  title: { ...typography.h2, color: colors.primary },
  restChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  restLabel: { ...typography.caption, ...typography.numeric, color: colors.textSecondary },
  menu: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  pressed: { backgroundColor: colors.glass },
  pinned: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  pinnedText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  note: {
    ...typography.caption,
    color: colors.text,
    minHeight: 40,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  th: { ...typography.overline, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.backgroundElevated,
  },
  zebra: { backgroundColor: colors.glass },
  // Text on this tint must be text or textSecondary (see theme `completed`).
  savedRow: { backgroundColor: colors.completed },
  colSet: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  colPrev: { flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xs },
  colLoad: { width: 72, textAlign: 'center' },
  colValue: { width: 60, textAlign: 'center' },
  colTick: { width: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  setLabel: { ...typography.title, ...typography.numeric },
  medal: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  prevText: { ...typography.caption, ...typography.numeric, textAlign: 'center' },
  prevSaved: { color: colors.textSecondary },
  cellText: {
    ...typography.title,
    ...typography.numeric,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  savedText: { color: colors.text },
  input: {
    ...typography.title,
    ...typography.numeric,
    minHeight: 40,
    marginHorizontal: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    color: colors.text,
    paddingVertical: 0,
  },
  loadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 40,
    marginHorizontal: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
  },
  bandDot: { width: 10, height: 10, borderRadius: radius.pill },
  tickBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickBoxDone: { backgroundColor: colors.success, borderColor: colors.success },
  deleteAction: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    gap: 2,
  },
  // onPrimary is the dark-on-light / light-on-dark pair that reads on the
  // danger fill in both themes.
  deleteLabel: { ...typography.caption, color: colors.onPrimary },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 48,
    marginTop: spacing.xs,
    marginHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  addSetLabel: { ...typography.title, color: colors.primary },
}));

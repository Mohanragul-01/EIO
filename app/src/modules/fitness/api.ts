/**
 * api.ts - every database call the Fitness module makes.
 *
 * Larger than the other modules because Fitness spans seven tables. Same
 * conventions throughout: check `error`, throw on failure, stamp the owner id
 * here so no screen ever deals with identity.
 */
import { getOwnerId } from '../../core/session';
import { supabase } from '../../core/supabase';
import { toSetFact, type SetFact } from './load';
import {
  DEFAULT_EXERCISES,
  type Band,
  type BodyMetric,
  type Exercise,
  type FitnessMode,
  type Profile,
  type Progression,
  type ProgressionMove,
  type ProgressionStep,
  type Routine,
  type RoutineExercise,
  type SessionExercise,
  type SessionSet,
  type SetInput,
  type WorkoutSession,
  type TrackingType,
} from './types';

/** The exercise fields a form can write. Everything but identity and timestamps. */
export type ExerciseFields = Partial<
  Pick<
    Exercise,
    | 'tracking_type'
    | 'discipline'
    | 'load_mode'
    | 'bodyweight_factor'
    | 'equipment'
    | 'is_unilateral'
    | 'default_rest_seconds'
    | 'pinned_note'
    | 'instructions'
  >
>;

// PROFILE ---------------------------------------------------------------------

/**
 * The profile row, created on first read if it does not exist.
 *
 * Upsert rather than "select, and insert if missing": that pair races with
 * itself if two screens load at once, and the second insert would fail on the
 * primary key. `ignoreDuplicates` makes a concurrent call harmless.
 */
export async function getProfile(): Promise<Profile> {
  const ownerId = await getOwnerId();

  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({ user_id: ownerId }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (upsertError) throw new Error(upsertError.message);

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', ownerId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function setHeight(heightCm: number | null): Promise<void> {
  const ownerId = await getOwnerId();
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: ownerId, height_cm: heightCm }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

// BODY METRICS ----------------------------------------------------------------

export async function listBodyMetrics(limit = 90): Promise<BodyMetric[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', ownerId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Record a weight for a day, replacing any existing entry for that day.
 *
 * Upsert on (user_id, date), matching the unique constraint. Weighing yourself
 * twice in a morning is normal; keeping both would make the trend jitter on
 * nothing, so the second reading corrects the first.
 */
export async function recordWeight(date: string, weightKg: number): Promise<void> {
  const ownerId = await getOwnerId();
  const { error } = await supabase
    .from('body_metrics')
    .upsert({ user_id: ownerId, date, weight_kg: weightKg }, { onConflict: 'user_id,date' });
  if (error) throw new Error(error.message);
}

export async function deleteBodyMetric(id: string): Promise<void> {
  const { error } = await supabase.from('body_metrics').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// EXERCISES -------------------------------------------------------------------

export async function listExercises(): Promise<Exercise[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', ownerId)
    .order('muscle_group', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Seed the starter exercises, but only into a genuinely empty library.
 *
 * Guarded on emptiness rather than run once and remembered, because "have I
 * seeded already" would need storing somewhere, and that flag going out of step
 * with the actual rows is exactly how duplicates appear. If you delete every
 * exercise on purpose, the defaults come back - a reasonable trade for never
 * silently duplicating them.
 */
export async function seedDefaultExercisesIfEmpty(): Promise<Exercise[]> {
  const existing = await listExercises();
  if (existing.length > 0) return existing;

  const ownerId = await getOwnerId();
  const { error } = await supabase
    .from('exercises')
    .insert(DEFAULT_EXERCISES.map((e) => ({ ...e, user_id: ownerId })));

  // A duplicate-name conflict means another device seeded first. Not an error.
  if (error && !error.message.includes('duplicate')) throw new Error(error.message);

  return listExercises();
}

export async function createExercise(
  input: {
    name: string;
    muscle_group: string | null;
    tracking_type?: TrackingType;
  } & ExerciseFields,
): Promise<Exercise> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('exercises')
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateExercise(
  id: string,
  input: {
    name?: string;
    muscle_group?: string | null;
    tracking_type?: TrackingType;
  } & ExerciseFields,
): Promise<void> {
  const { error } = await supabase.from('exercises').update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteExercise(id: string): Promise<void> {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) {
    // session_sets references this with ON DELETE RESTRICT, so Postgres refuses
    // when history exists. Translated here because the raw constraint message
    // means nothing to anyone reading it on a phone.
    if (error.message.includes('violates foreign key')) {
      throw new Error('This exercise has logged sets, so it cannot be deleted.');
    }
    throw new Error(error.message);
  }
}

// ROUTINES --------------------------------------------------------------------

export async function listRoutines(): Promise<Routine[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .eq('user_id', ownerId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listRoutineExercises(routineId: string): Promise<RoutineExercise[]> {
  const { data, error } = await supabase
    .from('routine_exercises')
    .select('*')
    .eq('routine_id', routineId)
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Save a routine and its exercise list.
 *
 * The exercise list is replaced wholesale rather than diffed. A routine holds a
 * handful of rows with no identity worth preserving - position IS the identity -
 * so a delete-then-insert is simpler than working out which moved, and cannot
 * leave a stale row behind.
 */
export type RoutineSlotInput = {
  exercise_id?: string | null;
  progression_id?: string | null;
  target_sets: number | null;
  target_reps: number | null;
  target_reps_min?: number | null;
  target_seconds_min?: number | null;
  target_seconds_max?: number | null;
  rest_seconds?: number | null;
  increment_kg?: number | null;
  pair_group?: string | null;
};

export async function saveRoutine(
  /** `mode` is set when the routine is created and never changed by a save. */
  input: { id?: string; name: string; mode?: FitnessMode },
  /**
   * The slots, in order. Each is an exercise OR a ladder; the range, rest,
   * increment and superset letter are optional, so a plain list of exercises
   * with sets and reps (what the website sends) is still a valid routine.
   */
  exercises: RoutineSlotInput[],
): Promise<Routine> {
  const ownerId = await getOwnerId();

  let routine: Routine;
  /** Rows to remove once the replacements are safely in. */
  let supersededIds: string[] = [];

  if (input.id) {
    const { data, error } = await supabase
      .from('routines')
      .update({ name: input.name })
      .eq('id', input.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    routine = data;

    // Note the old rows now, but do not delete them yet. These are separate
    // writes with no transaction around them, so the network can drop partway,
    // and clearing first meant a failure landed on the one ordering that loses
    // the routine: the old exercises were already gone and the new ones never
    // arrived, leaving an empty template. Writing first and deleting after
    // means the same failure leaves DUPLICATES instead - obvious on the next
    // open, and fixed by saving again. A doubled list you can see beats an
    // empty one you have to rebuild from memory.
    const { data: current, error: readError } = await supabase
      .from('routine_exercises')
      .select('id')
      .eq('routine_id', input.id);
    if (readError) throw new Error(readError.message);
    supersededIds = (current ?? []).map((row: { id: string }) => row.id);
  } else {
    const { data, error } = await supabase
      .from('routines')
      .insert({ name: input.name, user_id: ownerId, mode: input.mode ?? 'gym' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    routine = data;
  }

  if (exercises.length > 0) {
    const { error } = await supabase.from('routine_exercises').insert(
      exercises.map((exercise, index) => ({
        ...exercise,
        routine_id: routine.id,
        user_id: ownerId,
        position: index,
      })),
    );
    if (error) throw new Error(error.message);
  }

  // By id, not by routine_id: deleting by routine_id here would take the rows
  // that were just inserted along with the old ones.
  if (supersededIds.length > 0) {
    const { error } = await supabase.from('routine_exercises').delete().in('id', supersededIds);
    if (error) throw new Error(error.message);
  }

  return routine;
}

export async function deleteRoutine(id: string): Promise<void> {
  // routine_exercises cascades; workout_sessions.routine_id is SET NULL, so the
  // training you did from this routine survives it.
  const { error } = await supabase.from('routines').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// SESSIONS --------------------------------------------------------------------

export async function listSessions(limit = 60): Promise<WorkoutSession[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', ownerId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSession(input: {
  date: string;
  routine_id: string | null;
  notes: string;
}): Promise<WorkoutSession> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateSession(
  id: string,
  input: Partial<{ date: string; notes: string }>,
): Promise<void> {
  const { error } = await supabase.from('workout_sessions').update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSession(id: string): Promise<void> {
  // session_sets cascades: deleting a session deletes the sets in it.
  const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listSessionSets(sessionId: string): Promise<SessionSet[]> {
  const { data, error } = await supabase
    .from('session_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('set_number', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addSet(sessionId: string, input: SetInput): Promise<SessionSet> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('session_sets')
    .insert({ ...input, session_id: sessionId, user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSet(id: string): Promise<void> {
  const { error } = await supabase.from('session_sets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Past sets for one exercise, for PR detection and the progression chart.
 *
 * Excludes the session being logged, so a set cannot be compared against
 * itself: without that, saving a set would immediately see it in the history
 * and never count as a record.
 *
 * Only the four columns the maths needs. This runs on every set logged, so it
 * has no business fetching anything else.
 */
export async function listExerciseHistory(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<
  Pick<SessionSet, 'exercise_id' | 'reps' | 'weight_kg' | 'duration_seconds' | 'session_id'>[]
> {
  const ownerId = await getOwnerId();

  let query = supabase
    .from('session_sets')
    .select('exercise_id, reps, weight_kg, duration_seconds, session_id')
    .eq('user_id', ownerId)
    .eq('exercise_id', exerciseId);

  if (excludeSessionId) query = query.neq('session_id', excludeSessionId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Every set for one exercise with the date of the session it belongs to, for
 * the progression chart.
 *
 * A join through the foreign key rather than two queries and a manual stitch:
 * PostgREST can follow the relationship, and doing it in one request keeps the
 * chart from flickering as two responses land at different times.
 */
export async function listExerciseProgress(
  exerciseId: string,
): Promise<{ date: string; weight_kg: number; reps: number }[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from('session_sets')
    .select('weight_kg, reps, workout_sessions!inner(date)')
    .eq('user_id', ownerId)
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  type Row = {
    weight_kg: number;
    reps: number;
    workout_sessions: { date: string } | { date: string }[] | null;
  };

  return (
    ((data ?? []) as Row[])
      .map((row) => ({
        // PostgREST returns an embedded row as an object for a to-one join, but
        // the generated types can widen it to an array. Normalised here so the
        // chart never has to care which shape arrived.
        date: Array.isArray(row.workout_sessions)
          ? row.workout_sessions[0]?.date
          : row.workout_sessions?.date,
        weight_kg: row.weight_kg,
        reps: row.reps,
      }))
      // Dropped here rather than by the caller. `data` comes back as `any`, so
      // nothing was type-checking the promise that every row has a date, and the
      // declared return type was simply untrue for a row whose join came back
      // empty. Filtering makes the signature honest at its source.
      .filter((row): row is { date: string; weight_kg: number; reps: number } => !!row.date)
  );
}

/** Sets across recent sessions, for the home summary. */
export async function listRecentSets(sessionIds: string[]): Promise<SessionSet[]> {
  if (sessionIds.length === 0) return [];

  const { data, error } = await supabase
    .from('session_sets')
    .select('*')
    .in('session_id', sessionIds);

  if (error) throw new Error(error.message);
  return data ?? [];
}

// SESSIONS v3 --------------------------------------------------------------------

export async function getSession(id: string): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * The weigh-in in force on a day: the latest on or before it. A session keeps
 * a copy (bodyweight_kg) so editing an old weigh-in later does not rewrite the
 * volume of sessions already done.
 */
export async function bodyweightOn(date: string): Promise<number | null> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('body_metrics')
    .select('weight_kg')
    .eq('user_id', ownerId)
    .lte('date', date)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? Number(data.weight_kg) : null;
}

/**
 * The exercise each ladder's current rung points at, for resolving routine
 * slots that follow a ladder. A ladder with no current rung resolves to
 * nothing and its slot is skipped.
 */
export async function currentRungExercises(
  progressionIds: string[],
): Promise<Record<string, string>> {
  if (progressionIds.length === 0) return {};
  const { data, error } = await supabase
    .from('progressions')
    .select(
      'id, current_step_id, progression_steps!progression_steps_progression_id_fkey(id, exercise_id)',
    )
    .in('id', progressionIds);
  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    current_step_id: string | null;
    progression_steps: { id: string; exercise_id: string }[] | null;
  };
  const out: Record<string, string> = {};
  for (const row of (data ?? []) as Row[]) {
    const step = (row.progression_steps ?? []).find((s) => s.id === row.current_step_id);
    if (step) out[row.id] = step.exercise_id;
  }
  return out;
}

/**
 * Start a session: the row, a bodyweight snapshot, and - for a routine - its
 * blocks, so the session opens with every planned exercise in order before
 * anything is logged. A ladder slot becomes the ladder's current rung.
 */
export async function startSession(input: {
  date: string;
  mode: FitnessMode;
  routine_id: string | null;
}): Promise<WorkoutSession> {
  const ownerId = await getOwnerId();
  const bodyweight = await bodyweightOn(input.date);

  const { data: session, error } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: ownerId,
      date: input.date,
      mode: input.mode,
      routine_id: input.routine_id,
      notes: '',
      started_at: new Date().toISOString(),
      bodyweight_kg: bodyweight,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (input.routine_id) {
    const slots = await listRoutineExercises(input.routine_id);
    const ladders = await currentRungExercises(
      slots.flatMap((slot) => (slot.progression_id ? [slot.progression_id] : [])),
    );
    const rows: Omit<SessionExercise, 'id' | 'created_at'>[] = [];
    const seen = new Set<string>();
    for (const slot of slots) {
      const exerciseId =
        slot.exercise_id ?? (slot.progression_id ? ladders[slot.progression_id] : undefined);
      // One block per exercise: a ladder whose rung is also listed on its own
      // shares that block rather than failing the insert.
      if (!exerciseId || seen.has(exerciseId)) continue;
      seen.add(exerciseId);
      rows.push({
        session_id: session.id,
        exercise_id: exerciseId,
        user_id: ownerId,
        position: rows.length,
        rest_seconds: slot.rest_seconds,
        note: '',
        superset_group: slot.pair_group,
      });
    }
    if (rows.length > 0) {
      const { error: blockError } = await supabase.from('session_exercises').insert(rows);
      if (blockError) throw new Error(blockError.message);
    }
  }

  return session;
}

/** Finish is optional and never gates saving: it only stamps the end. */
export async function finishSession(id: string): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function reopenSession(id: string): Promise<void> {
  const { error } = await supabase.from('workout_sessions').update({ ended_at: null }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listSessionExercises(sessionId: string): Promise<SessionExercise[]> {
  const { data, error } = await supabase
    .from('session_exercises')
    .select('*')
    .eq('session_id', sessionId)
    .order('position', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Add an exercise to a session. Upsert on (session, exercise): adding one that
 * is already there returns the existing block instead of failing.
 */
export async function addSessionExercise(input: {
  session_id: string;
  exercise_id: string;
  position: number;
  rest_seconds?: number | null;
}): Promise<SessionExercise> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('session_exercises')
    .upsert(
      { ...input, user_id: ownerId },
      { onConflict: 'session_id,exercise_id', ignoreDuplicates: false },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSessionExercise(
  id: string,
  patch: Partial<
    Pick<SessionExercise, 'position' | 'rest_seconds' | 'note' | 'superset_group' | 'exercise_id'>
  >,
): Promise<void> {
  const { error } = await supabase.from('session_exercises').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Write a new order. Each row's position is its index in `ids`. */
export async function reorderSessionExercises(ids: string[]): Promise<void> {
  const results = await Promise.all(
    ids.map((id, position) => supabase.from('session_exercises').update({ position }).eq('id', id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

/**
 * Remove an exercise from a session, with the sets logged for it. The screen
 * confirms first when there are sets, because those are gone for good.
 */
export async function removeSessionExercise(input: {
  sessionId: string;
  exerciseId: string;
  blockId: string | null;
}): Promise<void> {
  const { error: setsError } = await supabase
    .from('session_sets')
    .delete()
    .eq('session_id', input.sessionId)
    .eq('exercise_id', input.exerciseId);
  if (setsError) throw new Error(setsError.message);

  if (input.blockId) {
    const { error } = await supabase.from('session_exercises').delete().eq('id', input.blockId);
    if (error) throw new Error(error.message);
  }
}

export async function updateSet(
  id: string,
  patch: Partial<
    Pick<
      SessionSet,
      | 'reps'
      | 'duration_seconds'
      | 'weight_kg'
      | 'rpe'
      | 'set_type'
      | 'assist_kg'
      | 'band_id'
      | 'side'
      | 'clean'
    >
  >,
): Promise<SessionSet> {
  const { data, error } = await supabase
    .from('session_sets')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** The columns the training maths reads, and nothing else. */
const FACT_COLUMNS =
  'id, exercise_id, session_id, set_type, reps, duration_seconds, weight_kg, assist_kg, clean, created_at';

/**
 * Each exercise's sets from OTHER sessions, for record checks. Fetched once
 * when a session opens rather than per tick, so ticking a set is one write.
 */
export async function listBaseline(
  exerciseIds: string[],
  excludeSessionId: string,
): Promise<Record<string, SetFact[]>> {
  if (exerciseIds.length === 0) return {};
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('session_sets')
    .select(FACT_COLUMNS)
    .eq('user_id', ownerId)
    .in('exercise_id', exerciseIds)
    .neq('session_id', excludeSessionId);
  if (error) throw new Error(error.message);

  const out: Record<string, SetFact[]> = {};
  for (const row of data ?? []) {
    const fact = toSetFact(row as Parameters<typeof toSetFact>[0]);
    (out[fact.exercise_id] ??= []).push(fact);
  }
  return out;
}

/**
 * For each exercise, the sets of the most recent OTHER session that had it,
 * on or before `onOrBefore` - "last time", for the PREVIOUS column and ghost
 * values. Logging a past day compares with the session before that day.
 */
export async function listPreviousSets(
  exerciseIds: string[],
  excludeSessionId: string,
  onOrBefore: string,
): Promise<Record<string, { date: string; sets: SetFact[] }>> {
  if (exerciseIds.length === 0) return {};
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('session_sets')
    .select(`${FACT_COLUMNS}, set_number, workout_sessions!inner(date, created_at)`)
    .eq('user_id', ownerId)
    .in('exercise_id', exerciseIds)
    .neq('session_id', excludeSessionId)
    .lte('workout_sessions.date', onOrBefore)
    // Enough history to find each exercise's last session; a person logs
    // far fewer sets than this between sessions of one exercise.
    .order('created_at', { ascending: false })
    .limit(600);
  if (error) throw new Error(error.message);

  type Row = Parameters<typeof toSetFact>[0] & {
    set_number: number;
    workout_sessions: { date: string; created_at: string } | { date: string; created_at: string }[];
  };
  const rows = ((data ?? []) as Row[]).map((row) => {
    const session = Array.isArray(row.workout_sessions)
      ? row.workout_sessions[0]
      : row.workout_sessions;
    return { row, date: session?.date ?? '', sessionCreated: session?.created_at ?? '' };
  });
  // Newest session first: by date, then by when the session was created.
  rows.sort(
    (a, b) => b.date.localeCompare(a.date) || b.sessionCreated.localeCompare(a.sessionCreated),
  );

  const out: Record<string, { date: string; sets: SetFact[] }> = {};
  const lastSession: Record<string, string> = {};
  for (const { row, date } of rows) {
    const exerciseId = row.exercise_id;
    lastSession[exerciseId] ??= row.session_id;
    if (lastSession[exerciseId] !== row.session_id) continue;
    (out[exerciseId] ??= { date, sets: [] }).sets.push({
      ...toSetFact(row),
      created_at: row.created_at,
    });
  }
  for (const entry of Object.values(out)) {
    entry.sets.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return out;
}

// BANDS ---------------------------------------------------------------------------

export async function listBands(): Promise<Band[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('bands')
    .select('*')
    .eq('user_id', ownerId)
    .order('position', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveBand(input: {
  id?: string;
  label: string;
  color: string;
  approx_kg: number | null;
  position: number;
}): Promise<Band> {
  const ownerId = await getOwnerId();
  const { data, error } = input.id
    ? await supabase
        .from('bands')
        .update({
          label: input.label,
          color: input.color,
          approx_kg: input.approx_kg,
          position: input.position,
        })
        .eq('id', input.id)
        .select()
        .single()
    : await supabase
        .from('bands')
        .insert({ ...input, user_id: ownerId })
        .select()
        .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Sets that used the band keep their assistance; only the band link is cleared. */
export async function deleteBand(id: string): Promise<void> {
  const { error } = await supabase.from('bands').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// SUMMARY -------------------------------------------------------------------------

/** "Workout #N": this session's place among all of yours, oldest first. */
export async function sessionOrdinal(sessionId: string): Promise<number | null> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, date, created_at')
    .eq('user_id', ownerId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const index = (data ?? []).findIndex((row: { id: string }) => row.id === sessionId);
  return index < 0 ? null : index + 1;
}

/**
 * The sets of the last OTHER session of the same routine on or before `date`,
 * for "vs last time you did this routine". Null when there is none.
 */
export async function lastRoutineSessionSets(input: {
  routineId: string;
  excludeSessionId: string;
  date: string;
}): Promise<SetFact[] | null> {
  const ownerId = await getOwnerId();
  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', ownerId)
    .eq('routine_id', input.routineId)
    .neq('id', input.excludeSessionId)
    .lte('date', input.date)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = sessions?.[0] as { id: string } | undefined;
  if (!last) return null;

  const { data, error: setsError } = await supabase
    .from('session_sets')
    .select(FACT_COLUMNS)
    .eq('session_id', last.id)
    .order('created_at', { ascending: true });
  if (setsError) throw new Error(setsError.message);
  return (data ?? []).map((row) => toSetFact(row as Parameters<typeof toSetFact>[0]));
}

/**
 * Bring a routine in line with a session: new target set counts for the
 * exercises that changed, and new slots (at the end) for exercises added.
 * Done slot by slot rather than by rewriting the routine, so slots this
 * screen knows nothing about (ladders, ranges, rest) are left exactly as
 * they were. Skipped exercises stay in the routine: skipping one today is
 * not deciding to drop it.
 */
export async function updateRoutineFromSession(
  routineId: string,
  changes: {
    setCounts: { exercise_id: string; target_sets: number }[];
    added: { exercise_id: string; target_sets: number }[];
  },
): Promise<void> {
  const ownerId = await getOwnerId();
  for (const change of changes.setCounts) {
    const { error } = await supabase
      .from('routine_exercises')
      .update({ target_sets: change.target_sets })
      .eq('routine_id', routineId)
      .eq('exercise_id', change.exercise_id);
    if (error) throw new Error(error.message);
  }
  if (changes.added.length > 0) {
    const existing = await listRoutineExercises(routineId);
    const start = existing.reduce((top, slot) => Math.max(top, slot.position), -1) + 1;
    const { error } = await supabase.from('routine_exercises').insert(
      changes.added.map((slot, i) => ({
        routine_id: routineId,
        user_id: ownerId,
        exercise_id: slot.exercise_id,
        target_sets: slot.target_sets,
        position: start + i,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

// LADDERS -------------------------------------------------------------------------

export type Ladder = {
  progression: Progression;
  steps: ProgressionStep[];
  moves: ProgressionMove[];
};

/** Every ladder with its rungs and moves, for the Skills tab. */
export async function listLadders(): Promise<Ladder[]> {
  const ownerId = await getOwnerId();
  const [progressions, steps, moves] = await Promise.all([
    supabase
      .from('progressions')
      .select('*')
      .eq('user_id', ownerId)
      .order('family', { ascending: true })
      .order('position', { ascending: true }),
    supabase
      .from('progression_steps')
      .select('*')
      .eq('user_id', ownerId)
      .order('position', { ascending: true }),
    supabase
      .from('progression_moves')
      .select('*')
      .eq('user_id', ownerId)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);
  for (const result of [progressions, steps, moves]) {
    if (result.error) throw new Error(result.error.message);
  }
  return ((progressions.data ?? []) as Progression[]).map((progression) => ({
    progression,
    steps: ((steps.data ?? []) as ProgressionStep[]).filter(
      (s) => s.progression_id === progression.id,
    ),
    moves: ((moves.data ?? []) as ProgressionMove[]).filter(
      (m) => m.progression_id === progression.id,
    ),
  }));
}

export async function getLadder(id: string): Promise<Ladder | null> {
  const all = await listLadders();
  return all.find((l) => l.progression.id === id) ?? null;
}

export type RungInput = {
  id?: string;
  exercise_id: string;
  goal_sets: number;
  goal_reps: number | null;
  goal_seconds: number | null;
  goal_added_kg: number | null;
  start_reps: number | null;
  start_seconds: number | null;
  cue: string;
};

/**
 * Save a ladder and its rungs. Rungs keep their ids where they have one, so
 * the moves and "mastered on" dates that point at them survive an edit; new
 * ones are added, and rungs taken out are deleted (with their moves). A new
 * ladder starts on its first rung.
 */
export async function saveLadder(
  input: {
    id?: string;
    name: string;
    family: Progression['family'];
    level_up_rule: Progression['level_up_rule'];
    notes: string;
  },
  rungs: RungInput[],
): Promise<string> {
  const ownerId = await getOwnerId();
  let progressionId = input.id;

  if (progressionId) {
    const { error } = await supabase
      .from('progressions')
      .update({
        name: input.name,
        family: input.family,
        level_up_rule: input.level_up_rule,
        notes: input.notes,
      })
      .eq('id', progressionId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('progressions')
      .insert({
        name: input.name,
        family: input.family,
        level_up_rule: input.level_up_rule,
        notes: input.notes,
        user_id: ownerId,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    progressionId = (data as { id: string }).id;
  }

  const { data: existing, error: readError } = await supabase
    .from('progression_steps')
    .select('id')
    .eq('progression_id', progressionId);
  if (readError) throw new Error(readError.message);
  const keep = new Set(rungs.flatMap((r) => (r.id ? [r.id] : [])));

  const savedIds: string[] = [];
  for (const [position, rung] of rungs.entries()) {
    const { id, ...fields } = rung;
    if (id) {
      const { error } = await supabase
        .from('progression_steps')
        .update({ ...fields, position })
        .eq('id', id);
      if (error) throw new Error(error.message);
      savedIds.push(id);
    } else {
      const { data, error } = await supabase
        .from('progression_steps')
        .insert({ ...fields, position, progression_id: progressionId, user_id: ownerId })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      savedIds.push((data as { id: string }).id);
    }
  }

  const removed = (existing ?? [])
    .map((r: { id: string }) => r.id)
    .filter((id: string) => !keep.has(id));
  if (removed.length > 0) {
    const { error } = await supabase.from('progression_steps').delete().in('id', removed);
    if (error) throw new Error(error.message);
  }

  // A ladder with no current rung (new, or its current rung was removed)
  // starts on the first one.
  const { data: progression, error: currentError } = await supabase
    .from('progressions')
    .select('current_step_id')
    .eq('id', progressionId)
    .single();
  if (currentError) throw new Error(currentError.message);
  if (!(progression as { current_step_id: string | null }).current_step_id && savedIds[0]) {
    await moveLadder({ progressionId, fromStepId: null, toStepId: savedIds[0], kind: 'start' });
  }
  return progressionId;
}

/** Record a move on a ladder and make its target the current rung. */
export async function moveLadder(input: {
  progressionId: string;
  fromStepId: string | null;
  toStepId: string;
  kind: ProgressionMove['kind'];
  sessionId?: string | null;
  date?: string;
}): Promise<void> {
  const ownerId = await getOwnerId();
  const { error } = await supabase.from('progression_moves').insert({
    progression_id: input.progressionId,
    user_id: ownerId,
    from_step_id: input.fromStepId,
    to_step_id: input.toStepId,
    kind: input.kind,
    session_id: input.sessionId ?? null,
    ...(input.date ? { date: input.date } : {}),
  });
  if (error) throw new Error(error.message);
  const { error: updateError } = await supabase
    .from('progressions')
    .update({ current_step_id: input.toStepId })
    .eq('id', input.progressionId);
  if (updateError) throw new Error(updateError.message);
}

/** Take back the most recent move (for Undo): delete it and restore the rung it left. */
export async function undoLadderMove(
  progressionId: string,
  previousStepId: string | null,
): Promise<void> {
  const { data, error } = await supabase
    .from('progression_moves')
    .select('id')
    .eq('progression_id', progressionId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0] as { id: string } | undefined;
  if (last) {
    const { error: deleteError } = await supabase
      .from('progression_moves')
      .delete()
      .eq('id', last.id);
    if (deleteError) throw new Error(deleteError.message);
  }
  const { error: updateError } = await supabase
    .from('progressions')
    .update({ current_step_id: previousStepId })
    .eq('id', progressionId);
  if (updateError) throw new Error(updateError.message);
}

export async function setLadderPaused(id: string, paused: boolean): Promise<void> {
  const { error } = await supabase
    .from('progressions')
    .update({ paused_at: paused ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteLadder(id: string): Promise<void> {
  const { error } = await supabase.from('progressions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Recent sessions' sets for each exercise, newest session first: what a
 * ladder's progress ring and level-up check read.
 */
export async function recentSessionSets(
  exerciseIds: string[],
  sessionsPerExercise = 5,
): Promise<Record<string, SetFact[][]>> {
  if (exerciseIds.length === 0) return {};
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('session_sets')
    .select(FACT_COLUMNS + ', workout_sessions!inner(date, created_at)')
    .eq('user_id', ownerId)
    .in('exercise_id', exerciseIds)
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) throw new Error(error.message);

  type SessionRef = { date: string; created_at: string };
  type Row = Parameters<typeof toSetFact>[0] & { workout_sessions: SessionRef | SessionRef[] };
  type Group = { date: string; created: string; exerciseId: string; sets: SetFact[] };
  const bySession = new Map<string, Group>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const session = Array.isArray(row.workout_sessions)
      ? row.workout_sessions[0]
      : row.workout_sessions;
    const key = row.exercise_id + ':' + row.session_id;
    const entry: Group = bySession.get(key) ?? {
      date: session?.date ?? '',
      created: session?.created_at ?? '',
      exerciseId: row.exercise_id,
      sets: [],
    };
    entry.sets.push(toSetFact(row));
    bySession.set(key, entry);
  }

  const out: Record<string, SetFact[][]> = {};
  [...bySession.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created))
    .forEach((entry) => {
      const list = (out[entry.exerciseId] ??= []);
      if (list.length < sessionsPerExercise) list.push(entry.sets);
    });
  return out;
}

/** Sessions with a date in [start, end], for the month calendar. */
export async function listSessionsBetween(start: string, end: string): Promise<WorkoutSession[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', ownerId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

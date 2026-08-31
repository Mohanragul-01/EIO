/**
 * api.ts - every database call the Fitness module makes.
 *
 * Larger than the other modules because Fitness spans seven tables. Same
 * conventions throughout: check `error`, throw on failure, stamp the owner id
 * here so no screen ever deals with identity.
 */
import { getOwnerId } from '../../core/session';
import { supabase } from '../../core/supabase';
import {
  DEFAULT_EXERCISES,
  type BodyMetric,
  type Exercise,
  type Profile,
  type Routine,
  type RoutineExercise,
  type SessionSet,
  type SetInput,
  type WorkoutSession,
} from './types';

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

export async function createExercise(input: {
  name: string;
  muscle_group: string | null;
}): Promise<Exercise> {
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
  input: { name: string; muscle_group: string | null },
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
export async function saveRoutine(
  input: { id?: string; name: string },
  exercises: { exercise_id: string; target_sets: number | null; target_reps: number | null }[],
): Promise<Routine> {
  const ownerId = await getOwnerId();

  let routine: Routine;
  if (input.id) {
    const { data, error } = await supabase
      .from('routines')
      .update({ name: input.name })
      .eq('id', input.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    routine = data;

    const { error: clearError } = await supabase
      .from('routine_exercises')
      .delete()
      .eq('routine_id', input.id);
    if (clearError) throw new Error(clearError.message);
  } else {
    const { data, error } = await supabase
      .from('routines')
      .insert({ name: input.name, user_id: ownerId })
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
): Promise<Pick<SessionSet, 'exercise_id' | 'reps' | 'weight_kg' | 'session_id'>[]> {
  const ownerId = await getOwnerId();

  let query = supabase
    .from('session_sets')
    .select('exercise_id, reps, weight_kg, session_id')
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

  return ((data ?? []) as Row[])
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
    .filter((row): row is { date: string; weight_kg: number; reps: number } => !!row.date);
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

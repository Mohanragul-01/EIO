/**
 * api.ts - every database call the Fitness module makes.
 *
 * Same shape as every other module's api.ts. The only notable difference is
 * the `limit` on the list query.
 */
import { supabase } from '../../core/supabase';
import { getOwnerId } from '../../core/session';
import type { Workout, WorkoutInput } from './types';

const TABLE = 'workouts';

/**
 * Recent workouts, newest first.
 *
 * Capped at 200 rather than fetching everything. A workout log grows forever,
 * and nobody scrolls two years back on a phone - the summary numbers are what
 * matter beyond a few weeks. Unlike Finance, there's no month selector here
 * because a training log reads as one continuous stream, not as discrete
 * monthly buckets.
 *
 * If you ever DO want the full history, this is where pagination would go -
 * and only this file would change.
 */
export async function listWorkouts(): Promise<Workout[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .order('date', { ascending: false })
    // Tie-breaker so several sessions on one day keep a stable order.
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWorkout(id: string): Promise<Workout> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createWorkout(input: WorkoutInput): Promise<Workout> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateWorkout(id: string, input: Partial<WorkoutInput>): Promise<Workout> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

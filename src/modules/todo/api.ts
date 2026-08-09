/**
 * api.ts - every database call this module makes, in one file.
 *
 *  THE PATTERN (this is the part worth internalising)
 * Screens never talk to Supabase directly. They call functions from here.
 * Why that separation earns its keep:
 *   • One place to change if a column is renamed or a query is optimised.
 *   • Screens stay readable - `listTodos()` instead of ten lines of query
 *     builder inline in a component.
 *   • These functions are plain async functions, so they're trivial to test
 *     or reuse without rendering anything.
 *
 * Every later module gets its own api.ts shaped exactly like this one.
 *
 *  ERROR HANDLING
 * supabase-js does NOT throw on database errors. It resolves with
 * `{ data, error }` and it's on you to check. Silently ignoring `error` is the
 * single most common Supabase bug - you get an empty list and no clue why. So
 * every function here checks it and throws, letting the calling screen decide
 * how to present the failure.
 */
import { supabase } from '../../core/supabase';
import { getOwnerId } from '../../core/session';
import type { Todo, TodoInput } from './types';

const TABLE = 'todos';

/**
 * Fetch all todos for the current owner.
 *
 * Sort order is deliberate and done in SQL, not in JS: unfinished first, then
 * soonest due date, then newest. Sorting in the database means the phone
 * receives rows already in display order.
 */
export async function listTodos(): Promise<Todo[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .order('is_done', { ascending: true })
    // nullsFirst: false pushes tasks with NO due date to the bottom - an
    // undated task is less urgent than a dated one, not more.
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Fetch one todo by id - used by the edit screen. */
export async function getTodo(id: string): Promise<Todo> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    // .single() tells PostgREST to return an object rather than a 1-element
    // array, and to error if the row is missing. Without it you'd have to
    // unwrap data[0] and handle undefined yourself.
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createTodo(input: TodoInput): Promise<Todo> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    // The owner id is stamped HERE, not in the form. Screens shouldn't have
    // to know about identity at all.
    .insert({ ...input, user_id: ownerId })
    // .select().single() makes the insert return the row it just wrote,
    // including database-generated columns (id, created_at). One round trip
    // instead of insert-then-fetch.
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateTodo(id: string, input: Partial<TodoInput>): Promise<Todo> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/** Toggle done/not-done. Separate from updateTodo because the list uses it constantly. */
export async function setTodoDone(id: string, isDone: boolean): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ is_done: isDone }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

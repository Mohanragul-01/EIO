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
import { nextDueDate, type Frequency, type Todo, type TodoInput } from './types';

const TABLE = 'todos';

/**
 * Open tasks in one frequency tab.
 *
 * Filtered to `is_done = false` in SQL rather than in JS. Completed tasks are
 * never deleted, so over time they will outnumber open ones many times over;
 * fetching them all and hiding them on the phone would mean downloading a
 * growing pile of rows to render none of them.
 *
 * Sorted soonest-due first, with undated tasks last: an undated task is less
 * urgent than a dated one, not more.
 */
export async function listTodosByFrequency(frequency: Frequency): Promise<Todo[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .eq('frequency', frequency)
    .eq('is_done', false)
    // `position` first: it is the order you arranged by hand, and it should
    // beat anything the database would have chosen. Due date is the tie-break
    // for tasks you have never dragged, which is what the backfill in 0013 set
    // them to anyway - so an untouched list looks exactly as it did before.
    .order('position', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * COMPLETED tasks in one frequency, newest first.
 *
 * Separate from listTodosByFrequency, which filters to open tasks in SQL,
 * because completed tasks are never deleted and will outnumber open ones many
 * times over. Fetching them together would mean downloading a growing pile of
 * finished work every time you open the list.
 *
 * So this is opt-in and BOUNDED. The phone never calls it - it only shows open
 * tasks - but a desktop screen has room for a "Done" view, and that view only
 * needs the recent past to be useful.
 */
export async function listCompletedByFrequency(
  frequency: Frequency,
  limit = 100,
): Promise<Todo[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .eq('frequency', frequency)
    .eq('is_done', true)
    // By when it was completed, not when it was due: the useful order for
    // finished work is most-recently-done first.
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Renumber a frequency column to match the order given.
 *
 * One RPC rather than one update per task: a drag can move every row below the
 * drop point, and doing that as N requests would be N chances to fail partway
 * and leave the column half-ordered. `reorder_todos` does it in a single
 * statement, and runs as the caller so row level security still applies - ids
 * that are not yours simply match nothing.
 *
 * Send the WHOLE column in its new order, not just what moved. Positions are
 * plain integers, so the only way to be sure of the result is to state it.
 */
export async function reorderTodos(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;

  const { error } = await supabase.rpc('reorder_todos', { p_ids: orderedIds });
  if (error) throw new Error(error.message);
}

/**
 * Move a task to a different frequency.
 *
 * Separate from updateTodo because the board changes one column and nothing
 * else, and because a drag between columns must not touch the due date - a
 * weekly task dragged to Monthly is still due when it was due; only how often
 * it recurs has changed.
 */
export async function setFrequency(id: string, frequency: Frequency): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ frequency }).eq('id', id);
  if (error) throw new Error(error.message);
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

/**
 * Complete a task, and create its next occurrence if it repeats.
 *
 * Two deliberate choices here.
 *
 * SOFT COMPLETE. The row is marked done, never deleted. Completion is history:
 * deleting it would throw away the only record that the thing ever happened,
 * and for a repeating task it would erase the whole trail. The tab query
 * filters on `is_done = false`, so done rows leave the list without leaving the
 * database.
 *
 * ORDER OF WRITES. The completion is written first, then the next occurrence.
 * If the second write fails you are left with a completed task and no
 * successor, which is visible and fixable by adding one. The reverse order
 * would risk two open copies of the same repeating task, which is worse: you
 * would have to notice the duplicate to fix it.
 *
 * Returns the newly created occurrence, or null, so the caller can say what
 * happened without refetching.
 */
export async function completeTask(todo: Todo): Promise<Todo | null> {
  const { error } = await supabase.from(TABLE).update({ is_done: true }).eq('id', todo.id);
  if (error) throw new Error(error.message);

  if (!todo.is_repeat) return null;

  const ownerId = await getOwnerId();

  // Priority is deliberately NOT carried over. It describes how urgent this
  // particular instance was, and a task you marked urgent once should not be
  // urgent forever. Title and frequency are the identity of the recurrence.
  const { data, error: insertError } = await supabase
    .from(TABLE)
    .insert({
      user_id: ownerId,
      title: todo.title,
      frequency: todo.frequency,
      is_repeat: true,
      due_date: nextDueDate(todo.due_date, todo.frequency),
      priority: 'normal',
    })
    .select()
    .single();

  if (insertError) {
    // Put the task back to open before reporting the failure.
    //
    // These are two writes with no transaction between them, so the network
    // can drop after the first. Leaving it completed would end the recurrence
    // SILENTLY: the task looks done, and the next occurrence that never
    // arrives is not something you notice until you have already missed it.
    // Reopening turns that into a visible, retryable error instead - and if
    // this rollback fails too, the thrown message is the same one you would
    // have got anyway, so it is never worse than not trying.
    await supabase.from(TABLE).update({ is_done: false }).eq('id', todo.id);
    throw new Error(insertError.message);
  }

  return data;
}

/**
 * Un-complete a task. Separate from completeTask because reopening must never
 * spawn an occurrence: that path exists to undo a mistaken tap.
 */
export async function reopenTask(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ is_done: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Every open task, across all four tabs, for the home screen tile.
 *
 * Separate from listTodosByFrequency because the tile summarises the whole
 * module rather than one tab, and only needs the due dates to count overdue
 * ones. Selecting two columns instead of `*` keeps the payload small, since
 * this runs on every visit to the home screen.
 */
export async function listOpenTodos(): Promise<Pick<Todo, 'id' | 'due_date'>[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, due_date')
    .eq('user_id', ownerId)
    .eq('is_done', false);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

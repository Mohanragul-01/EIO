/**
 * api.ts - every database call this module makes, in one file.
 *
 *  THE PATTERN (this is the part worth internalising)
 * Screens never talk to Supabase directly. They call functions from here.
 * Why that separation earns its keep:
 *   • One place to change if a column is renamed or a query is optimised.
 *   • Screens stay readable - `listTodosByFrequency()` instead of ten lines of
 *     query builder inline in a component.
 *   • These functions are plain async functions, so they're trivial to test
 *     or reuse without rendering anything - see __tests__/api.test.ts, which
 *     runs them over an in-memory table.
 *
 *  ERROR HANDLING
 * supabase-js does NOT throw on database errors. It resolves with
 * `{ data, error }` and it's on you to check. Silently ignoring `error` is the
 * single most common Supabase bug - you get an empty list and no clue why. So
 * every function here checks it and throws, letting the calling screen decide
 * how to present the failure.
 *
 *  ORDER OF WRITES
 * There are no transactions across calls, so every function that writes
 * twice writes first and deletes last: an interruption leaves a stale row you
 * can see, never a missing one you cannot get back.
 */
import { supabase } from '../../core/supabase';
import { getOwnerId } from '../../core/session';
import { todayISO } from '../../core/date';
import { normalizeInput, resetChecklist } from './input';
import { localDayStartISO } from './today';
import {
  nextDueDate,
  ruleOf,
  seriesKey,
  type Frequency,
  type Outcome,
  type Todo,
  type TodoInput,
} from './types';

const TABLE = 'todos';

/** The columns a series history needs - small, since a daily routine has hundreds. */
const HISTORY_COLUMNS =
  'id, series_id, due_date, completed_at, updated_at, outcome, is_done, frequency, repeat_every, repeat_weekdays, repeat_anchor_day, repeat_nth, repeat_from';

/**
 * Open tasks in one frequency tab.
 *
 * Filtered to `is_done = false` in SQL rather than in JS. Completed tasks are
 * never deleted, so over time they will outnumber open ones many times over;
 * fetching them all and hiding them on the phone would mean downloading a
 * growing pile of rows to render none of them.
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
 * COMPLETED tasks in one frequency, most recently closed first.
 *
 * Opt-in and BOUNDED, for the same reason the open list filters in SQL. Sorted
 * by completed_at now that there is one: updated_at moved on any edit, so a
 * typo fixed on an old task used to float it to the top of "recently done".
 * v2 rows closed before migration 0020 have completed_at backfilled.
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
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * What the Today view shows, in one call: open tasks due today or earlier
 * across every frequency, what was closed since local midnight, and the next
 * dated task, for the "nothing left today" state to point at.
 */
export async function listToday(
  today: string = todayISO(),
): Promise<{ open: Todo[]; closedToday: Todo[]; next: Todo | null }> {
  const ownerId = await getOwnerId();

  const [open, closed, next] = await Promise.all([
    supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', ownerId)
      .eq('is_done', false)
      .lte('due_date', today)
      .order('due_date', { ascending: true })
      .order('position', { ascending: true }),
    supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', ownerId)
      .eq('is_done', true)
      .gte('completed_at', localDayStartISO(today))
      .order('completed_at', { ascending: false }),
    supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', ownerId)
      .eq('is_done', false)
      .gt('due_date', today)
      .order('due_date', { ascending: true })
      .order('due_time', { ascending: true, nullsFirst: false })
      .limit(1),
  ]);

  if (open.error) throw new Error(open.error.message);
  if (closed.error) throw new Error(closed.error.message);
  if (next.error) throw new Error(next.error.message);
  return { open: open.data ?? [], closedToday: closed.data ?? [], next: next.data?.[0] ?? null };
}

/**
 * Every open task, across all four tabs, with only what the tile counts.
 * Selecting two columns instead of `*` keeps the payload small, since this
 * runs on every visit to the home screen.
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

/** Every open task in full: reminders are rebuilt from these, and the website's calendar projects repeats from them. */
export async function listAllOpen(): Promise<Todo[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .eq('is_done', false)
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Closed tasks whose due date falls in [start, end], for a month calendar. */
export async function listClosedBetween(start: string, end: string): Promise<Todo[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .eq('is_done', true)
    .gte('due_date', start)
    .lte('due_date', end);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * The closed occurrences of the given series, oldest first: what streaks and
 * the per-routine history are computed from.
 *
 * The first occurrence of a series has no series_id - its key IS its id - so
 * the match is on either column. Bounded, though generously: years of a daily
 * routine.
 */
export async function listSeriesHistory(keys: string[]): Promise<Todo[]> {
  if (keys.length === 0) return [];
  const ownerId = await getOwnerId();
  const list = [...new Set(keys)].join(',');

  const { data, error } = await supabase
    .from(TABLE)
    .select(HISTORY_COLUMNS)
    .eq('user_id', ownerId)
    .eq('is_done', true)
    .or(`series_id.in.(${list}),id.in.(${list})`)
    .order('due_date', { ascending: true })
    .limit(3000);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Todo[];
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
    // to know about identity at all. The repeat columns are settled here too,
    // so every client writes a complete rule (see input.ts).
    .insert({ ...normalizeInput(input, todayISO()), user_id: ownerId })
    // .select().single() makes the insert return the row it just wrote,
    // including database-generated columns (id, created_at). One round trip
    // instead of insert-then-fetch.
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Save edits. A FULL input (the editor's, which always carries the title,
 * frequency and repeat switch) has its rule settled like a new task's; a
 * partial one - a reschedule, a ticked check item, new notes - is written as
 * given.
 */
export async function updateTodo(id: string, input: Partial<TodoInput>): Promise<Todo> {
  const isFull =
    input.title !== undefined && input.frequency !== undefined && input.is_repeat !== undefined;
  const values = isFull ? normalizeInput(input as TodoInput, todayISO()) : input;

  const { data, error } = await supabase
    .from(TABLE)
    .update(values)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Close a task as done or skipped, and create its next occurrence if it
 * repeats. Returns that occurrence, or null.
 *
 * SOFT COMPLETE. The row is marked done, never deleted. Completion is history:
 * deleting it would throw away the only record that the thing ever happened,
 * and for a repeating task it would erase the whole trail. A SKIP is closed
 * the same way with outcome 'skipped', so history says it was passed over on
 * purpose rather than done.
 *
 * THE SUCCESSOR carries the rule, the time and reminder, the notes, the
 * series, and the checklist with every item unticked (a weekly bills run
 * starts each week from scratch). Priority goes back to normal: it described
 * how urgent this occurrence was, and a task marked urgent once should not be
 * urgent forever. Its date comes from the recurrence engine, which rolls an
 * overdue repeat past today rather than one interval at a time.
 *
 * ORDER OF WRITES. The close is written first, then the successor. If the
 * second write fails the task is reopened and the error rethrown: leaving it
 * closed would end the recurrence SILENTLY, and the occurrence that never
 * arrives is not something you notice until you have missed it.
 */
export async function completeTask(
  todo: Todo,
  outcome: Exclude<Outcome, 'wont_do'> = 'done',
): Promise<Todo | null> {
  const { error } = await supabase
    .from(TABLE)
    .update({ is_done: true, outcome, completed_at: new Date().toISOString() })
    .eq('id', todo.id);
  if (error) throw new Error(error.message);

  if (!todo.is_repeat) return null;

  const ownerId = await getOwnerId();
  const today = todayISO();

  const { data, error: insertError } = await supabase
    .from(TABLE)
    .insert({
      user_id: ownerId,
      title: todo.title,
      frequency: todo.frequency,
      is_repeat: true,
      due_date: nextDueDate(todo.due_date, ruleOf(todo), { today, completedOn: today }),
      due_time: todo.due_time,
      reminder_offset_min: todo.reminder_offset_min,
      repeat_every: todo.repeat_every,
      repeat_weekdays: todo.repeat_weekdays,
      repeat_anchor_day: todo.repeat_anchor_day,
      repeat_nth: todo.repeat_nth,
      repeat_from: todo.repeat_from,
      series_id: seriesKey(todo),
      notes: todo.notes,
      checklist: resetChecklist(todo.checklist ?? []),
      priority: 'normal',
      // Keeps the routine where you put it on the board, rather than jumping
      // to the top of its column every time it comes round.
      position: todo.position,
    })
    .select()
    .single();

  if (insertError) {
    // Reopen before reporting. If this rollback fails too, the thrown message
    // is the one you would have got anyway, so it is never worse than not
    // trying.
    await supabase
      .from(TABLE)
      .update({ is_done: false, outcome: null, completed_at: null })
      .eq('id', todo.id);
    throw new Error(insertError.message);
  }

  return data;
}

/** Pass over one occurrence of a repeat without doing it. */
export function skipTask(todo: Todo): Promise<Todo | null> {
  return completeTask(todo, 'skipped');
}

/**
 * Close a one-off task as abandoned. Kept, like everything closed, and
 * reopenable; it simply does not count as done.
 */
export async function wontDoTask(todo: Todo): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ is_done: true, outcome: 'wont_do', completed_at: new Date().toISOString() })
    .eq('id', todo.id);
  if (error) throw new Error(error.message);
}

/**
 * Reopen a closed task - the Undo after a tick, or a mistake found later in
 * the Completed list. Never spawns an occurrence.
 *
 * A routine has ONE live occurrence. Closing a repeat created the next one,
 * so reopening must take that one away again, or the routine is open twice
 * (v2 did exactly that). What goes is every OTHER open occurrence of the
 * series that is still untouched - created and never edited since, which is
 * what equal created_at and updated_at mean. One you have edited is kept: two
 * open rows you can see beat a change you made being quietly deleted.
 *
 * Reopen first, delete last: if the delete fails you have a visible
 * duplicate, never a routine with nothing open.
 *
 * Returns the ids it removed, so a caller holding them in a list can drop
 * them without a refetch.
 */
export async function reopenTask(id: string): Promise<{ reopened: Todo; removed: string[] }> {
  const { data: reopened, error } = await supabase
    .from(TABLE)
    .update({ is_done: false, outcome: null, completed_at: null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const row = reopened as Todo;
  if (!row.is_repeat && !row.series_id) return { reopened: row, removed: [] };

  const key = seriesKey(row);
  const { data: siblings, error: findError } = await supabase
    .from(TABLE)
    .select('id, created_at, updated_at')
    .eq('is_done', false)
    .neq('id', row.id)
    .or(`series_id.eq.${key},id.eq.${key}`);
  if (findError) throw new Error(findError.message);

  const removed = ((siblings ?? []) as { id: string; created_at: string; updated_at: string }[])
    .filter((s) => s.created_at === s.updated_at)
    .map((s) => s.id);
  if (removed.length === 0) return { reopened: row, removed };

  const { error: deleteError } = await supabase.from(TABLE).delete().in('id', removed);
  if (deleteError) throw new Error(deleteError.message);
  return { reopened: row, removed };
}

/**
 * Move tasks to a new due date (or none), all at once - the Today view's
 * "Reschedule" on the whole Overdue section is one request, not one per task.
 *
 * Only the date moves. A repeat's weekdays and anchor day live in their own
 * columns, so the occurrence after this one is back on the schedule.
 */
export async function rescheduleTasks(ids: string[], dueDate: string | null): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from(TABLE).update({ due_date: dueDate }).in('id', ids);
  if (error) throw new Error(error.message);
}

/**
 * Complete by id, for the Done button on a reminder, where all that arrives is
 * the id. A task already closed (ticked on the website meanwhile, or the
 * button pressed twice) is left alone.
 */
export async function completeById(id: string): Promise<void> {
  const todo = await getTodo(id);
  if (todo.is_done) return;
  await completeTask(todo, 'done');
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

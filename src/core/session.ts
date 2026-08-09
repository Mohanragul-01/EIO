/**
 * session.ts - answers one question for the whole app: "who owns this row?"
 *
 * WHY THIS ABSTRACTION EXISTS:
 * Every module's queries need an owner id - to filter reads and stamp writes.
 * If each module called `supabase.auth.getUser()` directly, changing how
 * identity works would mean editing every module. Instead modules call
 * `getOwnerId()`, and this file is the only thing that knows where it comes
 * from.
 *
 * That design just paid for itself: switching from "no sign-in with a fixed
 * id" to "real authentication" changed THIS FILE and nothing else. api.ts,
 * the hooks and the screens were untouched.
 *
 *  CURRENT MODE: AUTHENTICATED
 * The owner id is the signed-in user's `auth.uid()`, and Row Level Security is
 * ON - the database itself refuses to return rows belonging to anyone else.
 * The anon key in the app bundle is now safe to ship: on its own it grants
 * nothing, because every policy requires a valid signed-in user.
 */
import { supabase } from './supabase';

/**
 * The current user's id.
 *
 * Throws rather than returning null when signed out. A query that runs without
 * an owner would either fail confusingly at the database level or silently
 * return nothing; failing loudly here makes the cause obvious. In practice
 * this shouldn't fire, because the navigator won't render app screens without
 * a session.
 */
export async function getOwnerId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Not signed in');

  return data.user.id;
}

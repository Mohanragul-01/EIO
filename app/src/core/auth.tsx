/**
 * auth.tsx - who is signed in, for the whole app.
 *
 *  WHY A CONTEXT
 * The session is needed in several unrelated places: the navigator (to decide
 * whether to show the sign-in screen), the home screen (to show a sign-out
 * button), and session.ts (to stamp rows). Passing it down as props through
 * every layer would be miserable. React Context is the standard answer for
 * "one value, many distant consumers".
 *
 *  HOW THE SESSION SURVIVES APP RESTARTS
 * supabase-js persists the session to AsyncStorage (configured in
 * supabase.ts) and refreshes the access token in the background. So you sign
 * in ONCE and stay signed in indefinitely - including across app updates.
 * Uninstalling clears AsyncStorage, but signing in again restores everything,
 * because your data is keyed to your account, not to the device.
 */
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from './supabase';

type AuthContextValue = {
  session: Session | null;
  /** True until we've finished reading any stored session from disk. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    /**
     * Two things happen here, and BOTH are needed:
     *
     *  1. getSession() reads whatever is already stored on disk. This is what
     *     makes a returning user skip the sign-in screen. It's async, which is
     *     why `initializing` exists - without it the app would flash the
     *     sign-in screen for a frame before the stored session loads.
     *
     *  2. onAuthStateChange subscribes to every later change: sign-in,
     *     sign-out, and silent token refreshes. Without this subscription the
     *     UI wouldn't react when the session changes from somewhere else.
     */
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      active = false;
      // Always unsubscribe - otherwise the listener outlives the component.
      subscription.subscription.unsubscribe();
    };
  }, []);

  /**
   * useMemo so consumers don't re-render every time this provider renders for
   * an unrelated reason. Without it, a new object identity each render would
   * invalidate every consumer.
   */
  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        // Throw so the calling screen can show the message - same convention
        // as the module api.ts files.
        if (error) throw new Error(error.message);
      },

      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw new Error(error.message);
      },

      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
      },
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * The hook every consumer uses. The undefined check turns "forgot to wrap in
 * AuthProvider" into a clear error at the call site, instead of a confusing
 * crash on `session` being undefined somewhere deeper.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}

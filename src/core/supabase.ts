/**
 * supabase.ts - one shared Supabase client for the whole app.
 *
 * WHY ONE CLIENT: the client object holds the logged-in session and an open
 * realtime connection. Creating a new one per screen would mean multiple
 * sessions and duplicate network work. So we create exactly one here and
 * every module imports this same instance.
 *
 * WHY THE POLYFILL: supabase-js was written for browsers and uses the WHATWG
 * `URL` API. React Native's JS engine (Hermes) ships an incomplete `URL`, so
 * we patch it in before the client is constructed. That import must come first.
 */
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Config comes from `.env` at the project root. Expo inlines any variable
 * prefixed with `EXPO_PUBLIC_` into the JS bundle at build time.
 *
 * That means these values are NOT secret - they ship inside the app. That is
 * fine and intended for Supabase's *anon* key: it is a public key, and what
 * actually protects your data is Row Level Security on the database (the
 * `user_id = auth.uid()` policies from the plan). Never put the service_role
 * key here.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Phase 0 has no Supabase project yet, so we let the app boot without config
 * and expose this flag. Screens can show "not connected yet" instead of
 * crashing on launch. From Phase 1 on, this should be true.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  // Fall back to a syntactically valid dummy URL so createClient doesn't throw
  // before we've filled in .env.
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      // Persist the session on the device so you stay logged in between
      // app launches. On web, supabase-js uses localStorage; React Native
      // has no localStorage, hence AsyncStorage.
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Only relevant on web, where the auth token arrives in the URL hash.
      detectSessionInUrl: false,
    },
  },
);

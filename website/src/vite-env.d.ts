/// <reference types="vite/client" />

/**
 * `__DEV__` is a React Native global. The shared Supabase client reads it to
 * decide whether a missing configuration should throw, and Vite substitutes it
 * at build time exactly as Metro does - so the declaration is all that is
 * missing on this side.
 */
declare const __DEV__: boolean;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

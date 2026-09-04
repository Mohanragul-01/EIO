/**
 * Vite config - and the whole trick that lets this website reuse the phone app.
 *
 * Every api.ts, types.ts and analytics module under ../app/src is already free
 * of React Native imports, so a browser can run them unchanged. The ONE file
 * that is not portable is app/src/core/supabase.ts, which imports AsyncStorage
 * and a URL polyfill for Hermes, and reads Expo's build-time env vars.
 *
 * Rather than fork that file - which would mean two clients drifting apart on
 * the thing that talks to the database - the three React Native specifics are
 * aliased away here. app/src/core/supabase.ts is then byte-for-byte the same
 * file on both platforms, and the app never had to change to accommodate us.
 */
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig(({ mode }) => {
  // The website's own .env, so the two clients keep separate config files even
  // though they point at the same Supabase project.
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    /*
     * Relative asset URLs.
     *
     * GitHub Pages serves a project site from a subpath - /EIO/ - so absolute
     * '/assets/...' would 404 there. Relative paths work under any subpath AND
     * when you open dist/index.html straight off disk, which the absolute form
     * does not. The hash router means routing never depends on the base either,
     * so there is nothing else to configure.
     */
    base: './',

    plugins: [react()],

    resolve: {
      alias: {
        // The shared domain layer, imported as '@app/...'.
        '@app': resolvePath('../app/src'),

        // Pinned to THIS project's copy. Module resolution walks up from the
        // importing file, so the shared supabase.ts would otherwise look in
        // app/node_modules and the repo root and find nothing - the site built
        // here only because the app happened to be installed beside it.
        '@supabase/supabase-js': resolvePath('./node_modules/@supabase/supabase-js'),

        // Hermes ships an incomplete URL implementation; browsers do not.
        // Aliased to an empty module so the import is a no-op here.
        'react-native-url-polyfill/auto': resolvePath('./src/lib/shims/urlPolyfill.ts'),

        // Supabase is handed `storage: AsyncStorage` by the shared file. In a
        // browser the equivalent is localStorage, wrapped to match the async
        // signature AsyncStorage has.
        '@react-native-async-storage/async-storage': resolvePath('./src/lib/shims/asyncStorage.ts'),

        // Subscriptions reaches these through its notification module. A
        // browser cannot schedule an OS-level reminder, so the stubs let the
        // shared code take its own "notifications unavailable" path rather
        // than the website forking that module.
        'react-native': resolvePath('./src/lib/shims/reactNative.ts'),
        expo: resolvePath('./src/lib/shims/expo.ts'),
        'expo-notifications': resolvePath('./src/lib/shims/expoNotifications.ts'),
      },
    },

    define: {
      // The shared file reads Expo's variables and Expo's __DEV__ flag. Both
      // are build-time substitutions there too, so this is the same mechanism
      // with different inputs rather than a workaround.
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL ?? ''),
      'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? ''),
      // Left true so a missing .env shows the app's own "not configured"
      // message instead of throwing before anything renders.
      __DEV__: JSON.stringify(true),
    },

    /*
     * esbuild is told its TypeScript options rather than left to find them.
     *
     * When transforming a file under ../app/src it discovers app/tsconfig.json,
     * which extends "expo/tsconfig.base" - so the build only worked where Expo
     * happened to be installed, and died in a clean checkout complaining about
     * a tsconfig nobody was trying to use.
     *
     * A STRING, not an object. Vite only skips the tsconfig lookup when this is
     * a string (`typeof tsconfigRaw !== 'string'` guards the loader); an object
     * is merged with whatever it finds, so discovery - and the failure - still
     * happens. These are the only options esbuild reads, and they match this
     * project's tsconfig; type CHECKING still runs from tsconfig.json through
     * `tsc --noEmit` in the build script.
     */
    esbuild: {
      tsconfigRaw:
        '{"compilerOptions":{"target":"es2022","useDefineForClassFields":true,"jsx":"react-jsx"}}',
    },

    server: {
      port: 5173,
      // Opens the browser on `npm run dev`, since this is a local-only app.
      open: true,
    },

    build: {
      outDir: 'dist',
      // Charts and Supabase are large; splitting them keeps the first paint
      // from waiting on code the login screen never uses.
      chunkSizeWarningLimit: 900,
    },
  };
});

/**
 * Stands in for `react-native-url-polyfill/auto`.
 *
 * The shared Supabase client imports that polyfill because Hermes ships an
 * incomplete WHATWG `URL`. Every browser this site targets implements it
 * natively, so the correct browser build of that import is nothing at all.
 */
export {};

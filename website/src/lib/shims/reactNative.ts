/**
 * A browser stand-in for the sliver of `react-native` the shared code touches.
 *
 * Only the subscriptions notification module reaches for it, and only for
 * `Platform.OS` when deciding whether to create an Android notification
 * channel. On the web the honest answer is 'web', and that branch is never
 * taken anyway.
 */
export const Platform: {
  OS: 'web' | 'android' | 'ios';
  select: <T>(options: { web?: T; default?: T }) => T | undefined;
} = {
  // Typed as the full union rather than the literal 'web': the shared module
  // compares it against 'android', and a literal type would make that a
  // compile error instead of the false branch it actually is.
  OS: 'web',
  select: <T,>(options: { web?: T; default?: T }): T | undefined =>
    options.web ?? options.default,
};

/**
 * A type-only stand-in for @expo/vector-icons.
 *
 * Four shared modules - categories, registry, and the fitness and custom types
 * - declare their icon fields as `keyof typeof Ionicons.glyphMap`, so the
 * compiler has to resolve the package even though every one of those is an
 * `import type` that disappears at build time. The website therefore needs the
 * TYPES but never the library, and installing a React Native icon set to get
 * them would be absurd.
 *
 * glyphMap is a permissive record rather than the real union of icon names.
 * The website draws its own icons and only ever reads those fields as strings,
 * so the exact union buys nothing here - and copying it would mean a list that
 * silently rots the next time Expo adds an icon.
 */
declare module '@expo/vector-icons' {
  export const Ionicons: {
    glyphMap: Record<string, number>;
  };
}

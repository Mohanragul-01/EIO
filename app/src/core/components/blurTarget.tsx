/**
 * blurTarget.tsx
 *
 * Expo SDK 57 changed how BlurView works on Android. A blur view no longer
 * blurs "whatever happens to be behind it"; it needs an explicit `blurTarget`
 * ref pointing at a BlurTargetView that wraps the content to sample from.
 * Without one it prints a warning and silently renders no blur at all, which
 * is exactly what was happening here: the frosted panels were only ever the
 * tint layer.
 *
 * Passing that ref down by hand would mean threading a prop through every
 * screen into every card. Instead Screen puts the ref on a context and
 * GlassCard reads it, so any card anywhere blurs the aurora behind it with no
 * wiring at the call site.
 */
import React, { createContext, useContext } from 'react';
import type { View } from 'react-native';

type BlurTargetRef = React.RefObject<View | null> | null;

const BlurTargetContext = createContext<BlurTargetRef>(null);

export const BlurTargetProvider = BlurTargetContext.Provider;

/** Null when a card renders outside a Screen; the blur simply degrades to tint. */
export function useBlurTarget(): BlurTargetRef {
  return useContext(BlurTargetContext);
}

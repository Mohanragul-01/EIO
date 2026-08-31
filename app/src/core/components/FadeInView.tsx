/**
 * FadeInView - entrance animation: fade up + a small slide + a slight scale.
 *
 * WHY STAGGER MATTERS: if every tile appears at once, the screen just "pops"
 * in. Delaying each item by ~65ms makes the grid feel like it's assembling
 * itself, which is most of what people read as "polished". Keep the delay
 * small - anything past ~100ms per item starts to feel slow rather than
 * expensive.
 *
 * Everything here animates only `opacity` and `transform`, which are the two
 * properties the native driver can handle off the JS thread. Animating
 * width/height/margin would force a layout pass every frame and drop frames.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { motion } from '../theme';

type FadeInViewProps = {
  children: React.ReactNode;
  /** ms to wait before starting - pass `index * theme.motion.stagger`. */
  delay?: number;
  /** How far up the content travels, in px. */
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
};

export function FadeInView({ children, delay = 0, offsetY = 14, style }: FadeInViewProps) {
  // One driver value from 0 -> 1; opacity and transform are derived from it via
  // interpolate(). Cheaper than running three separate animations in sync.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.enterDuration,
      delay,
      // A decelerate curve (fast start, soft landing) reads as physical.
      // Linear motion is the hallmark of an un-designed animation.
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    animation.start();

    // Stop the animation if the component unmounts mid-flight, otherwise it
    // tries to update a value that's no longer on screen.
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offsetY, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.97, 1],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

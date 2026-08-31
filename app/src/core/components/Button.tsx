/**
 * Button
 *
 * React Native ships a Button, but it is barely styleable and looks different
 * per platform, so most real apps build their own on Pressable. This one adds
 * a press spring and a gradient fill for the solid variants: a flat single
 * colour reads cheap next to glass, whereas a two-stop gradient implies the
 * same light source as the card highlights.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { makeStyles, useTheme } from '../ThemeContext';
import { motion, radius, spacing } from '../theme';

type Variant = 'primary' | 'glass' | 'ghost' | 'danger';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const isInactive = disabled || loading;

  const animateTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, ...motion.press }).start();

  const foreground: Record<Variant, string> = {
    primary: colors.onPrimary,
    danger: '#FFFFFF',
    glass: colors.text,
    ghost: colors.textSecondary,
  };
  const fg = foreground[variant];

  // Gradient endpoints per mode. The dark palette needs a lighter top-left to
  // read as lit; the light palette needs a deeper one to stay legible.
  const primaryGradient: [string, string] = isDark
    ? ['#A3ABFF', '#7079F5']
    : ['#6366F1', '#4338CA'];
  const dangerGradient: [string, string] = isDark
    ? ['#FF9CAC', '#F2637C']
    : ['#F43F5E', '#BE123C'];

  const inner = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={fg} style={styles.icon} /> : null}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </>
      )}
    </View>
  );

  const isGradient = variant === 'primary' || variant === 'danger';

  return (
    <Animated.View style={[{ transform: [{ scale }] }, isInactive && styles.disabled, style]}>
      <Pressable
        onPress={onPress}
        disabled={isInactive}
        onPressIn={() => !isInactive && animateTo(motion.scalePressed)}
        onPressOut={() => !isInactive && animateTo(1)}
        style={styles.pressable}
      >
        {isGradient ? (
          <LinearGradient
            colors={variant === 'primary' ? primaryGradient : dangerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.base}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View style={[styles.base, variant === 'glass' ? styles.glass : styles.ghost]}>
            {inner}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  pressable: {
    borderRadius: radius.md,
    overflow: 'hidden', // clips the gradient to the rounded corners
  },
  base: {
    minHeight: 50, // comfortable touch target, never below about 44
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  glass: {
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  label: {
    fontFamily: typography.title.fontFamily,
    fontSize: typography.title.fontSize,
    letterSpacing: typography.title.letterSpacing,
  },
  disabled: {
    opacity: 0.45,
  },
}));

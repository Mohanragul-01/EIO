/**
 * HomeScreen
 *
 * The grid of module tiles.
 *
 * Notice what is not in here: any branching on which module is which. Built-in
 * modules come from the registry, custom ones from the database, and both are
 * normalised into one Tile shape before rendering. The tile component cannot
 * tell them apart, which is what lets a module you built yourself sit next to
 * Finance without looking like a guest.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';

import { useAuth } from '../core/auth';
import { FadeInView, GlassCard, Screen } from '../core/components';
import { makeStyles, useTheme, type ThemeMode } from '../core/ThemeContext';
import { motion, radius, spacing } from '../core/theme';
import { useCustomModules } from '../modules/custom/useCustomModules';
import { MODULES, type AccentKey } from '../modules/registry';
import type { RootStackParamList } from '../navigation/types';
import { useHomeSummaries } from './useHomeSummaries';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

/** The one shape the grid renders, whatever the tile came from. */
type Tile = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  badge: string | null;
  onPress: () => void;
};

export function HomeScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const { modules: customModules, summaries: customSummaries, reload: reloadModules } = useCustomModules();
  const { summaries, reload: reloadSummaries } = useHomeSummaries();

  // Refresh when returning, so a task ticked off or a module just created is
  // reflected straight away rather than on next launch.
  useFocusEffect(
    // Both loaders are stable (useCallback with no deps, closing over nothing
    // variable), so depending on them cannot loop. Declared rather than
    // suppressed: the last real bug in this app hid behind exactly this
    // suppression, in a hook whose loader was NOT stable.
    useCallback(() => {
      reloadModules();
      reloadSummaries();
    }, [reloadModules, reloadSummaries]),
  );

  const accentFor = useCallback(
    (key: AccentKey) =>
      ({
        indigo: colors.accentIndigo,
        amber: colors.accentAmber,
        emerald: colors.accentEmerald,
        cyan: colors.accentCyan,
        rose: colors.accentRose,
      })[key],
    [colors],
  );

  const tiles = useMemo<Tile[]>(() => {
    const builtIn: Tile[] = MODULES.map((module) => ({
      id: module.key,
      title: module.title,
      // Falls back to the static description until the real figure arrives, so
      // tiles never flash empty on first paint.
      subtitle: summaries[module.key] ?? module.subtitle,
      icon: module.icon,
      accent: accentFor(module.accent),
      badge: module.status === 'planned' ? `Phase ${module.phase}` : null,
      onPress: () => navigation.navigate(module.route),
    }));

    const custom: Tile[] = customModules.map((module) => {
      // Whatever the module was configured to show: a total, an average, the
      // most recent value, or a count when none of those applies.
      const summary = customSummaries[module.id];
      return {
        id: module.id,
        title: module.name,
        subtitle: summary?.text ?? 'No entries',
        icon: module.icon as keyof typeof Ionicons.glyphMap,
        accent: module.color,
        badge: null,
        onPress: () => navigation.navigate('CustomModuleList', { moduleId: module.id }),
      };
    });

    return [...builtIn, ...custom];
  }, [customModules, customSummaries, summaries, navigation, accentFor]);

  return (
    <Screen padded={false}>
      {/*
        FlatList rather than ScrollView with a map: it only renders the rows on
        screen. Overkill for a dozen tiles, but it is the habit we want, and
        numColumns turns it into a grid for free.
      */}
      <FlatList
        data={tiles}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Header />}
        ListFooterComponent={
          <FadeInView delay={(tiles.length + 2) * motion.stagger}>
            <CreateModuleTile onPress={() => navigation.navigate('ModuleBuilder', {})} />
          </FadeInView>
        }
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          // Each tile enters just after the one before it. The header owns the
          // first two slots, so tiles start at index 2.
          <FadeInView delay={(index + 2) * motion.stagger} style={styles.tileWrap}>
            <ModuleTile tile={item} onPress={item.onPress} />
          </FadeInView>
        )}
      />
    </Screen>
  );
}

function Header() {
  const styles = useStyles();

  /**
   * Real content, not filler: the greeting and date come from the device
   * clock. useMemo so it formats once per mount rather than on every render.
   */
  const { greeting, dateLabel } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const text =
      hour < 5
        ? 'Still up'
        : hour < 12
          ? 'Good morning'
          : hour < 17
            ? 'Good afternoon'
            : 'Good evening';

    return {
      greeting: text,
      dateLabel: now
        .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
        .toUpperCase(),
    };
  }, []);

  return (
    <View style={styles.header}>
      <FadeInView delay={0}>
        <View style={styles.brandRow}>
          <View style={styles.brandText}>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            <Text style={styles.greeting}>{greeting}</Text>
          </View>
          <ThemeToggle />
        </View>
      </FadeInView>

      <FadeInView delay={motion.stagger}>
        <AccountStrip />
      </FadeInView>

      <FadeInView delay={motion.stagger}>
        <Text style={styles.sectionLabel}>Modules</Text>
      </FadeInView>
    </View>
  );
}

/**
 * Cycles System, Light, Dark.
 *
 * A three-way cycle on one button rather than a settings screen: there is
 * exactly one preference in this app, and burying it a screen deep would cost
 * more taps than it saves. The icon shows what is currently active.
 */
function ThemeToggle() {
  const styles = useStyles();
  const { colors, mode, setMode, isDark } = useTheme();

  const next: Record<ThemeMode, ThemeMode> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
  };

  const icon: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
    system: 'phone-portrait-outline',
    light: 'sunny-outline',
    dark: 'moon-outline',
  };

  const label: Record<ThemeMode, string> = {
    system: 'Match phone',
    light: 'Light',
    dark: 'Dark',
  };

  return (
    <Pressable
      onPress={() => setMode(next[mode])}
      style={({ pressed }) => [styles.themeButton, pressed && styles.pressed]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Theme: ${label[mode]}. Tap to change.`}
    >
      <Ionicons
        name={icon[mode]}
        size={16}
        color={isDark ? colors.textSecondary : colors.textSecondary}
      />
      <Text style={styles.themeLabel}>{label[mode]}</Text>
    </Pressable>
  );
}

/** Which account is signed in, plus a way out. Real state, no invented numbers. */
function AccountStrip() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { session, signOut } = useAuth();
  const email = session?.user?.email;

  const handleSignOut = () => {
    // Easy to hit by accident and it means retyping a password, so it asks.
    Alert.alert('Sign out?', 'Your data stays safe. Signing back in restores everything.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <GlassCard style={styles.status} intensity={26}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
        <View style={styles.statusText}>
          <Text style={styles.statusTitle} numberOfLines={1}>
            Synced
          </Text>
          <Text style={styles.statusCaption} numberOfLines={1}>
            {email ?? 'Signed in'}
          </Text>
        </View>
        <Pressable onPress={handleSignOut} hitSlop={10} accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={19} color={colors.textMuted} />
        </Pressable>
      </View>
    </GlassCard>
  );
}

/**
 * One tile. It lives here because only the home screen uses it. Shared pieces
 * go in core/components; screen-specific ones stay local.
 */
function ModuleTile({ tile, onPress }: { tile: Tile; onPress: () => void }) {
  const styles = useStyles();

  return (
    <GlassCard onPress={onPress} style={styles.tile}>
      <View style={styles.tileBody}>
        {/* Tint built from the accent plus an alpha suffix, so tile and icon
            share a hue without hand-picking a second colour per module. */}
        <View
          style={[
            styles.iconDisc,
            { backgroundColor: tile.accent + '24', borderColor: tile.accent + '3B' },
          ]}
        >
          <Ionicons name={tile.icon} size={20} color={tile.accent} />
        </View>

        <View style={styles.tileMeta}>
          <Text style={styles.tileTitle} numberOfLines={1}>
            {tile.title}
          </Text>
          <Text style={styles.tileSubtitle} numberOfLines={2}>
            {tile.subtitle}
          </Text>
        </View>

        {tile.badge ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{tile.badge}</Text>
          </View>
        ) : (
          <View style={styles.openRow}>
            <Text style={[styles.openText, { color: tile.accent }]}>Open</Text>
            <Ionicons name="arrow-forward" size={13} color={tile.accent} />
          </View>
        )}
      </View>
    </GlassCard>
  );
}

/**
 * The build-your-own entry point. Dashed rather than glass, because it is an
 * action, not a module. Making it look like the other tiles would imply you
 * can open it and find something inside.
 */
function CreateModuleTile({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.createTile, pressed && styles.createTilePressed]}
      accessibilityRole="button"
      accessibilityLabel="Build your own module"
    >
      <Ionicons name="add-circle-outline" size={20} color={colors.textSecondary} />
      <View style={styles.createText}>
        <Text style={styles.createTitle}>Build a module</Text>
        <Text style={styles.createSubtitle}>Pick the fields, get the screens</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  column: {
    gap: spacing.md, // horizontal gap between the two columns
  },
  tileWrap: {
    flex: 1,
    marginBottom: spacing.md,
  },

  header: {
    paddingTop: spacing.xxl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandText: {
    flex: 1,
  },
  dateLabel: {
    ...typography.overline,
    color: colors.textFaint,
  },
  greeting: {
    ...typography.display,
    marginTop: spacing.sm,
  },

  themeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginTop: spacing.xs,
  },
  themeLabel: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },

  status: {
    marginTop: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    marginRight: spacing.md,
  },
  statusText: {
    flex: 1, // takes the leftover width, pushing the icon to the right edge
    paddingRight: spacing.md,
  },
  statusTitle: {
    ...typography.title,
    fontSize: 14,
  },
  statusCaption: {
    ...typography.caption,
    marginTop: 2,
  },

  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },

  tile: {
    flex: 1, // each tile takes an equal share of its row
  },
  tileBody: {
    minHeight: 138,
  },
  iconDisc: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMeta: {
    flex: 1,
    marginTop: spacing.lg,
  },
  tileTitle: {
    ...typography.title,
  },
  tileSubtitle: {
    ...typography.caption,
    marginTop: 3,
  },
  chip: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipText: {
    ...typography.caption,
    fontSize: 10.5,
    color: colors.textMuted,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
  },
  openText: {
    ...typography.caption,
    fontSize: 12,
  },

  createTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    // Dashed, so it reads as "add something" rather than as content.
    borderStyle: 'dashed',
    borderColor: colors.glassBorderStrong,
    backgroundColor: colors.glass,
  },
  createTilePressed: {
    backgroundColor: colors.glassStrong,
  },
  createText: {
    flex: 1,
  },
  createTitle: {
    ...typography.title,
    fontSize: 14.5,
  },
  createSubtitle: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: 2,
  },
}));

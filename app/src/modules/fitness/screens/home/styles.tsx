/**
 * styles - the look shared by the Fitness home tabs, and their error banner.
 */
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { FadeInView, GlassCard } from '../../../../core/components';
import { makeStyles, useTheme } from '../../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../../core/theme';

export function ErrorBanner({ message }: { message: string }) {
  const styles = useHomeStyles();
  const { colors } = useTheme();

  return (
    <FadeInView style={styles.errorWrap}>
      <GlassCard style={styles.errorCard}>
        <View style={styles.errorRow}>
          <Ionicons name="warning-outline" size={17} color={colors.danger} />
          <Text style={styles.errorText} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </GlassCard>
    </FadeInView>
  );
}

export const useHomeStyles = makeStyles(({ colors, typography }) => ({
  addLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  linkMuted: {
    ...typography.caption,
    color: colors.textMuted,
  },
  linkDisabled: {
    opacity: 0.4,
  },
  tabsTopSpacer: {
    // Clears the transparent nav header. SwipeTabs owns the tab row's own
    // horizontal padding, so this is only the gap above it.
    height: 96,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: 110, // clears the FAB
  },
  listEmpty: {
    flexGrow: 1,
  },
  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  link: {
    ...typography.caption,
    color: colors.primary,
  },
  label: {
    ...typography.overline,
  },
  hint: {
    ...typography.caption,
    fontSize: 12,
    marginTop: spacing.sm,
  },

  row: {
    marginBottom: spacing.md,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...typography.title,
    fontSize: 14.5,
  },
  rowSub: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },

  addCard: {
    marginBottom: spacing.md,
  },
  addInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 6,
  },
  groupRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  groupChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  groupChipActive: {
    backgroundColor: colors.accentRose + '26',
    borderColor: colors.accentRose + '59',
  },
  groupText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  groupTextActive: {
    color: colors.accentRose,
  },
  pressed: {
    opacity: 0.7,
  },

  weightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  weightInput: {
    fontFamily: fonts.bold,
    fontSize: 30,
    letterSpacing: -0.8,
    color: colors.text,
    padding: 0,
    minWidth: 90,
  },
  unit: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
  },
  bmi: {
    ...typography.caption,
    marginTop: spacing.md,
  },

  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },

  errorWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xxl + 70,
  },
  errorCard: {
    borderColor: colors.danger + '55',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
}));

/**
 * CustomModuleListScreen - the entry list for ONE user-created module.
 *
 * Compare this to TodoListScreen or FitnessListScreen: same structure, but
 * nothing about it is specific to any domain. It renders whatever the field
 * definitions describe, which is why one file serves every module you'll ever
 * create.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { Button, EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { CustomRecordRow } from '../components/CustomRecordRow';
import { useCustomRecords } from '../useCustomRecords';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CustomModuleList'>;
type Route = RouteProp<RootStackParamList, 'CustomModuleList'>;

export function CustomModuleListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { moduleId } = route.params;

  const { module, fields, records, loading, refreshing, error, refresh, reload } =
    useCustomRecords(moduleId);

  useFocusEffect(
    // reload keeps one identity for the life of the screen and always calls
    // the latest loader, so this can depend on it without refetching in a loop.
    useCallback(() => {
      reload();
    }, [reload]),
  );

  /**
   * The header title comes from the data, so it can't be set in the navigator
   * - it isn't known until the module loads. A gear button on the right opens
   * the builder to edit this module's fields.
   */
  useLayoutEffect(() => {
    navigation.setOptions({
      title: module?.name ?? '',
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('ModuleBuilder', { moduleId })}
          hitSlop={10}
          accessibilityLabel="Edit this module"
        >
          <Ionicons name="options-outline" size={21} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, module?.name, moduleId]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const accent = module?.color ?? colors.primary;
  const hasRecords = records.length > 0;

  // A module with no fields can't render a form - send the user to fix it
  // rather than showing an add button that opens an empty screen.
  if (fields.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="construct-outline"
          accent={accent}
          title="No fields yet"
          message="This module has nothing to record. Add a field or two and it'll start working."
          action={
            <Button
              label="Set up fields"
              icon="options-outline"
              onPress={() => navigation.navigate('ModuleBuilder', { moduleId })}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, !hasRecords && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListHeaderComponent={
          hasRecords ? (
            <FadeInView>
              <Text style={styles.summary}>
                {records.length} {records.length === 1 ? 'entry' : 'entries'}
              </Text>
            </FadeInView>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={(module?.icon as never) ?? 'cube-outline'}
            accent={accent}
            title="Nothing here yet"
            message={`Add your first entry to ${module?.name ?? 'this module'}.`}
            action={
              <Button
                label="Add entry"
                icon="add"
                onPress={() => navigation.navigate('CustomRecordEdit', { moduleId })}
              />
            }
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <CustomRecordRow
              record={item}
              fields={fields}
              accent={accent}
              onPress={() =>
                navigation.navigate('CustomRecordEdit', { moduleId, recordId: item.id })
              }
            />
          </FadeInView>
        )}
      />

      {error ? (
        <FadeInView style={styles.errorWrap}>
          <GlassCard style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Ionicons name="warning-outline" size={17} color={colors.danger} />
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            </View>
          </GlassCard>
        </FadeInView>
      ) : null}

      {hasRecords ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('CustomRecordEdit', { moduleId })}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: accent },
              pressed && styles.fabPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add entry"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: 110,
  },
  listEmpty: {
    flexGrow: 1,
    paddingTop: 80,
  },
  summary: {
    ...typography.overline,
    marginBottom: spacing.lg,
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
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
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

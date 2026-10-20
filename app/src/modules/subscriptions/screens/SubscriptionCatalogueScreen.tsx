/**
 * SubscriptionCatalogueScreen - add a subscription in seconds.
 *
 * Opens on a search field with the keyboard up, because you arrive knowing
 * the name. Indian services come first. Picking one opens the editor with
 * everything filled in but the price, which you confirm - prices change and
 * differ by plan, and a stale one pre-filled is a wrong number you might not
 * notice. Anything missing is one tap away: "Add your own", labelled, not a
 * bare icon.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, Text, TextInput, View } from 'react-native';

import { Screen } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { layout, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { CATALOGUE, searchCatalogue, type CatalogueGroup, type Service } from '../catalogue';
import { BrandTile } from '../components/BrandTile';
import { cycleLabel } from '../cycles';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SubscriptionCatalogue'>;

export function SubscriptionCatalogueScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Add a subscription' });
  }, [navigation]);

  /**
   * Grouped by kind when browsing (Video, Mobile, TV...), in catalogue order
   * so India comes first; one flat ranked list while searching.
   */
  const sections = useMemo(() => {
    const results = searchCatalogue(query);
    if (query.trim()) return [{ title: `${results.length} found`, data: results }];
    const groups = new Map<CatalogueGroup, Service[]>();
    for (const service of CATALOGUE) {
      const list = groups.get(service.group);
      if (list) list.push(service);
      else groups.set(service.group, [service]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [query]);

  const pick = (service: Service) =>
    navigation.replace('SubscriptionEdit', { serviceKey: service.key });

  return (
    <Screen padded={false}>
      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Netflix, Jio, Swiggy One…"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.primary}
            style={styles.input}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search services"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        ListEmptyComponent={null}
        ListFooterComponent={
          query.trim() && sections[0]?.data.length === 0 ? (
            <Text style={styles.none}>
              Not in the list. Add it as your own - it takes the same fields.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => pick(item)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.group}, usually ${cycleLabel(item.cycle).toLowerCase()}`}
          >
            <BrandTile sub={{ name: item.name, color: item.color, service_key: item.key }} />
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.group} · {cycleLabel(item.cycle)}
                {item.currency ? ` · billed in ${item.currency}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => navigation.replace('SubscriptionEdit', {})}
        style={({ pressed }) => [styles.addOwn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Add your own subscription"
      >
        <Ionicons name="add" size={20} color={colors.onPrimary} />
        <Text style={styles.addOwnText}>Add your own</Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  searchWrap: {
    paddingTop: 100,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  // 48dp to press; pulled into the field's padding so the icon sits at its edge.
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: layout.aboveFab + spacing.xxl,
  },
  sectionTitle: {
    ...typography.overline,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
  },
  name: {
    ...typography.title,
    fontSize: 15,
  },
  meta: {
    ...typography.caption,
    fontSize: 12,
  },
  none: {
    ...typography.caption,
    marginTop: spacing.md,
  },
  addOwn: {
    position: 'absolute',
    right: spacing.xl,
    bottom: layout.fabInset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: layout.fabSize,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  addOwnText: {
    ...typography.title,
    fontSize: 15,
    color: colors.onPrimary,
  },
}));

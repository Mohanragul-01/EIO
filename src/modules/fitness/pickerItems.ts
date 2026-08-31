/**
 * pickerItems.ts - filtering and grouping the rows of a PickerSheet.
 *
 * A separate module from the sheet that uses it, and deliberately free of any
 * React Native import, so it can be tested without a renderer. The component
 * next door pulls in @expo/vector-icons, which Jest cannot resolve.
 */

/** One selectable row. `group` is optional: without it the sheet has no headers. */
export type PickerItem = {
  id: string;
  label: string;
  /** A second line, also searched. Used for a routine's exercise count. */
  note?: string;
  group?: string | null;
  /** Shown greyed out and unselectable, rather than hidden. */
  disabled?: boolean;
};

export type PickerSection = { group: string; items: PickerItem[] };

/** The bucket for items with no group of their own. */
export const UNGROUPED = 'Other';

/**
 * Filter by a search term, then group.
 *
 * Matching covers the group and the note as well as the label, so typing
 * "legs" finds the squat - which is how people look for a thing they only half
 * remember the name of.
 *
 * Groups are alphabetical, items alphabetical within them, and "Other" always
 * sinks to the bottom: it is a catch-all rather than a real group, so sorting
 * it under O would scatter the ungrouped rows into the middle of the list.
 */
export function groupItems(items: PickerItem[], query: string): PickerSection[] {
  const needle = query.trim().toLowerCase();
  const matching = needle
    ? items.filter((item) =>
        [item.label, item.group ?? '', item.note ?? ''].some((haystack) =>
          haystack.toLowerCase().includes(needle),
        ),
      )
    : items;

  const groups = new Map<string, PickerItem[]>();
  for (const item of matching) {
    // A group that is null, absent, or whitespace is all the same thing to a
    // reader, so they share one bucket rather than making several headers that
    // look identical.
    const key = item.group?.trim() || UNGROUPED;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === UNGROUPED) return 1;
      if (b === UNGROUPED) return -1;
      return a.localeCompare(b);
    })
    .map(([group, groupItemsIn]) => ({
      group,
      // Copied before sorting: these arrays are built from the caller's items
      // and sorting in place would reorder the list they still hold.
      items: [...groupItemsIn].sort((x, y) => x.label.localeCompare(y.label)),
    }));
}

/**
 * True when no item carries a group, so the sheet should skip headers entirely.
 *
 * A single "Other" heading above an otherwise flat list is noise: it labels
 * nothing, because there is nothing to tell it apart from.
 */
export function isFlat(items: PickerItem[]): boolean {
  return items.every((item) => !item.group?.trim());
}

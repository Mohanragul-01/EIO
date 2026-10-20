/**
 * roles.ts - which field goes where in a list row.
 *
 * A row has three named slots, after Memento's field roles: a TITLE, a
 * SUBTITLE under it, and a BADGE on the right (stars, a duration, a status
 * pill, a tick). Choosing them is optional. Not choosing keeps the v2 rule -
 * first text field, first date field - so no existing module changes shape on
 * its own, and the badge defaults to the first rating, the one field whose
 * glance-value is the whole point ("★★★★ · Done").
 *
 * Every yes/no field not used as the badge becomes a TOGGLE in the row, tapped
 * to tick it off without opening the entry - which is what lets a module work
 * as a daily check-off. Everything else is an EXTRA, shown as a small chip
 * when it has a value.
 */
import { subtitleFieldOf, titleFieldOf, type CustomField, type CustomModule } from './types';

export type RowRoles = {
  title: CustomField | null;
  subtitle: CustomField | null;
  badge: CustomField | null;
  toggles: CustomField[];
  extras: CustomField[];
};

export function rowRoles(
  module: Pick<CustomModule, 'title_field_key' | 'subtitle_field_key' | 'badge_field_key'>,
  fields: CustomField[],
): RowRoles {
  const ordered = [...fields].sort((a, b) => a.position - b.position);
  const byKey = (key: string | null | undefined) =>
    key ? ordered.find((field) => field.key === key) ?? null : null;

  const title = byKey(module.title_field_key) ?? titleFieldOf(ordered);

  const chosenSubtitle = byKey(module.subtitle_field_key);
  const subtitle =
    chosenSubtitle && chosenSubtitle.key !== title?.key
      ? chosenSubtitle
      : subtitleFieldOf(ordered, title?.key);

  const used = new Set([title?.key, subtitle?.key]);
  const chosenBadge = byKey(module.badge_field_key);
  const badge =
    chosenBadge && !used.has(chosenBadge.key)
      ? chosenBadge
      : ordered.find((field) => field.type === 'rating' && !used.has(field.key)) ?? null;
  used.add(badge?.key);

  const rest = ordered.filter((field) => !used.has(field.key));
  return {
    title,
    subtitle,
    badge,
    toggles: rest.filter((field) => field.type === 'boolean'),
    extras: rest.filter((field) => field.type !== 'boolean'),
  };
}

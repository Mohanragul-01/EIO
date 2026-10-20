/**
 * templates.ts - starter modules that fill the builder for you to review.
 *
 * A template is a SUGGESTION, never a module: choosing one fills the builder,
 * and nothing is saved until you press Create. That is the difference from a
 * gallery that installs things - you see every field before it exists, and
 * the template shows off the v3 types, defaults, chart and reminders without
 * a word of explanation.
 *
 * Settings name their fields by LABEL, because a template's fields have no
 * keys until the module is saved. The tests check every label resolves.
 */
import type { Ionicons } from '@expo/vector-icons';

import type {
  ChartAgg,
  ChartBucket,
  DefaultMode,
  FieldType,
  SortDirection,
  SummaryAgg,
  SummaryPeriod,
} from './types';

export type TemplateField = {
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  default_mode?: DefaultMode;
  default_value?: unknown;
  hint?: string;
};

export type ModuleTemplate = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  fields: TemplateField[];
  title?: string;
  subtitle?: string;
  badge?: string;
  group?: string;
  /** Field label to chart; omitted means the first number-like field. */
  chart?: string;
  chartBucket?: ChartBucket;
  chartAgg?: ChartAgg;
  chartWindow?: number;
  summary?: { field?: string; agg: SummaryAgg; period?: SummaryPeriod };
  sort?: { field: string; direction: SortDirection };
  /** 'HH:MM' and weekdays (0 = Sunday). */
  nudge?: { time: string; days: number[] };
  dateReminder?: { field: string; offsetDays: number };
};

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export const TEMPLATES: ModuleTemplate[] = [
  {
    id: 'books',
    name: 'Books',
    icon: 'book-outline',
    color: '#818CF8',
    fields: [
      { label: 'Title', type: 'text', required: true },
      { label: 'Author', type: 'text' },
      {
        label: 'Status',
        type: 'select',
        options: ['To read', 'Reading', 'Done'],
        default_mode: 'fixed',
        default_value: 'To read',
      },
      { label: 'Rating', type: 'rating' },
      { label: 'Genre', type: 'multiselect', options: ['Fiction', 'Non-fiction', 'Sci-fi', 'Biography', 'Self-help'] },
      { label: 'Pages', type: 'number', hint: 'The whole book, not pages read today' },
      { label: 'Finished on', type: 'date' },
    ],
    title: 'Title',
    subtitle: 'Author',
    badge: 'Rating',
    group: 'Status',
    summary: { field: 'Pages', agg: 'sum' },
    sort: { field: 'Finished on', direction: 'desc' },
  },
  {
    id: 'sleep',
    name: 'Sleep',
    icon: 'moon-outline',
    color: '#C084FC',
    fields: [
      { label: 'Night of', type: 'date', required: true, default_mode: 'today' },
      { label: 'Slept', type: 'duration', required: true, default_mode: 'last', hint: 'Time asleep, not time in bed' },
      { label: 'Quality', type: 'rating', default_mode: 'last' },
      { label: 'Woke up rested', type: 'boolean' },
      { label: 'Notes', type: 'text' },
    ],
    title: 'Night of',
    badge: 'Slept',
    chart: 'Slept',
    chartBucket: 'day',
    chartAgg: 'average',
    chartWindow: 7,
    summary: { field: 'Slept', agg: 'average', period: 'week' },
    sort: { field: 'Night of', direction: 'desc' },
    nudge: { time: '09:00', days: EVERY_DAY },
  },
  {
    id: 'plants',
    name: 'Plants',
    icon: 'leaf-outline',
    color: '#34D399',
    fields: [
      { label: 'Plant', type: 'text', required: true },
      {
        label: 'Spot',
        type: 'select',
        options: ['Balcony', 'Window', 'Indoors', 'Garden'],
        default_mode: 'last',
      },
      { label: 'Water next on', type: 'date', hint: 'You get a reminder on the day' },
      { label: 'Fed', type: 'boolean' },
      { label: 'Notes', type: 'longtext' },
    ],
    title: 'Plant',
    subtitle: 'Water next on',
    group: 'Spot',
    sort: { field: 'Water next on', direction: 'asc' },
    dateReminder: { field: 'Water next on', offsetDays: 0 },
  },
  {
    id: 'films',
    name: 'Films',
    icon: 'film-outline',
    color: '#FB7185',
    fields: [
      { label: 'Title', type: 'text', required: true },
      { label: 'Watched on', type: 'date', default_mode: 'today' },
      { label: 'Rating', type: 'rating' },
      { label: 'Where', type: 'select', options: ['Cinema', 'Netflix', 'Prime', 'Hotstar', 'Other'], default_mode: 'last' },
      { label: 'Genre', type: 'multiselect', options: ['Drama', 'Comedy', 'Thriller', 'Action', 'Documentary', 'Animation'] },
      { label: 'Watch again', type: 'boolean' },
    ],
    title: 'Title',
    subtitle: 'Watched on',
    badge: 'Rating',
    summary: { agg: 'count', period: 'month' },
    sort: { field: 'Watched on', direction: 'desc' },
  },
  {
    id: 'habits',
    name: 'Habits',
    icon: 'flame-outline',
    color: '#22D3EE',
    fields: [
      { label: 'Day', type: 'date', required: true, default_mode: 'today' },
      { label: 'Exercised', type: 'boolean' },
      { label: 'Read', type: 'boolean' },
      { label: 'Meditated', type: 'boolean' },
      { label: 'No sugar', type: 'boolean' },
      { label: 'Note', type: 'text' },
    ],
    title: 'Day',
    summary: { agg: 'count', period: 'week' },
    sort: { field: 'Day', direction: 'desc' },
    nudge: { time: '21:00', days: EVERY_DAY },
  },
  {
    id: 'weight',
    name: 'Weight',
    icon: 'scale-outline',
    color: '#FBBF24',
    fields: [
      { label: 'Date', type: 'date', required: true, default_mode: 'today' },
      { label: 'Weight (kg)', type: 'number', required: true, default_mode: 'last' },
      { label: 'Note', type: 'text' },
    ],
    title: 'Date',
    badge: 'Weight (kg)',
    chart: 'Weight (kg)',
    chartBucket: 'entry',
    chartAgg: 'average',
    chartWindow: 7,
    summary: { field: 'Weight (kg)', agg: 'latest' },
    sort: { field: 'Date', direction: 'desc' },
    nudge: { time: '07:30', days: [1, 4] },
  },
];

/** The one-line preview a template card shows: "Title · Author · Rating · …". */
export function templatePreview(template: ModuleTemplate, max = 4): string {
  const labels = template.fields.map((field) => field.label);
  const shown = labels.slice(0, max).join(' · ');
  return labels.length > max ? `${shown} · +${labels.length - max}` : shown;
}

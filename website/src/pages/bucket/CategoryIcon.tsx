/**
 * CategoryIcon - a category's glyph, drawn from the site's own icon set.
 *
 * Which glyph a category gets is decided once, in the app's categories.ts;
 * this only says how the desktop draws each one. A Record over every glyph,
 * so a glyph added there without a drawing here fails the type check.
 */
import { glyphFor, type CategoryGlyph } from '@app/modules/bucket/categories';

import { Icon, type IconName } from '../../components/Icon';

const GLYPH_ICON: Record<CategoryGlyph, IconName> = {
  camera: 'camera',
  bolt: 'bolt',
  home: 'home',
  paw: 'paw',
  body: 'body',
  care: 'medkit',
  balloon: 'balloon',
  civic: 'landmark',
  collection: 'layers',
  gem: 'diamond',
  target: 'target',
  food: 'utensils',
  festival: 'sparkles',
  debate: 'chats',
  sighting: 'binoculars',
  stopwatch: 'timer',
  rocket: 'rocket',
  leaf: 'leaf',
  etiquette: 'wine',
  terrain: 'mountain',
  growth: 'trend',
  dice: 'dice',
  work: 'briefcase',
  groom: 'scissors',
  heart: 'heart',
  admin: 'clipboard',
  journey: 'train',
  language: 'language',
  legacy: 'book',
  mind: 'bulb',
  recovery: 'pulse',
  money: 'cash',
  motorsport: 'gauge',
  music: 'music',
  speaking: 'mic',
  novelty: 'wand',
  giving: 'gift',
  pilgrimage: 'footsteps',
  safety: 'shield',
  sailing: 'sailboat',
  sky: 'telescope',
  sculpture: 'shapes',
  senses: 'ear',
  signals: 'key',
  social: 'people',
  space: 'planet',
  spectator: 'ticket',
  sport: 'trophy',
  tech: 'chip',
  trades: 'wrench',
  travel: 'compass',
  naturalist: 'fish',
  vehicle: 'car',
  art: 'palette',
  water: 'droplet',
  wild: 'flame',
  snow: 'snowflake',
  falconry: 'feather',
  cafe: 'cup',
  wellness: 'flower',
  landmark: 'pin',
  flag: 'flag',
};

/** Decorative: whatever sits beside it already names the category. */
export function CategoryIcon({
  category,
  size = 14,
  className,
}: {
  category: string;
  size?: number;
  className?: string;
}) {
  return <Icon name={GLYPH_ICON[glyphFor(category)]} size={size} className={className} />;
}

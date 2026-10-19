/**
 * categories.ts - an icon for each of the 61 categories.
 *
 * Sixty-one text headers in a row are hard to scan: every section looks like
 * every other until you read it. A glyph gives each one an identity you can
 * find at a glance, in the section headers, the filter sheet and the chips.
 *
 * A SEMANTIC GLYPH, NOT AN ICON NAME. Each category maps to a word ('snow',
 * 'compass') and each client draws that word its own way: Ionicons on the
 * phone, the website's own stroke set on the desktop. Both of those maps are
 * typed as a Record over CategoryGlyph, so adding a glyph here without drawing
 * it on both clients fails the type check rather than rendering nothing.
 *
 * Hard-coded on purpose. The 61 came from the seed migrations and change only
 * when you invent a category, which gets the flag until it is added here. A
 * table of user-chosen icons would be a settings screen for something you set
 * once. The test reads the seed files, so a misspelt key cannot hide.
 */

export type CategoryGlyph =
  | 'camera'
  | 'bolt'
  | 'home'
  | 'paw'
  | 'body'
  | 'care'
  | 'balloon'
  | 'civic'
  | 'collection'
  | 'gem'
  | 'target'
  | 'food'
  | 'festival'
  | 'debate'
  | 'sighting'
  | 'stopwatch'
  | 'rocket'
  | 'leaf'
  | 'etiquette'
  | 'terrain'
  | 'growth'
  | 'dice'
  | 'work'
  | 'groom'
  | 'heart'
  | 'admin'
  | 'journey'
  | 'language'
  | 'legacy'
  | 'mind'
  | 'recovery'
  | 'money'
  | 'motorsport'
  | 'music'
  | 'speaking'
  | 'novelty'
  | 'giving'
  | 'pilgrimage'
  | 'safety'
  | 'sailing'
  | 'sky'
  | 'sculpture'
  | 'senses'
  | 'signals'
  | 'social'
  | 'space'
  | 'spectator'
  | 'sport'
  | 'tech'
  | 'trades'
  | 'travel'
  | 'naturalist'
  | 'vehicle'
  | 'art'
  | 'water'
  | 'wild'
  | 'snow'
  | 'falconry'
  | 'cafe'
  | 'wellness'
  | 'landmark'
  | 'flag';

/** For a category nobody has drawn yet: the module's own icon. */
export const FALLBACK_GLYPH: CategoryGlyph = 'flag';

export const CATEGORY_GLYPH: Readonly<Record<string, CategoryGlyph>> = {
  'Advanced Photography & Visual Storytelling': 'camera',
  'Adventure & Adrenaline Sports': 'bolt',
  'Alternative Living Experiments': 'home',
  'Animals & Nature Interaction': 'paw',
  'Balance & Body Control': 'body',
  'Care & Responsibility Skills': 'care',
  'Circus & Aerial Arts': 'balloon',
  'Civic, Legal & Financial Literacy': 'civic',
  'Collecting & Restoration': 'collection',
  "Collector's Deep Cuts": 'gem',
  'Combat & Precision Sports': 'target',
  'Culinary & Beverage Craft': 'food',
  'Culture, Festivals & Community': 'festival',
  'Debate, Discourse & Competitive Mind Sports': 'debate',
  'Deep Nature Immersion & Rare Sightings': 'sighting',
  'Endurance & Personal Records': 'stopwatch',
  'Entrepreneurship & Startup Experiments': 'rocket',
  'Environmental Action & Sustainable Living': 'leaf',
  'Etiquette, Manners & Social Craft': 'etiquette',
  'Extreme Geography & Nature Phenomena': 'terrain',
  'Financial & Business Literacy Deep-Dive': 'growth',
  'Games, Puzzles & Play': 'dice',
  'Gig Economy & Career Sampling': 'work',
  'Grooming, Styling & Body Literacy': 'groom',
  'Health & Longevity': 'heart',
  'Home Economics & Life Admin Mastery': 'admin',
  'Iconic World Journeys': 'journey',
  'Language & Communication': 'language',
  'Legacy & Knowledge Transfer': 'legacy',
  'Mind, Psychology & Inner Work': 'mind',
  'Modern Recovery & Performance Tech': 'recovery',
  'Money & Hustle Experiments': 'money',
  'Motorsport & Off-Road Riding': 'motorsport',
  'Music & Sound': 'music',
  'Performance & Public Speaking': 'speaking',
  'Performance Novelties': 'novelty',
  'Philanthropy & Giving': 'giving',
  'Pilgrimage & Sacred Journeys': 'pilgrimage',
  'Practical Safety & Everyday Preparedness': 'safety',
  'Sailing, Rowing & Wind Sports': 'sailing',
  'Science, Space & Sky': 'sky',
  'Sculpture & Dimensional Art': 'sculpture',
  'Sensory Exploration & Alternative Therapies': 'senses',
  'Signals, Locks & Hidden Systems': 'signals',
  'Social & Novel Experiences': 'social',
  'Space & Zero-Gravity Experiences': 'space',
  'Spectator Sports & Live World Events': 'spectator',
  'Team & Individual Sports': 'sport',
  'Tech & Digital Experiments': 'tech',
  'Trades, DIY & Engineering Builds': 'trades',
  'Travel & Exploration': 'travel',
  'Underwater, Foraging & Field Naturalist Skills': 'naturalist',
  'Vehicles & Machines': 'vehicle',
  'Visual, Craft & Niche Arts': 'art',
  'Water Adventures': 'water',
  'Wilderness Survival & Outdoor Skills': 'wild',
  'Winter & Snow Sports': 'snow',
  'Working Animals & Falconry': 'falconry',
  'World Culinary & Craft Tourism': 'cafe',
  'World Wellness & Traditional Healing': 'wellness',
  'World Wonders & Landmarks': 'landmark',
};

// Maps rather than indexing the object: a category you happen to call
// "constructor" would otherwise find Object.prototype's, not a glyph.
const EXACT = new Map(Object.entries(CATEGORY_GLYPH));
/** Lower-cased and trimmed, for the forgiving second lookup. */
const BY_KEY = new Map(
  Object.entries(CATEGORY_GLYPH).map(([name, glyph]) => [name.trim().toLowerCase(), glyph]),
);

/**
 * The glyph for a category.
 *
 * Categories are free text you type when adding an item, so "winter & snow
 * sports" is the same section as the seeded name in every way that matters
 * to you; it should look the same too.
 */
export function glyphFor(category: string): CategoryGlyph {
  return EXACT.get(category) ?? BY_KEY.get(category.trim().toLowerCase()) ?? FALLBACK_GLYPH;
}

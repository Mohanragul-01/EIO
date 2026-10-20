/**
 * The category icon map, checked against the list it has to cover.
 *
 * The 61 categories exist only as text in the seed migrations, so a map typed
 * by hand drifts the moment one name is spelled differently - "Collector's"
 * with a curly apostrophe, a missing ampersand - and that category quietly
 * shows the fallback flag forever. Reading the seed files makes both kinds of
 * mistake fail here instead.
 */
import * as fs from 'fs';
import * as path from 'path';

import { CATEGORY_GLYPH, FALLBACK_GLYPH, glyphFor } from '../categories';

const MIGRATIONS = path.resolve(__dirname, '../../../../../supabase/migrations');

/** Every category named in the five seed files, with SQL's doubled quotes undone. */
function seedCategories(): Set<string> {
  const files = fs
    .readdirSync(MIGRATIONS)
    .filter((name) => /^0015[a-e]_bucket_list_part\d\.sql$/.test(name));

  const names = new Set<string>();
  files.forEach((file) => {
    const sql = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
    // Each row reads: ('Category', 0, 'Title', 'cost', position)
    for (const match of sql.matchAll(/^\s*\('((?:[^']|'')+)',\s*\d+,\s*'/gm)) {
      names.add(match[1].replace(/''/g, "'"));
    }
  });
  return names;
}

describe('the category icon map', () => {
  const seeds = seedCategories();

  it('reads all 61 categories from the seed files', () => {
    // If this fails the parser is wrong, and the two tests below prove nothing.
    expect(seeds.size).toBe(61);
  });

  it('has an icon for every category on the list', () => {
    const missing = [...seeds].filter((name) => !(name in CATEGORY_GLYPH));
    expect(missing).toEqual([]);
  });

  it('names no category that is not on the list', () => {
    // A key that matches nothing is a typo, and its real category is the one
    // silently showing a flag.
    const stray = Object.keys(CATEGORY_GLYPH).filter((name) => !seeds.has(name));
    expect(stray).toEqual([]);
  });
});

describe('glyphFor', () => {
  it('finds a category exactly', () => {
    expect(glyphFor('Winter & Snow Sports')).toBe('snow');
  });

  it('forgives case and stray spaces, since categories are typed by hand', () => {
    expect(glyphFor('  winter & snow sports ')).toBe('snow');
  });

  it('gives a category made up later the flag', () => {
    expect(glyphFor('Bonsai')).toBe(FALLBACK_GLYPH);
    expect(FALLBACK_GLYPH).toBe('flag');
  });

  it('is not fooled by a category named like an object property', () => {
    expect(glyphFor('constructor')).toBe('flag');
    expect(glyphFor('toString')).toBe('flag');
  });
});

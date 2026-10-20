/**
 * Row roles: which field is the title, the line under it, and the badge.
 *
 * A module that never chose must look exactly as it did in v2 (first text
 * field, first date field), and a choice pointing at a deleted field must fall
 * back rather than leave a row with no title.
 */
import { rowRoles } from '../roles';
import { makeField, makeModule } from '../testing';

const name = makeField({ key: 'name', type: 'text', position: 0 });
const author = makeField({ key: 'author', type: 'text', position: 1 });
const finished = makeField({ key: 'finished', type: 'date', position: 2 });
const stars = makeField({ key: 'stars', type: 'rating', position: 3 });
const owned = makeField({ key: 'owned', type: 'boolean', position: 4 });
const lent = makeField({ key: 'lent', type: 'boolean', position: 5 });
const pages = makeField({ key: 'pages', type: 'number', position: 6 });
const fields = [pages, lent, owned, stars, finished, author, name];

const keys = (list: { key: string }[]) => list.map((f) => f.key);

describe('rowRoles', () => {
  it('keeps the v2 layout when nothing is chosen, with the first rating as the badge', () => {
    const roles = rowRoles(makeModule(), fields);
    expect(roles.title?.key).toBe('name');
    expect(roles.subtitle?.key).toBe('finished');
    expect(roles.badge?.key).toBe('stars');
  });

  it('uses the chosen fields', () => {
    const roles = rowRoles(
      makeModule({ title_field_key: 'author', subtitle_field_key: 'pages', badge_field_key: 'owned' }),
      fields,
    );
    expect(roles.title?.key).toBe('author');
    expect(roles.subtitle?.key).toBe('pages');
    expect(roles.badge?.key).toBe('owned');
  });

  it('falls back when a chosen field has been deleted', () => {
    const roles = rowRoles(makeModule({ title_field_key: 'gone', badge_field_key: 'gone' }), fields);
    expect(roles.title?.key).toBe('name');
    expect(roles.badge?.key).toBe('stars');
  });

  it('never gives one field two roles', () => {
    const roles = rowRoles(makeModule({ title_field_key: 'name', subtitle_field_key: 'name' }), fields);
    expect(roles.subtitle?.key).toBe('finished');
  });

  it('makes every other yes/no a toggle, and the rest extras, in field order', () => {
    const roles = rowRoles(makeModule({ badge_field_key: 'owned' }), fields);
    expect(keys(roles.toggles)).toEqual(['lent']);
    expect(keys(roles.extras)).toEqual(['author', 'stars', 'pages']);
  });

  it('has no badge without a rating or a choice', () => {
    expect(rowRoles(makeModule(), [name]).badge).toBeNull();
  });
});

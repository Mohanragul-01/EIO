/**
 * The Today checklist: the things you use daily, as one-tap rows.
 *
 * Which products appear is inferred - used on at least 5 of the last 7 days -
 * so the boundaries of that window are the whole behaviour. The window is the
 * seven days BEFORE today: if today counted, ticking a row could add it and
 * un-ticking it could make the row vanish under your finger.
 */
import { todayChecklist } from '../checklist';
import type { Product, ProductUse } from '../types';

const TODAY = '2026-10-19';

let seq = 0;
const product = (over: Partial<Product> = {}): Product => ({
  id: `p${++seq}`,
  user_id: 'u1',
  name: 'Creatine',
  category: 'supplement',
  unit: 'g',
  total_quantity: 500,
  per_use: 5,
  price_minor: null,
  opened_on: '2026-09-01',
  finished_on: null,
  note: '',
  previous_id: null,
  expires_on: null,
  pao_months: null,
  reorder_lead_days: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...over,
});

const entry = (product_id: string, used_on: string, created_at = `${used_on}T08:00:00Z`): ProductUse => ({
  id: `${product_id}-${used_on}-${created_at}`,
  product_id,
  user_id: 'u1',
  used_on,
  quantity: 5,
  note: '',
  created_at,
});

/** Uses on the given days before today (1 = yesterday). */
const daysAgo = (productId: string, ...days: number[]) =>
  days.map((d) => {
    const date = new Date(2026, 9, 19 - d);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return entry(productId, iso);
  });

describe('todayChecklist', () => {
  it('includes a product used on 5 of the last 7 days', () => {
    const p = product({ id: 'a' });
    const rows = todayChecklist([p], daysAgo('a', 1, 2, 3, 5, 7), TODAY);
    expect(rows.map((r) => r.product.id)).toEqual(['a']);
  });

  it('leaves out one used on 4', () => {
    const p = product({ id: 'a' });
    expect(todayChecklist([p], daysAgo('a', 1, 2, 3, 5), TODAY)).toEqual([]);
  });

  it('counts a day once however many times it was used', () => {
    const p = product({ id: 'a' });
    const twiceADay = [
      ...daysAgo('a', 1, 2, 3, 4),
      entry('a', '2026-10-18', '2026-10-18T20:00:00Z'),
    ];
    expect(todayChecklist([p], twiceADay, TODAY)).toEqual([]);
  });

  it('ignores uses eight days ago and today when deciding', () => {
    const p = product({ id: 'a' });
    const uses = [...daysAgo('a', 1, 2, 3, 4, 8), entry('a', TODAY)];
    expect(todayChecklist([p], uses, TODAY)).toEqual([]);
  });

  it('leaves out finished containers and spares', () => {
    const finished = product({ id: 'f', finished_on: '2026-10-18' });
    const spare = product({ id: 's', opened_on: null });
    const uses = [...daysAgo('f', 1, 2, 3, 4, 5), ...daysAgo('s', 1, 2, 3, 4, 5)];
    expect(todayChecklist([finished, spare], uses, TODAY)).toEqual([]);
  });

  it('marks a row done when today already has a use, newest first', () => {
    const p = product({ id: 'a' });
    const morning = entry('a', TODAY, '2026-10-19T03:00:00Z');
    const evening = entry('a', TODAY, '2026-10-19T15:00:00Z');
    const [row] = todayChecklist([p], [...daysAgo('a', 1, 2, 3, 4, 5), morning, evening], TODAY);

    expect(row.done).toBe(true);
    expect(row.todayUses.map((u) => u.id)).toEqual([evening.id, morning.id]);
  });

  it('is not done before today is logged', () => {
    const p = product({ id: 'a' });
    const [row] = todayChecklist([p], daysAgo('a', 1, 2, 3, 4, 5), TODAY);
    expect(row.done).toBe(false);
    expect(row.todayUses).toEqual([]);
  });

  it('logs the per-use amount, or 1 when it was never measured', () => {
    const measured = product({ id: 'a', per_use: 5 });
    const unmeasured = product({ id: 'b', name: 'Face wash', per_use: null });
    const rows = todayChecklist(
      [measured, unmeasured],
      [...daysAgo('a', 1, 2, 3, 4, 5), ...daysAgo('b', 1, 2, 3, 4, 5)],
      TODAY,
    );
    expect(rows.map((r) => [r.product.id, r.amount])).toEqual([
      ['a', 5],
      ['b', 1],
    ]);
  });

  it('keeps rows in name order whether done or not, so a row stays where it was tapped', () => {
    const zinc = product({ id: 'z', name: 'Zinc' });
    const ashwagandha = product({ id: 'w', name: 'ashwagandha' });
    const creatine = product({ id: 'c', name: 'Creatine' });
    const uses = [
      ...daysAgo('z', 1, 2, 3, 4, 5),
      ...daysAgo('w', 1, 2, 3, 4, 5),
      ...daysAgo('c', 1, 2, 3, 4, 5),
      entry('c', TODAY),
    ];
    const rows = todayChecklist([zinc, creatine, ashwagandha], uses, TODAY);
    expect(rows.map((r) => r.product.name)).toEqual(['ashwagandha', 'Creatine', 'Zinc']);
  });

  it('works across the daylight-saving change', () => {
    // New York falls back on 1 November 2026. The seven days before 4 Nov are
    // 28 Oct to 3 Nov, whatever the clocks did in between.
    const p = product({ id: 'a' });
    const uses = ['2026-10-28', '2026-10-30', '2026-11-01', '2026-11-02', '2026-11-03'].map((d) =>
      entry('a', d),
    );
    expect(todayChecklist([p], uses, '2026-11-04')).toHaveLength(1);
    expect(todayChecklist([p], uses, '2026-11-05')).toHaveLength(0);
  });
});

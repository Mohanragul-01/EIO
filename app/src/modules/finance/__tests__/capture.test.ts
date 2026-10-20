/**
 * The capture link: eio://finance/add?amount=…&note=…&category=…
 *
 * Whatever is on the other end - MacroDroid, Tasker, a typo in a shortcut -
 * is not this app, so every parameter is untrusted. The contract: rupees in
 * the URL become paise; anything unusable is dropped with a reason the form
 * can show; nothing is ever turned into a silent ₹0.
 */
import { findLikelyDuplicate, parseCaptureAmount, parseCaptureParams } from '../capture';

const TODAY = '2026-10-19';

describe('parseCaptureAmount', () => {
  it.each([
    ['250', 25000],
    ['249.5', 24950],
    ['249.50', 24950],
    ['1,299.50', 129950],
    ['₹1,299.50', 129950],
    ['Rs. 1,299.50', 129950],
    ['Rs1299', 129900],
    ['rs 20', 2000],
    ['INR 500', 50000],
    [' 40 ', 4000],
    ['1,00,000', 10000000],
  ])('reads %p as %p paise', (raw, minor) => {
    expect(parseCaptureAmount(raw)).toEqual({ minor });
  });

  it.each(['0', '0.00', '-5', 'abc', '1e5', '0x10', '12.345', 'Infinity', 'NaN', '5..0', '₹', '25O'])(
    'refuses %p with a reason',
    (raw) => {
      const result = parseCaptureAmount(raw);
      expect('error' in result && result.error.length > 0).toBe(true);
    },
  );

  it('refuses an amount too large to be one payment', () => {
    expect('error' in parseCaptureAmount('99999999999')).toBe(true);
    expect(parseCaptureAmount('10000000')).toEqual({ minor: 1_000_000_000 });
  });
});

describe('parseCaptureParams', () => {
  it('fills the form from a well-formed link', () => {
    const { prefill, ignored, provided } = parseCaptureParams(
      { amount: '250', note: 'Swiggy', category: 'food' },
      TODAY,
    );
    expect(provided).toBe(true);
    expect(ignored).toEqual([]);
    expect(prefill).toEqual({
      amountMinor: 25000,
      note: 'Swiggy',
      kind: 'expense',
      category: 'food',
      account: null,
      date: null,
    });
  });

  it('leaves a bad amount blank and says why, rather than saving ₹0', () => {
    const { prefill, ignored } = parseCaptureParams({ amount: 'lots' }, TODAY);
    expect(prefill.amountMinor).toBeNull();
    expect(ignored).toHaveLength(1);
    expect(ignored[0]).toMatch(/amount/i);
  });

  it('cleans the note: control characters out, spaces collapsed, at most 200 characters', () => {
    const { prefill } = parseCaptureParams({ note: '  Paid\nto\u0000  SWIGGY\t ' }, TODAY);
    expect(prefill.note).toBe('Paid to SWIGGY');

    const long = parseCaptureParams({ note: 'x'.repeat(260) }, TODAY);
    expect(long.prefill.note).toHaveLength(200);
    expect(long.ignored[0]).toMatch(/200/);
  });

  it('finds a category by key or by label, ignoring case', () => {
    expect(parseCaptureParams({ category: 'Groceries' }, TODAY).prefill.category).toBe('groceries');
    expect(parseCaptureParams({ category: ' TRANSPORT ' }, TODAY).prefill.category).toBe('transport');
  });

  it('takes an income category with no type as income', () => {
    const { prefill } = parseCaptureParams({ amount: '50000', category: 'salary' }, TODAY);
    expect(prefill.kind).toBe('income');
    expect(prefill.category).toBe('salary');
  });

  it('drops a category that does not fit the type, with a reason', () => {
    const { prefill, ignored } = parseCaptureParams({ kind: 'expense', category: 'salary' }, TODAY);
    expect(prefill.category).toBeNull();
    expect(ignored[0]).toMatch(/salary/);
  });

  it('drops a category it does not know, with a reason', () => {
    const { prefill, ignored } = parseCaptureParams({ category: 'crypto' }, TODAY);
    expect(prefill.category).toBeNull();
    expect(ignored[0]).toMatch(/crypto/);
  });

  it('reads a bank alert\'s debit and credit as expense and income', () => {
    expect(parseCaptureParams({ kind: 'debited' }, TODAY).prefill.kind).toBe('expense');
    expect(parseCaptureParams({ kind: 'CREDIT' }, TODAY).prefill.kind).toBe('income');
    const odd = parseCaptureParams({ kind: 'refund?' }, TODAY);
    expect(odd.prefill.kind).toBe('expense');
    expect(odd.ignored).toHaveLength(1);
  });

  it('accepts a real past or present date and refuses anything else', () => {
    expect(parseCaptureParams({ date: '2026-10-18' }, TODAY).prefill.date).toBe('2026-10-18');
    expect(parseCaptureParams({ date: TODAY }, TODAY).prefill.date).toBe(TODAY);
    ['2026-02-30', '2026-10-20', '18/10/2026', 'yesterday'].forEach((date) => {
      const result = parseCaptureParams({ date }, TODAY);
      expect(result.prefill.date).toBeNull();
      expect(result.ignored).toHaveLength(1);
    });
  });

  it('keeps an account name for the form to match, trimmed', () => {
    expect(parseCaptureParams({ account: '  HDFC ' }, TODAY).prefill.account).toBe('HDFC');
  });

  it('takes the first of a repeated parameter and ignores unknown ones', () => {
    const { prefill, ignored } = parseCaptureParams(
      { amount: ['20', '9000'], id: 'someone-elses-row', screen: 'x' },
      TODAY,
    );
    expect(prefill.amountMinor).toBe(2000);
    expect(ignored).toEqual([]);
  });

  it('says nothing was provided when the link carried nothing it knows', () => {
    expect(parseCaptureParams(undefined, TODAY).provided).toBe(false);
    expect(parseCaptureParams({ other: '1' }, TODAY).provided).toBe(false);
  });

  it('quotes garbage briefly in a reason, never in full', () => {
    const { ignored } = parseCaptureParams({ amount: 'z'.repeat(500) }, TODAY);
    expect(ignored[0].length).toBeLessThan(120);
  });
});

describe('findLikelyDuplicate', () => {
  const now = new Date(Date.UTC(2026, 9, 19, 9, 0, 0));
  const recent = [
    { id: 'a', amount_minor: 25000, kind: 'expense' as const, created_at: '2026-10-19T08:55:00Z', note: 'Swiggy' },
    { id: 'b', amount_minor: 9900, kind: 'expense' as const, created_at: '2026-10-19T08:30:00Z', note: 'Uber' },
  ];

  it('flags the same amount and kind logged in the last ten minutes', () => {
    expect(findLikelyDuplicate({ amountMinor: 25000, kind: 'expense' }, recent, now)?.id).toBe('a');
  });

  it('does not flag an older entry, another amount, or another kind', () => {
    expect(findLikelyDuplicate({ amountMinor: 9900, kind: 'expense' }, recent, now)).toBeNull();
    expect(findLikelyDuplicate({ amountMinor: 25001, kind: 'expense' }, recent, now)).toBeNull();
    expect(findLikelyDuplicate({ amountMinor: 25000, kind: 'income' }, recent, now)).toBeNull();
    expect(findLikelyDuplicate({ amountMinor: null, kind: 'expense' }, recent, now)).toBeNull();
  });

  it('reads created_at as the server sends it, on an engine that only knows milliseconds', () => {
    // Supabase sends microseconds and "+00:00". These tests run on V8, which
    // reads that; the phone runs Hermes. An engine that returned NaN for it
    // would make every comparison false and the warning would never show.
    const realParse = Date.parse;
    const strict = jest
      .spyOn(Date, 'parse')
      .mockImplementation((s: string) => (/\.\d{4,}/.test(s) ? NaN : realParse(s)));
    try {
      const fromServer = [{ ...recent[0], created_at: '2026-10-19T08:55:00.123456+00:00' }];
      const found = findLikelyDuplicate({ amountMinor: 25000, kind: 'expense' }, fromServer, now);
      expect(found?.id).toBe('a');
    } finally {
      strict.mockRestore();
    }
  });
});

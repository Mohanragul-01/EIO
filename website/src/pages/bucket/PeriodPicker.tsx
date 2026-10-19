/**
 * PeriodPicker - a year and, optionally, a month, for backdating a memory or
 * aiming a target.
 *
 * A year dropdown rather than a calendar to page through: things on this list
 * were done years ago, and a month calendar reaches 2014 after 150 clicks.
 * Months that cannot be chosen (a memory in the future, a target in the past)
 * stay visible and disabled.
 */
import { MONTH_LONG, MONTH_SHORT } from '@app/modules/bucket/when';

export function PeriodPicker({
  year,
  month,
  onChange,
  allowYearOnly = false,
  minYear,
  maxYear,
  newestFirst = false,
  isMonthDisabled,
  label,
}: {
  year: number;
  month: number | null;
  onChange: (year: number, month: number | null) => void;
  allowYearOnly?: boolean;
  minYear: number;
  maxYear: number;
  /** Memories list recent years first; targets list the nearest first. */
  newestFirst?: boolean;
  isMonthDisabled?: (year: number, month: number) => boolean;
  label: string;
}) {
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  if (newestFirst) years.reverse();

  const pickYear = (next: number) => {
    // Keep the month if the new year allows it; otherwise fall back to the
    // whole year, or to its first allowed month.
    if (month !== null && isMonthDisabled?.(next, month)) {
      const first = Array.from({ length: 12 }, (_, i) => i + 1).find((m) => !isMonthDisabled(next, m));
      onChange(next, allowYearOnly ? null : (first ?? month));
      return;
    }
    onChange(next, month);
  };

  return (
    <div className="bl-period">
      <label className="field bl-period-year">
        <span className="label">{label}</span>
        <select className="input" value={year} onChange={(e) => pickYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <div className="chip-row bl-months" role="radiogroup" aria-label={`Month of ${year}`}>
        {allowYearOnly ? (
          <button
            type="button"
            role="radio"
            aria-checked={month === null}
            className={`chip${month === null ? ' selected' : ''}`}
            onClick={() => onChange(year, null)}
          >
            Just the year
          </button>
        ) : null}
        {MONTH_SHORT.map((short, index) => {
          const m = index + 1;
          const disabled = isMonthDisabled?.(year, m) ?? false;
          return (
            <button
              key={short}
              type="button"
              role="radio"
              aria-checked={month === m}
              aria-label={`${MONTH_LONG[index]} ${year}`}
              disabled={disabled}
              className={`chip${month === m ? ' selected' : ''}`}
              onClick={() => onChange(year, m)}
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

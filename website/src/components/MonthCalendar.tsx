/**
 * MonthCalendar - one month as a grid of days, with month-to-month paging.
 *
 * The website twin of the app's core/components/MonthCalendar, with the same
 * props and the same grid (monthGrid from the app's date helpers), so a page
 * and its screen agree on which days a month shows. Each page draws its own
 * day through `renderDay`; without it a day shows its number, with today
 * outlined and the selected day filled.
 *
 * The parent owns which month is showing, so it can load that month's data.
 */
import type { ReactNode } from 'react';

import { addMonths, fromISODate, monthGrid, todayISO } from '@app/core/date';

import { Icon } from './Icon';

export type CalendarDay = {
  iso: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
};

export function MonthCalendar({
  year,
  month,
  onChangeMonth,
  selected = null,
  onSelect,
  renderDay,
  dayLabel,
  weekStartsOn = 1,
}: {
  year: number;
  /** 1-12. */
  month: number;
  onChangeMonth: (year: number, month: number) => void;
  selected?: string | null;
  /** Without it, days are not clickable. */
  onSelect?: (iso: string) => void;
  /**
   * Draws the inside of a day cell. The cell itself handles the click. With
   * it, the cell draws no today or selected styling of its own, as on the
   * phone: the day passed in says which it is.
   */
  renderDay?: (day: CalendarDay) => ReactNode;
  /** Extra words for screen readers after the date, describing what renderDay drew. */
  dayLabel?: (day: CalendarDay) => string | null;
  /** 1 = Monday (the default), 0 = Sunday. */
  weekStartsOn?: 0 | 1;
}) {
  const weeks = monthGrid(year, month, weekStartsOn);
  const today = todayISO();
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const showingThisMonth = today.startsWith(monthPrefix);

  const title = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const step = (delta: number) => {
    const next = addMonths(year, month, delta);
    onChangeMonth(next.year, next.month);
  };

  const goToToday = () => {
    const now = fromISODate(today);
    onChangeMonth(now.getFullYear(), now.getMonth() + 1);
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <h3 className="cal-title" aria-live="polite">
          {title}
        </h3>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={goToToday}
          disabled={showingThisMonth}
        >
          Today
        </button>
        <button type="button" className="icon-btn" onClick={() => step(-1)} aria-label="Previous month">
          <Icon name="chevronLeft" />
        </button>
        <button type="button" className="icon-btn" onClick={() => step(1)} aria-label="Next month">
          <Icon name="chevronRight" />
        </button>
      </div>

      <div className="cal-grid">
        {/* Weekday initials from the first row, so they follow weekStartsOn.
            Hidden from screen readers: each day's label names its weekday. */}
        {weeks[0].map((iso) => (
          <span key={'h' + iso} className="cal-weekday" aria-hidden="true">
            {fromISODate(iso).toLocaleDateString(undefined, { weekday: 'short' })}
          </span>
        ))}

        {weeks.flat().map((iso) => {
          const day: CalendarDay = {
            iso,
            inMonth: iso.startsWith(monthPrefix),
            isToday: iso === today,
            isSelected: iso === selected,
          };
          const extra = dayLabel?.(day);
          const label =
            fromISODate(iso).toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }) + (extra ? `, ${extra}` : '');
          const className =
            'cal-day' +
            (day.inMonth ? '' : ' cal-day-outside') +
            (!renderDay && day.isToday ? ' cal-day-today' : '') +
            (!renderDay && day.isSelected ? ' cal-day-selected' : '');
          const content = renderDay ? (
            renderDay(day)
          ) : (
            <span className="cal-number">{Number(iso.slice(8))}</span>
          );

          return onSelect ? (
            <button
              key={iso}
              type="button"
              className={className}
              onClick={() => onSelect(iso)}
              aria-label={label}
              aria-pressed={day.isSelected}
              aria-current={day.isToday ? 'date' : undefined}
            >
              {content}
            </button>
          ) : (
            // A plain div cannot carry an aria-label, so the date is spoken from
            // hidden text instead.
            <div key={iso} className={className} aria-current={day.isToday ? 'date' : undefined}>
              <span className="sr-only">{label}</span>
              <span aria-hidden="true">{content}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

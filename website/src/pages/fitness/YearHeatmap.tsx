/**
 * YearHeatmap - 53 weeks of training, one square per day.
 *
 * Rows are weekdays, columns are weeks, this week on the right. A square's
 * colour AND size grow with the day's working sets, every square is labelled in
 * words, and the legend says what each step means in sets - so nothing here is
 * colour alone. It is a real grid for the keyboard: one square is in the tab
 * order, the arrows move a day or a week, and Enter opens that day.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { fromISODate } from '@app/core/date';
import { heatLevel, levelRanges, monthStarts, type HeatDay } from '@app/modules/fitness/heatmap';

import { plural } from './format';

const WEEKDAY_SHOWN = [true, false, true, false, true, false, false];

function describe(iso: string, day: HeatDay | undefined, today: string): string {
  const date = fromISODate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  if (iso > today) return `${date}: still to come`;
  if (!day || day.sessions + day.sets === 0) return `${date}: no training`;
  const modes = [day.gym ? 'gym' : null, day.calisthenics ? 'calisthenics' : null]
    .filter(Boolean)
    .join(' and ');
  const workouts =
    day.sessions > 0 ? `${plural(day.sessions, 'workout')}${modes ? ` (${modes})` : ''}, ` : '';
  return `${date}: ${workouts}${day.sets === 0 ? 'no working sets' : plural(day.sets, 'working set')}`;
}

export function YearHeatmap({
  grid,
  days,
  today,
  selected,
  onSelect,
}: {
  /** grid[weekday][week], from heatmap.yearGrid. */
  grid: string[][];
  days: Record<string, HeatDay>;
  today: string;
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  const weeks = grid[0]?.length ?? 0;
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusIso, setFocusIso] = useState<string | null>(null);
  const tabbable = focusIso ?? selected ?? today;

  const shown = useMemo(() => new Set(grid.flat()), [grid]);
  const max = useMemo(
    () =>
      Math.max(
        0,
        ...Object.entries(days)
          .filter(([iso]) => shown.has(iso))
          .map(([, day]) => day.sets),
      ),
    [days, shown],
  );
  const months = useMemo(() => monthStarts(grid), [grid]);
  const totals = useMemo(() => {
    let workouts = 0;
    let sets = 0;
    for (const [iso, day] of Object.entries(days)) {
      if (!shown.has(iso) || iso > today) continue;
      workouts += day.sessions;
      sets += day.sets;
    }
    return { workouts, sets };
  }, [days, shown, today]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const iso = target.dataset.iso;
    if (!iso) return;
    const row = grid.findIndex((r) => r.includes(iso));
    const column = grid[row]?.indexOf(iso) ?? -1;
    if (row < 0 || column < 0) return;
    const delta: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (iso <= today) onSelect(iso);
      return;
    }
    let next: string | undefined;
    if (delta[event.key]) {
      const [dr, dc] = delta[event.key];
      next =
        grid[Math.min(6, Math.max(0, row + dr))]?.[Math.min(weeks - 1, Math.max(0, column + dc))];
    } else if (event.key === 'Home') next = grid[row][0];
    else if (event.key === 'End') next = grid[row][weeks - 1];
    if (!next) return;
    event.preventDefault();
    setFocusIso(next);
    gridRef.current?.querySelector<HTMLElement>(`[data-iso="${next}"]`)?.focus();
  };

  const ranges = levelRanges(max);

  return (
    <div className="fx-heat-wrap">
      <div className="fx-heat-scroll">
        <div className="fx-heat" style={{ ['--fx-weeks' as string]: weeks }}>
          {/* Month names over the columns: decoration, since every square names its date. */}
          <div className="fx-heat-months" aria-hidden="true">
            <span />
            {months.map((m) => (
              <span key={`${m.year}-${m.month}`} style={{ gridColumn: m.column + 2 }}>
                {new Date(m.year, m.month - 1, 1).toLocaleDateString(undefined, { month: 'short' })}
              </span>
            ))}
          </div>

          <div
            ref={gridRef}
            role="grid"
            aria-label="Training over the last 53 weeks"
            aria-describedby="fx-heat-legend"
            className="fx-heat-grid"
            onKeyDown={onKeyDown}
          >
            {grid.map((row, r) => (
              <div role="row" className="fx-heat-row" key={r}>
                <span role="rowheader" className="fx-heat-weekday">
                  <span aria-hidden="true">
                    {WEEKDAY_SHOWN[r]
                      ? fromISODate(row[0]).toLocaleDateString(undefined, { weekday: 'short' })
                      : ''}
                  </span>
                  <span className="sr-only">
                    {fromISODate(row[0]).toLocaleDateString(undefined, { weekday: 'long' })}
                  </span>
                </span>
                {row.map((iso) => {
                  const day = days[iso];
                  const future = iso > today;
                  const level = future ? 0 : heatLevel(day?.sets ?? 0, max);
                  const trained = !future && !!day && day.sessions + day.sets > 0;
                  const label = describe(iso, day, today);
                  return (
                    <div
                      key={iso}
                      role="gridcell"
                      data-iso={iso}
                      tabIndex={iso === tabbable ? 0 : -1}
                      aria-label={label}
                      aria-selected={iso === selected}
                      aria-disabled={future || undefined}
                      title={label}
                      className={
                        'fx-heat-cell' +
                        (future ? ' future' : '') +
                        (iso === selected ? ' selected' : '') +
                        (iso === today ? ' today' : '')
                      }
                      onClick={() => {
                        setFocusIso(iso);
                        if (!future) onSelect(iso);
                      }}
                      onFocus={() => setFocusIso(iso)}
                    >
                      <span
                        className={`fx-heat-sq l${level}${trained && level === 0 ? ' touched' : ''}`}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fx-heat-foot">
        <span className="muted fx-small numeric">
          {plural(totals.workouts, 'workout')} · {plural(totals.sets, 'working set')} in the last
          year
        </span>
        <ul id="fx-heat-legend" className="fx-heat-legend" aria-label="Legend">
          <li>
            <span className="fx-heat-cell" aria-hidden="true">
              <span className="fx-heat-sq l0" />
            </span>
            No training
          </li>
          {ranges.map((range) => (
            <li key={range.level}>
              <span className="fx-heat-cell" aria-hidden="true">
                <span className={`fx-heat-sq l${range.level}`} />
              </span>
              {range.from === range.to
                ? plural(range.from, 'set')
                : `${range.from}–${range.to} sets`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

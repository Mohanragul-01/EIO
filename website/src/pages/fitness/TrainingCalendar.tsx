/**
 * TrainingCalendar - the month, with the days you trained marked by mode.
 *
 * The phone's TrainingCalendar on the shared MonthCalendar: a trained day gets
 * a dot, a calisthenics day a small cyan corner as well, and both are said in
 * words to screen readers (dayLabel) and in the legend underneath - the marks
 * are shapes, not colours alone.
 */
import { MonthCalendar } from '../../components/MonthCalendar';
import type { TrainingDay } from '@app/modules/fitness/streak';

import { plural } from './format';

export function TrainingCalendar({
  year,
  month,
  onChangeMonth,
  days,
  selected,
  onSelect,
}: {
  year: number;
  month: number;
  onChangeMonth: (year: number, month: number) => void;
  days: Record<string, TrainingDay>;
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  return (
    <div className="fx-cal">
      <MonthCalendar
        year={year}
        month={month}
        onChangeMonth={onChangeMonth}
        selected={selected}
        onSelect={onSelect}
        dayLabel={({ iso }) => {
          const day = days[iso];
          if (!day) return null;
          const kinds = [day.gym ? 'gym' : null, day.calisthenics ? 'calisthenics' : null]
            .filter(Boolean)
            .join(' and ');
          return `${plural(day.count, 'workout')}, ${kinds}`;
        }}
        renderDay={({ iso, inMonth, isToday, isSelected }) => {
          const day = days[iso];
          return (
            <span
              className={
                'fx-cal-day' +
                (inMonth ? '' : ' outside') +
                (isToday ? ' today' : '') +
                (isSelected ? ' selected' : '')
              }
            >
              <span className="fx-cal-num">{Number(iso.slice(8))}</span>
              <span className="fx-cal-marks">
                {day?.gym ? <span className="fx-cal-dot" /> : null}
                {day?.calisthenics ? <span className="fx-cal-diamond" /> : null}
              </span>
            </span>
          );
        }}
      />
      <div className="fx-cal-legend" aria-hidden="true">
        <span>
          <span className="fx-cal-dot" /> Gym
        </span>
        <span>
          <span className="fx-cal-diamond" /> Calisthenics
        </span>
      </div>
    </div>
  );
}

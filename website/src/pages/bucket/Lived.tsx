/**
 * Lived - the Done view as years and months of what you did.
 *
 * Each year opens with its card - how many, what they cost to do, which
 * categories, a month strip - and its months follow, newest first. No
 * strikethrough: on a page where everything is done, a line through every
 * title says nothing. The card summarises what is shown under it, and says
 * so when filters are narrowing it.
 */
import { summariseYear, type LivedYear, type YearSummary } from '@app/modules/bucket/lived';
import { AGAIN_LABEL, COSTS, COST_SHORT, type BucketItem } from '@app/modules/bucket/types';
import { MONTH_LONG, MONTH_SHORT, formatWhen, partsOf } from '@app/modules/bucket/when';

import { Icon } from '../../components/Icon';
import { CategoryIcon } from './CategoryIcon';
import { COST_COLOR } from './PickCard';

/** Five shades of one token, so the strip holds in both themes. */
const LEVEL_MIX = [0, 30, 50, 75, 100];

export function Lived({
  years,
  filtered,
  onOpen,
}: {
  years: LivedYear[];
  filtered: boolean;
  onOpen: (item: BucketItem) => void;
}) {
  return (
    <div className="col" style={{ gap: 'var(--space-xl)' }}>
      {years.map((group) => (
        <section key={group.year ?? 'unknown'} className="bl-year">
          <YearCard year={group.year} summary={summariseYear(group.items)} filtered={filtered} />
          {group.months.map((month) => (
            <div key={`${group.year}-${month.month}`} className="bl-month">
              {group.year !== null ? (
                <div className="row bl-month-head">
                  <span className="column-title">
                    {month.month === null ? `Sometime in ${group.year}` : MONTH_LONG[month.month - 1]}
                  </span>
                  <span className="column-count numeric">{month.items.length}</span>
                </div>
              ) : null}
              <div className="col" style={{ gap: 3 }}>
                {month.items.map((item) => (
                  <LivedRow key={item.id} item={item} onOpen={onOpen} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function YearCard({
  year,
  summary,
  filtered,
}: {
  year: number | null;
  summary: YearSummary;
  filtered: boolean;
}) {
  if (year === null) {
    return (
      <div className="card card-pad">
        <h3 className="bl-year-title">Date unknown</h3>
        <p className="faint bl-small">
          {summary.count} done with no date. Open one to say when - even just the year.
        </p>
      </div>
    );
  }

  const busyMonths = summary.months
    .map((count, index) => (count > 0 ? `${MONTH_LONG[index]} ${count}` : null))
    .filter(Boolean)
    .join(', ');

  return (
    <div className="card card-pad bl-year-card">
      <div>
        <h3 className="bl-year-title">
          <span className="numeric bl-year-count">{summary.count}</span> done in {year}
        </h3>
        {filtered ? <p className="faint bl-small">Of what the filters show</p> : null}
      </div>

      <div className="bl-year-grid">
        <div className="bl-tiles">
          {COSTS.map((cost) => (
            <div key={cost} className="bl-tile">
              <span className="numeric bl-tile-number">{summary.byCost[cost]}</span>
              <span className="row bl-tile-label">
                <span className="dot" style={{ background: COST_COLOR[cost] }} />
                {COST_SHORT[cost]}
              </span>
            </div>
          ))}
          <div className="bl-tile">
            <span className="numeric bl-tile-number">{summary.categoriesTouched}</span>
            <span className="bl-tile-label">Categories</span>
          </div>
        </div>

        <div>
          <div
            className="bl-strip"
            role="img"
            aria-label={busyMonths ? `By month: ${busyMonths}` : 'No dated months'}
          >
            {summary.levels.map((level, index) => (
              <div key={MONTH_SHORT[index]} className="bl-strip-cell" title={`${MONTH_LONG[index]}: ${summary.months[index]}`}>
                <span
                  className="bl-strip-fill"
                  style={{
                    background: `color-mix(in srgb, var(--success) ${LEVEL_MIX[level]}%, var(--surface-3))`,
                  }}
                />
                <span className="bl-strip-label">{MONTH_SHORT[index].charAt(0)}</span>
              </div>
            ))}
          </div>
          {summary.sometime > 0 ? (
            <p className="faint bl-small">+ {summary.sometime} sometime in the year</p>
          ) : null}
        </div>

        {summary.topCategories.length > 0 ? (
          <div className="col" style={{ gap: 4 }}>
            <span className="label">Most in</span>
            {summary.topCategories.map(({ category, count }) => (
              <span key={category} className="row bl-top">
                <CategoryIcon category={category} size={13} />
                <span className="grow truncate">{category}</span>
                <span className="numeric faint">{count}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LivedRow({ item, onOpen }: { item: BucketItem; onOpen: (item: BucketItem) => void }) {
  const precision = item.done_precision ?? 'day';
  const parts = item.done_on ? partsOf(item.done_on) : null;
  const firstLine = item.memory.split('\n')[0].trim();

  return (
    <button
      type="button"
      className="list-row bordered bl-lived-row"
      onClick={() => onOpen(item)}
      aria-label={`${item.title}, done ${item.done_on ? formatWhen(item.done_on, precision) : 'date unknown'}. Open its memory`}
    >
      <span className="bl-date-col" aria-hidden="true">
        {parts && precision === 'day' ? (
          <>
            <span className="numeric bl-date-day">{parts.day}</span>
            <span className="bl-date-month">{MONTH_SHORT[parts.month - 1]}</span>
          </>
        ) : parts && precision === 'month' ? (
          <span className="bl-date-month">{MONTH_SHORT[parts.month - 1]}</span>
        ) : (
          <span className="bl-date-month">·</span>
        )}
      </span>

      <span className="grow col" style={{ gap: 2 }}>
        <span className="bl-lived-title">{item.title}</span>
        <span className="row faint bl-small" style={{ gap: 5 }}>
          <CategoryIcon category={item.category} size={12} />
          <span className="truncate">
            {item.place ? `${item.category} · ${item.place}` : item.category}
          </span>
        </span>
        {firstLine ? (
          <span className="row secondary bl-small" style={{ gap: 5, alignItems: 'flex-start' }}>
            <Icon name="chat" size={12} style={{ marginTop: 2 }} />
            <span>{firstLine}</span>
          </span>
        ) : null}
      </span>

      {item.again ? (
        <span className="pill" title="Do it again?">
          <Icon name={item.again === 'no' ? 'close' : 'repeat'} size={10} />
          {AGAIN_LABEL[item.again]}
        </span>
      ) : null}
    </button>
  );
}

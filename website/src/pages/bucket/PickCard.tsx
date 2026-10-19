/**
 * PickCard - three things you could do, chosen for you, the same all day.
 *
 * The picks follow the page's filters and say what they are drawn from
 * ("3 of 469 · No/low cost"). Click one to look at it; Now puts it on the
 * shelf; Not now hides it from the picks for thirty days. No tick here: a
 * pick is a suggestion, and the list below is where things get ticked.
 */
import { COST_LABEL, COST_SHORT, type BucketItem, type Cost } from '@app/modules/bucket/types';

import { Icon } from '../../components/Icon';
import { CategoryIcon } from './CategoryIcon';

export const COST_COLOR: Record<Cost, string> = {
  low: 'var(--priority-low)',
  moderate: 'var(--priority-normal)',
  high: 'var(--priority-high)',
};

export function PickCard({
  picks,
  poolSize,
  costChip,
  onWiden,
  collapsed,
  onToggleCollapsed,
  onShuffle,
  onOpen,
  onPin,
  onNotNow,
}: {
  picks: BucketItem[];
  poolSize: number;
  costChip: { label: string; onClear: () => void } | null;
  onWiden: (() => void) | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onShuffle: () => void;
  onOpen: (item: BucketItem) => void;
  onPin: (item: BucketItem) => void;
  onNotNow: (item: BucketItem) => void;
}) {
  const summary = `${picks.length} of ${poolSize}${costChip ? ` · ${costChip.label}` : ''}`;

  return (
    <section className="card card-pad bl-card" aria-label="Pick for me">
      <div className="row-between">
        <button
          type="button"
          className="bl-card-toggle"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
        >
          <Icon name="sparkles" size={15} className="bl-accent" />
          <span className="grow">
            <span className="bl-card-title">Pick for me</span>
            <span className="faint numeric bl-small">{summary}</span>
          </span>
          <Icon name={collapsed ? 'chevronDown' : 'chevronUp'} size={14} />
        </button>
        {!collapsed && poolSize > 0 ? (
          <button
            type="button"
            className="icon-btn"
            onClick={onShuffle}
            aria-label="Shuffle the picks"
            title="Shuffle"
          >
            <Icon name="shuffle" size={15} />
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <>
          {costChip ? (
            <div className="chip-row">
              <button
                type="button"
                className="chip selected"
                onClick={costChip.onClear}
                aria-label={`Pick from any cost, not only ${costChip.label}`}
              >
                {costChip.label} <Icon name="close" size={11} />
              </button>
            </div>
          ) : null}

          {picks.length === 0 ? (
            <div className="col" style={{ gap: 6 }}>
              <p className="faint bl-small">
                {onWiden ? 'Nothing at this cost to pick from here.' : 'Nothing left to pick from with these filters.'}
              </p>
              {onWiden ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={onWiden}>
                  Pick from any cost
                </button>
              ) : null}
            </div>
          ) : (
            <div className="col" style={{ gap: 2 }}>
              {picks.map((item) => (
                <div key={item.id} className="bl-pick">
                  <button
                    type="button"
                    className="bl-pick-main"
                    onClick={() => onOpen(item)}
                    aria-label={`${item.title}, ${item.category}, ${COST_LABEL[item.cost]}`}
                  >
                    <span className="bl-glyph">
                      <CategoryIcon category={item.category} size={14} />
                    </span>
                    <span className="grow bl-pick-title">{item.title}</span>
                    <span className="pill">
                      <span className="dot" style={{ background: COST_COLOR[item.cost] }} />
                      {COST_SHORT[item.cost]}
                    </span>
                  </button>
                  <div className="bl-pick-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onPin(item)}
                      aria-label={`Put ${item.title} on Now`}
                    >
                      Now
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onNotNow(item)}
                      aria-label={`Not now: hide ${item.title} from the picks for 30 days`}
                    >
                      Not now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

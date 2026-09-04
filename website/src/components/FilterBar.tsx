/**
 * FilterBar - one filter row, shared by every list in the app.
 *
 * Written once rather than four times because filters that look different on
 * every page read as four separate features rather than one thing you already
 * know how to use. It is also the difference between adding a filter being a
 * two-line change and being a small design exercise each time.
 *
 * Deliberately a row of native <select>s rather than custom dropdowns. A select
 * is keyboard-navigable, typeahead-searchable and screen-reader-correct for
 * free, opens above the fold when it needs to, and does not need a portal, an
 * outside-click handler or a focus trap - all of which is a lot of code to end
 * up somewhere slightly worse.
 */
import { useRef, type ReactNode } from 'react';

import { Icon } from './Icon';

export type FilterOption = {
  value: string;
  label: string;
  /** A colour swatch beside the label, for things identified by colour. */
  dot?: string;
};

export type FilterSpec = {
  key: string;
  /** Shown when nothing is selected, and used as the accessible name. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
};

export function FilterBar({
  search,
  filters,
  onReset,
  trailing,
}: {
  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  filters: FilterSpec[];
  /** Omit when nothing is active - a reset that does nothing is noise. */
  onReset?: () => void;
  /** Extra controls, right-aligned. */
  trailing?: ReactNode;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <div className="filter-bar">
      {search ? (
        <div className="filter-search">
          <Icon name="search" size={14} className="filter-search-icon" />
          <input
            ref={searchRef}
            type="search"
            className="input"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Search'}
            aria-label={search.placeholder ?? 'Search'}
          />
        </div>
      ) : null}

      {filters.map((filter) => {
        // The first option is the "no filter" one by convention, which is what
        // decides whether this control shows as active.
        const isDefault = filter.value === filter.options[0]?.value;
        const selected = filter.options.find((o) => o.value === filter.value);

        return (
          <div key={filter.key} className={`filter-select${isDefault ? '' : ' active'}`}>
            {selected?.dot ? (
              <span className="dot" style={{ background: selected.dot }} />
            ) : null}

            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              aria-label={filter.label}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <Icon name="chevronDown" size={13} className="filter-caret" />
          </div>
        );
      })}

      {onReset ? (
        <button className="btn btn-ghost btn-sm" onClick={onReset}>
          <Icon name="close" size={13} /> Clear
        </button>
      ) : null}

      {trailing ? <div className="filter-trailing">{trailing}</div> : null}
    </div>
  );
}

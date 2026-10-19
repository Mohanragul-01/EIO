/**
 * FieldInput - one field of a custom module's entry form, on the website.
 *
 * The browser twin of the app's components/FieldInput: the same ten types,
 * the same storage (paise for money, whole minutes for a duration, a list for
 * tags), the hint under the field and the "last" tag when a value was copied
 * from the previous entry. What a value MEANS comes from the shared format.ts;
 * only the widgets differ.
 *
 * Number, money and duration keep their own text while you type, for the
 * reason the phone does: storing a number on every keystroke turns "12." back
 * into "12" while you are still typing the decimal.
 */
import { useState } from 'react';

import { minorToAmountString, parseAmountToMinor } from '@app/core/money';
import { joinMinutes, numericValue, splitMinutes } from '@app/modules/custom/format';
import type { CustomField } from '@app/modules/custom/types';

import { Icon } from '../../components/Icon';

type FieldInputProps = {
  field: CustomField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  autoFocus?: boolean;
  /** The value came from the last entry: show the "last" tag. */
  fromLast?: boolean;
  /** Overrides the field's label, for the builder's fixed-default box. */
  label?: string;
};

export function FieldInput({ field, value, onChange, error, autoFocus, fromLast, label }: FieldInputProps) {
  const name = label ?? (field.required ? `${field.label} *` : field.label);

  return (
    <div className="field">
      <div className="cm-label-row">
        <span className="label">{name}</span>
        {fromLast ? (
          <span className="cm-last" title="Filled in from your last entry">
            <Icon name="reset" size={11} /> last
          </span>
        ) : null}
      </div>
      <Control field={field} value={value} onChange={onChange} error={error} autoFocus={autoFocus} name={name} />
      {field.hint?.trim() ? <span className="cm-hint">{field.hint}</span> : null}
      {error ? <span className="error-text">{error}</span> : null}
    </div>
  );
}

function Control({
  field,
  value,
  onChange,
  error,
  autoFocus,
  name,
}: {
  field: CustomField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  autoFocus?: boolean;
  name: string;
}) {
  const invalid = error ? ' invalid' : '';

  switch (field.type) {
    case 'longtext':
      return (
        <textarea
          className={`input${invalid}`}
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          aria-label={name}
        />
      );

    case 'number':
      return <NumberBox value={value} onChange={onChange} invalid={invalid} autoFocus={autoFocus} name={name} />;

    case 'money':
      return <MoneyBox value={value} onChange={onChange} invalid={invalid} autoFocus={autoFocus} name={name} />;

    case 'duration':
      return <DurationBox value={value} onChange={onChange} invalid={invalid} autoFocus={autoFocus} name={name} />;

    case 'rating':
      return <Stars value={numericValue(value)} required={field.required} onChange={onChange} name={name} />;

    case 'date':
      return (
        <input
          className={`input${invalid}`}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          autoFocus={autoFocus}
          aria-label={name}
        />
      );

    case 'boolean':
      return (
        <button
          type="button"
          className="cm-switch-row"
          onClick={() => onChange(value !== true)}
          role="switch"
          aria-checked={value === true}
          aria-label={name}
        >
          <span className={`check${value === true ? ' on' : ''}`}>
            {value === true ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
          </span>
          {value === true ? 'Yes' : 'No'}
        </button>
      );

    case 'select':
      return (
        <select
          className={`input${invalid}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          autoFocus={autoFocus}
          aria-label={name}
        >
          <option value="">—</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case 'multiselect': {
      const chosen = Array.isArray(value) ? value.map(String) : typeof value === 'string' ? [value] : [];
      return (
        <div className="chip-row" role="group" aria-label={name}>
          {field.options.map((option) => {
            const on = chosen.includes(option);
            return (
              <button
                key={option}
                type="button"
                className="chip"
                aria-pressed={on}
                onClick={() =>
                  // Kept in the options' own order, as on the phone.
                  onChange(
                    on
                      ? chosen.filter((item) => item !== option)
                      : field.options.filter((o) => o === option || chosen.includes(o)),
                  )
                }
              >
                <Icon name={on ? 'check' : 'plus'} size={11} />
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    default:
      return (
        <input
          className={`input${invalid}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          maxLength={200}
          aria-label={name}
        />
      );
  }
}

type BoxProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: string;
  autoFocus?: boolean;
  name: string;
};

function NumberBox({ value, onChange, invalid, autoFocus, name }: BoxProps) {
  const [text, setText] = useState(() => {
    const number = numericValue(value);
    return number === null ? '' : String(number);
  });
  return (
    <input
      className={`input numeric${invalid}`}
      inputMode="decimal"
      value={text}
      autoFocus={autoFocus}
      aria-label={name}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9.]/g, '');
        setText(cleaned);
        const parsed = cleaned ? Number(cleaned) : NaN;
        onChange(Number.isFinite(parsed) ? parsed : null);
      }}
    />
  );
}

function MoneyBox({ value, onChange, invalid, autoFocus, name }: BoxProps) {
  const [text, setText] = useState(() => {
    const minor = numericValue(value);
    return minor === null ? '' : minorToAmountString(minor);
  });
  return (
    <div className="cm-affix">
      <span className="cm-affix-text">₹</span>
      <input
        className={`input numeric${invalid}`}
        inputMode="decimal"
        value={text}
        autoFocus={autoFocus}
        aria-label={`${name}, in rupees`}
        onChange={(e) => {
          setText(e.target.value);
          // Paise, like everywhere else in the app; null while half-typed.
          onChange(parseAmountToMinor(e.target.value));
        }}
      />
    </div>
  );
}

function DurationBox({ value, onChange, invalid, autoFocus, name }: BoxProps) {
  const [parts, setParts] = useState(() => {
    const minutes = numericValue(value);
    if (minutes === null) return { hours: '', minutes: '' };
    const split = splitMinutes(minutes);
    return { hours: String(split.hours), minutes: String(split.minutes) };
  });

  const update = (next: { hours: string; minutes: string }) => {
    setParts(next);
    onChange(joinMinutes(next.hours, next.minutes));
  };

  return (
    <div className="cm-duration">
      <div className="cm-affix">
        <input
          className={`input numeric${invalid}`}
          inputMode="numeric"
          value={parts.hours}
          autoFocus={autoFocus}
          aria-label={`${name}, hours`}
          onChange={(e) => update({ ...parts, hours: e.target.value.replace(/[^0-9]/g, '') })}
        />
        <span className="cm-affix-text">h</span>
      </div>
      <div className="cm-affix">
        <input
          className={`input numeric${invalid}`}
          inputMode="numeric"
          value={parts.minutes}
          aria-label={`${name}, minutes`}
          onChange={(e) => update({ ...parts, minutes: e.target.value.replace(/[^0-9]/g, '') })}
        />
        <span className="cm-affix-text">m</span>
      </div>
    </div>
  );
}

/** Five stars as a radio group. Click the current one again to clear it. */
export function Stars({
  value,
  required,
  onChange,
  name,
}: {
  value: number | null;
  required: boolean;
  onChange: (value: number | null) => void;
  name: string;
}) {
  const stars = value !== null && value >= 1 && value <= 5 ? Math.round(value) : 0;
  return (
    <div className="cm-stars" role="radiogroup" aria-label={name}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === stars}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          className={`cm-star${n <= stars ? ' on' : ''}`}
          onClick={() => onChange(n === stars && !required ? null : n)}
        >
          <Icon name={n <= stars ? 'starFilled' : 'star'} size={20} />
        </button>
      ))}
    </div>
  );
}

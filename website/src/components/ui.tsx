/**
 * ui.tsx - the primitives every page is built from.
 *
 * One file rather than one per component: these are small, they share styling
 * conventions, and splitting a dozen twenty-line components across a dozen
 * files makes them harder to keep consistent, not easier.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/* SPINNER ------------------------------------------------------------------ */

export function Spinner({ center = false }: { center?: boolean }) {
  const spinner = <div className="spinner" role="status" aria-label="Loading" />;
  return center ? <div className="spinner-center">{spinner}</div> : spinner;
}

/* EMPTY STATE -------------------------------------------------------------- */

export function Empty({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? <div style={{ fontSize: 30, opacity: 0.5 }}>{icon}</div> : null}
      <div className="empty-title">{title}</div>
      {message ? <p className="empty-msg">{message}</p> : null}
      {action ? <div style={{ marginTop: 'var(--space-sm)' }}>{action}</div> : null}
    </div>
  );
}

/* ERROR BANNER ------------------------------------------------------------- */

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="banner" role="alert">
      {message}
    </div>
  );
}

/* FIELDS ------------------------------------------------------------------- */

type FieldWrap = { label?: string; error?: string | null; hint?: string };

export function TextField({
  label,
  error,
  hint,
  ...props
}: FieldWrap & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      {label ? <span className="label">{label}</span> : null}
      <input className={`input${error ? ' invalid' : ''}`} {...props} />
      {error ? <span className="error-text">{error}</span> : null}
      {!error && hint ? <span className="faint" style={{ fontSize: 12 }}>{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  label,
  error,
  hint,
  ...props
}: FieldWrap & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="field">
      {label ? <span className="label">{label}</span> : null}
      <textarea className={`input${error ? ' invalid' : ''}`} {...props} />
      {error ? <span className="error-text">{error}</span> : null}
      {!error && hint ? <span className="faint" style={{ fontSize: 12 }}>{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  error,
  children,
  ...props
}: FieldWrap & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="field">
      {label ? <span className="label">{label}</span> : null}
      <select className={`input${error ? ' invalid' : ''}`} {...props}>
        {children}
      </select>
      {error ? <span className="error-text">{error}</span> : null}
    </label>
  );
}

/* CHIP PICKER -------------------------------------------------------------- */

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Overrides the accent when selected, for category colours. */
  color?: string;
};

/**
 * A row of single-choice chips.
 *
 * A wrapping grid rather than a dropdown wherever the options fit: seeing them
 * all is one click instead of two, and nothing covers the form behind it. The
 * same reasoning as the phone app's CategoryPicker.
 */
export function ChipPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="field">
      {label ? <span className="label">{label}</span> : null}
      <div className="chip-row" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`chip${selected ? ' selected' : ''}`}
              onClick={() => onChange(option.value)}
              style={
                selected && option.color
                  ? {
                      color: option.color,
                      borderColor: `color-mix(in srgb, ${option.color} 55%, transparent)`,
                      background: `color-mix(in srgb, ${option.color} 16%, transparent)`,
                    }
                  : undefined
              }
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* MODAL -------------------------------------------------------------------- */

/**
 * A dialog, built on <dialog> for the behaviour browsers give for free:
 * a top-layer that cannot be covered by z-index, a real focus trap, and Esc to
 * close. Hand-rolling those is where accessible modals usually go wrong.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    // showModal() throws if it is already open, and close() on an already
    // closed dialog fires a spurious cancel, so both are guarded.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className="modal"
      style={{ width, maxWidth: 'calc(100vw - 32px)' }}
      // Esc fires `cancel`; preventing the default lets one code path own
      // closing, so state never disagrees with what is on screen.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click that lands on the dialog element itself is a click on the
      // backdrop, since the content sits in a child.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-head">
          <h2 style={{ fontSize: 16 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="modal-body">{children}</div>

        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

/* CONFIRM ------------------------------------------------------------------ */

/**
 * Replaces the phone app's destructive Alert.
 *
 * `window.confirm` would have done the job, but it blocks the whole tab, cannot
 * be styled, and on repeat use browsers offer to suppress it entirely - which
 * would silently turn "are you sure" into "yes".
 */
export function useConfirm() {
  const [state, setState] = useState<{
    title: string;
    message?: string;
    confirmLabel: string;
    resolve: (ok: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (title: string, message?: string, confirmLabel = 'Delete') =>
      new Promise<boolean>((resolve) => setState({ title, message, confirmLabel, resolve })),
    [],
  );

  const settle = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const dialog = (
    <Modal
      open={state !== null}
      title={state?.title ?? ''}
      onClose={() => settle(false)}
      width={420}
      footer={
        <>
          <button className="btn btn-glass" onClick={() => settle(false)}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={() => settle(true)}>
            {state?.confirmLabel}
          </button>
        </>
      }
    >
      <p className="secondary">{state?.message ?? 'This cannot be undone.'}</p>
    </Modal>
  );

  return { confirm, dialog };
}

/* SEGMENTED CONTROL -------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={option.value === value}
          className={`segmented-item${option.value === value ? ' active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* STAT --------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  color?: string;
}) {
  return (
    <div className="stat">
      <div className="overline">{label}</div>
      <div className="stat-value numeric" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub ? <div className="faint" style={{ fontSize: 12.5 }}>{sub}</div> : null}
    </div>
  );
}

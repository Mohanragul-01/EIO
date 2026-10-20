/**
 * Menu - a button that opens a short list of actions beside it.
 *
 * The phone's long-press and ⋮ sheets, as a desktop popover. Non-modal on
 * purpose: an action that ends in an Undo toast ("Workout deleted · Undo")
 * must leave nothing over the toast, and a <dialog> would sit above it.
 *
 * Keyboard: Enter/Space/ArrowDown on the button opens it with the first item
 * focused; arrows, Home and End move; Esc closes and gives focus back; Tab
 * closes. It is drawn `position: fixed` from the button's rectangle, so a
 * table or card that clips its overflow cannot cut it off, and it closes on
 * scroll rather than drifting away from the button.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { Icon, type IconName } from '../../components/Icon';

export type MenuItem =
  | {
      kind?: 'action';
      key: string;
      label: string;
      /** A second, quieter line. */
      detail?: string;
      icon?: IconName;
      danger?: boolean;
      disabled?: boolean;
      /** Set for a choice among options (radio) or an on/off (checkbox). */
      checked?: boolean;
      role?: 'menuitem' | 'menuitemradio' | 'menuitemcheckbox';
      onSelect: () => void;
    }
  | { kind: 'separator'; key: string }
  | { kind: 'heading'; key: string; label: string };

type Placement = CSSProperties;

const MENU_WIDTH = 248;
/** Room to keep below the button before the menu opens upwards instead. */
const ROOM_BELOW = 300;

export function Menu({
  label,
  content,
  items,
  className = 'icon-btn',
  disabled = false,
  title,
  align = 'end',
}: {
  /** The button's accessible name, e.g. "More for Bench Press". */
  label: string;
  /** What the button shows; an icon-only button by default. */
  content?: ReactNode;
  items: MenuItem[];
  className?: string;
  disabled?: boolean;
  title?: string;
  /** Which edge of the button the menu lines up with. */
  align?: 'start' | 'end';
}) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = placement !== null;

  const openMenu = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const vertical: Placement =
      below < ROOM_BELOW && rect.top > below
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 };
    const horizontal: Placement =
      align === 'end'
        ? { right: Math.max(8, window.innerWidth - rect.right) }
        : { left: Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8) };
    setPlacement({ ...vertical, ...horizontal });
  };

  const close = (refocus: boolean) => {
    setPlacement(null);
    if (refocus) buttonRef.current?.focus();
  };

  const enabledItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-menu-item]:not(:disabled)') ?? [],
    );

  // On open, the first item takes focus, so the keyboard lands inside.
  useEffect(() => {
    if (!open) return;
    enabledItems()[0]?.focus();
  }, [open]);

  // A click anywhere else, a scroll or a resize closes it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setPlacement(null);
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setPlacement(null);
    };
    const onResize = () => setPlacement(null);
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = enabledItems();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (to: number) => {
      event.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        aria-label={label}
        title={title ?? label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            openMenu();
          }
        }}
      >
        {content ?? <Icon name="more" />}
      </button>

      {placement ? (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          className="fx-menu"
          style={placement}
          onKeyDown={onMenuKey}
        >
          {items.map((item) => {
            if (item.kind === 'separator') {
              return <div key={item.key} role="separator" className="fx-menu-sep" />;
            }
            if (item.kind === 'heading') {
              return (
                <div key={item.key} role="presentation" className="fx-menu-heading">
                  {item.label}
                </div>
              );
            }
            const role = item.role ?? (item.checked === undefined ? 'menuitem' : 'menuitemradio');
            return (
              <button
                key={item.key}
                type="button"
                role={role}
                aria-checked={role === 'menuitem' ? undefined : !!item.checked}
                data-menu-item=""
                tabIndex={-1}
                disabled={item.disabled}
                className={`fx-menu-item${item.danger ? ' danger' : ''}`}
                onClick={() => {
                  // Closed first, focus back on the button, THEN the action:
                  // a dialog it opens remembers the button as where to return.
                  close(true);
                  item.onSelect();
                }}
              >
                <span className="fx-menu-icon" aria-hidden="true">
                  {item.checked ? (
                    <Icon name="check" size={14} />
                  ) : item.icon ? (
                    <Icon name={item.icon} size={14} />
                  ) : null}
                </span>
                <span className="grow">
                  <span className="fx-menu-label">{item.label}</span>
                  {item.detail ? <span className="fx-menu-detail">{item.detail}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

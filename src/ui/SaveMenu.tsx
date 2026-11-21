/**
 * The "Save & export" dropdown on the wide top bar. A menu button with a
 * list of actions anchored under it, right-aligned to the button so it stays
 * inside the window. Keyboard: arrows, Home and End move, Escape closes and
 * returns focus to the button, Tab closes.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { Icon, type IconName } from './Icon';

export interface MenuAction {
  key: string;
  icon: IconName;
  label: string;
  description: string;
  disabled?: boolean;
  /** Draws a thin line above this item. */
  dividerBefore?: boolean;
  onSelect(): void;
}

export function SaveMenu({
  items,
  buttonRef,
}: {
  items: readonly MenuAction[];
  /** The menu button, so others can send focus back to it. */
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ownButton = useRef<HTMLButtonElement>(null);
  const button = buttonRef ?? ownButton;
  const menuId = useId();

  const enabledItems = () =>
    [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])].filter((b) => !b.disabled);

  // Focus the first enabled item on open.
  useEffect(() => {
    if (open) enabledItems()[0]?.focus();
  }, [open]);

  // A press anywhere outside closes it. Capture phase, since the canvas handles its own pointer events.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = enabledItems();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => {
      e.preventDefault();
      list[(i + list.length) % list.length]?.focus();
    };
    switch (e.key) {
      case 'ArrowDown':
        go(at + 1);
        break;
      case 'ArrowUp':
        go(at < 0 ? list.length - 1 : at - 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(list.length - 1);
        break;
      case 'Escape':
        // Keeps the workspace's own Escape handling from running too.
        e.preventDefault();
        close(true);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={wrapRef} className="menu-wrap">
      <button
        ref={button}
        type="button"
        className="btn btn-ghost topbar-btn topbar-save-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Save & export"
        title="Save & export"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon name="file" />
        <span className="btn-label">Save &amp; export</span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div ref={menuRef} id={menuId} className="menu" role="menu" aria-label="Save & export" onKeyDown={onMenuKey}>
          {items.map((item) => (
            <div key={item.key} role="none">
              {item.dividerBefore && <div className="menu-divider" role="separator" />}
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                disabled={item.disabled}
                tabIndex={-1}
                onClick={() => {
                  close(true);
                  item.onSelect();
                }}
              >
                <Icon name={item.icon} />
                <span>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

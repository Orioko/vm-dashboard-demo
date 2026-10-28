import { Fragment, type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  label: string;
  x: number;
  y: number;
  items: MenuItem[];
  onClose: (options: { restoreFocus: boolean }) => void;
}

const VIEWPORT_MARGIN = 4;

export function ContextMenu({ label, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  const enabledItems = () =>
    [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(VIEWPORT_MARGIN, Math.min(x, window.innerWidth - width - VIEWPORT_MARGIN)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(y, window.innerHeight - height - VIEWPORT_MARGIN)),
    });
    (enabledItems()[0] ?? menu).focus();
  }, [x, y]);

  useEffect(() => {
    const dismiss = () => onClose({ restoreFocus: false });
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) dismiss();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
    };
  }, [onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = enabledItems();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);

    const focusAt = (index: number) => buttons[(index + buttons.length) % buttons.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        focusAt(current + 1);
        break;
      case 'ArrowUp':
        focusAt(current - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(buttons.length - 1);
        break;
      case 'Escape':
      case 'Tab':
        onClose({ restoreFocus: true });
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      tabIndex={-1}
      className="context-menu"
      style={position}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <Fragment key={item.id}>
          {item.separatorBefore && <div role="separator" className="context-menu__separator" />}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="context-menu__item"
            disabled={item.disabled}
            onClick={() => {
              onClose({ restoreFocus: true });
              item.onSelect();
            }}
          >
            <span className="context-menu__icon">{item.icon}</span>
            {item.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}

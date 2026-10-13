import { useEffect, useRef, type ReactNode } from 'react';

type Props = { onClose: () => void; children: ReactNode };

/**
 * Backdrop for Daymark's modals: closes on Escape, moves focus into the dialog when it opens, keeps Tab inside it,
 * and returns focus to whatever opened it.
 */
export function Dialog({ onClose, children }: Props) {
  const backdrop = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = backdrop.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || [],
      );
    if (root && !root.contains(document.activeElement))
      (focusable().find((el) => !el.classList.contains('modal-close')) || focusable()[0])?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close.current();
      } else if (event.key === 'Tab') {
        const items = focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" ref={backdrop}>
      {children}
    </div>
  );
}

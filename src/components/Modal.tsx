import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
export default function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const root = document.getElementById("root");
    const wasInert = root?.inert || false;
    if (root) root.inert = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select, textarea, a[href], [tabindex="0"]',
        ) || [],
      ).filter(
        (el) =>
          el.getClientRects().length > 0 &&
          !el.hasAttribute("disabled") &&
          getComputedStyle(el).visibility !== "hidden",
      );
    (
      focusables().find((el) => el.hasAttribute("data-autofocus")) ||
      focusables()[0]
    )?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const els = focusables();
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = previous;
      if (root) root.inert = wasInert;
      document.removeEventListener("keydown", handle);
      before?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={ref}
      >
        <header className="modal-header">
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

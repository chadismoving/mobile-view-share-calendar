import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Sheet({
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
  const dialog = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cancel = (event: Event) => {
      event.preventDefault();
      closeRef.current();
    };
    node.addEventListener("cancel", cancel);
    return () => {
      node.removeEventListener("cancel", cancel);
      node.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`sheet ${wide ? "sheet-wide" : ""}`}
      aria-labelledby="sheet-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="sheet-handle" />
      <header className="sheet-header">
        <div>
          <h2 id="sheet-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

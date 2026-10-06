import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

interface ConfirmationDialogProps {
  cancelLabel?: string;
  children: ReactNode;
  confirmLabel: string;
  returnFocusRef: RefObject<HTMLElement | null>;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationDialog({
  cancelLabel = "Cancel",
  children,
  confirmLabel,
  returnFocusRef,
  title,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useRef(`confirmation-title-${crypto.randomUUID()}`);
  const descriptionId = useRef(
    `confirmation-description-${crypto.randomUUID()}`,
  );

  useEffect(() => {
    cancelButtonRef.current?.focus();

    return () => {
      const returnTarget = returnFocusRef.current;
      if (returnTarget && document.contains(returnTarget)) {
        returnTarget.focus();
      }
    };
  }, [returnFocusRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const cancelButton = cancelButtonRef.current;
    const confirmButton = confirmButtonRef.current;
    if (!cancelButton || !confirmButton) {
      return;
    }

    if (event.shiftKey && document.activeElement === cancelButton) {
      event.preventDefault();
      confirmButton.focus();
    } else if (!event.shiftKey && document.activeElement === confirmButton) {
      event.preventDefault();
      cancelButton.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
      data-testid="confirmation-backdrop"
    >
      <div
        aria-describedby={descriptionId.current}
        aria-labelledby={titleId.current}
        aria-modal="true"
        className="w-full max-w-md border border-neutral-300 bg-white p-5 shadow-2xl"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <h2
          className="text-base font-semibold text-neutral-950"
          id={titleId.current}
        >
          {title}
        </h2>
        <div
          className="mt-3 text-sm leading-6 text-neutral-700"
          id={descriptionId.current}
        >
          {children}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            className="h-9 border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="h-9 border border-red-700 bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2"
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

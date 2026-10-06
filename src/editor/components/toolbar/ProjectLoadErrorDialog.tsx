import { useEffect, useId, useRef, type KeyboardEvent } from "react";

import type { ProjectLoadErrorPresentation } from "../../../persistence/projectLoadError";

interface ProjectLoadErrorDialogProps {
  error: ProjectLoadErrorPresentation;
  onClose: () => void;
}

export function ProjectLoadErrorDialog({
  error,
  onClose,
}: ProjectLoadErrorDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      closeButtonRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg border border-neutral-300 bg-white p-5 text-neutral-900 shadow-xl"
        role="dialog"
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="text-base font-semibold">
          {error.title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-neutral-700">
          {error.summary}
        </p>
        <div className="mt-4 max-h-56 overflow-y-auto border-y border-neutral-200 py-3">
          <ul className="space-y-2 pl-5 text-sm text-neutral-700">
            {error.details.map((detail, index) => (
              <li key={`${index}-${detail}`} className="list-disc break-words">
                {detail}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            ref={closeButtonRef}
            type="button"
            className="h-8 border border-neutral-400 bg-white px-3 text-xs font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
